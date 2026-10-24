-- Simulation captures (docs/data-model.md): a manager issues a one-time QR for one option and
-- task, a phone captures the improved posture, and the server rescores it and saves the effect.
-- Simulation captures are kept apart from capture_sessions and assessments, so they never reach
-- task_latest_assessments, the overview, report assessments or pain summaries.

-- One-time tokens. Only the SHA-256 hash is stored. Managers read them but never write them
-- directly: issue_simulation_token is the only way in, so its hourly limit cannot be bypassed.
create table public.simulation_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  option_id uuid not null references public.improvement_options (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz
);
create index simulation_tokens_created_by on public.simulation_tokens (created_by, created_at);

-- Every saved simulation capture, scored on the server like an assessment. task_inputs are the
-- task's manager inputs used for scoring: posture changes are captured, load or coupling are not.
create table public.simulation_captures (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.improvement_options (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  frame_count integer not null check (frame_count >= 0),
  inference_fps numeric not null check (inference_fps > 0),
  task_inputs jsonb not null check (jsonb_typeof(task_inputs) = 'object'),
  part_summary jsonb not null,
  valid_frame_ratio numeric not null check (valid_frame_ratio between 0 and 1),
  high_risk_ratio numeric not null check (high_risk_ratio between 0 and 1),
  score_p90 numeric not null,
  level text not null check (level in ('low', 'caution', 'high', 'very-high')),
  algorithm_version text not null,
  created_at timestamptz not null default now()
);

-- Same rule as option_effects: the task must be on the option's workstation.
create trigger simulation_tokens_same_workstation
  before insert or update on public.simulation_tokens
  for each row execute function private.check_option_effect_task();
create trigger simulation_captures_same_workstation
  before insert or update on public.simulation_captures
  for each row execute function private.check_option_effect_task();

-- A simulation effect points to the capture it came from; a manual effect points to none.
alter table public.option_effects
  add column capture_id uuid references public.simulation_captures (id) on delete cascade,
  add constraint option_effects_capture_matches_source
    check ((source = 'simulation') = (capture_id is not null));

-- Managers write manual effects only; simulation effects come from save_simulation_capture.
-- Managers may still delete a simulation effect to go back to manual input.
drop policy option_effects_manager on public.option_effects;
create policy option_effects_manager on public.option_effects
  for all to authenticated
  using (option_id in (select o.id from public.improvement_options o))
  with check (
    source = 'manual'
    and option_id in (select o.id from public.improvement_options o)
    and task_id in (select t.id from public.tasks t)
  );

alter table public.simulation_tokens enable row level security;
alter table public.simulation_captures enable row level security;
revoke all on table public.simulation_tokens, public.simulation_captures
  from public, anon, authenticated, service_role;

-- Token hashes are never readable from the console.
grant select (id, option_id, task_id, created_by, created_at, expires_at, used_at)
  on public.simulation_tokens to authenticated;
grant select on public.simulation_captures to authenticated;
create policy simulation_tokens_select_manager on public.simulation_tokens
  for select to authenticated
  using (option_id in (select o.id from public.improvement_options o));
create policy simulation_captures_select_manager on public.simulation_captures
  for select to authenticated
  using (option_id in (select o.id from public.improvement_options o));

-- service_role (Route Handlers): look up a token, then save through save_simulation_capture.
grant select, update (used_at) on public.simulation_tokens to service_role;
grant select, insert on public.simulation_captures to service_role;
grant select, insert, update on public.option_effects to service_role;

-- Issues a one-time token for one option and task. security definer, so the membership check is
-- done here, without RLS: the option must be on a workstation the caller manages
-- (private.managed_workstation_ids filters by auth.uid() and the manager role itself).
-- At most 20 tokens per manager in the last hour; the advisory lock serializes concurrent calls.
create function public.issue_simulation_token(
  p_option_id uuid,
  p_task_id uuid,
  p_token_hash text
)
returns table (token_id uuid, token_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not exists (
    select 1
    from public.improvement_options o
    where o.id = p_option_id
      and o.workstation_id in (select private.managed_workstation_ids())
  ) then
    raise exception 'option % is not on a managed workstation', p_option_id
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1
    from public.improvement_options o
    join public.tasks t on t.workstation_id = o.workstation_id
    where o.id = p_option_id and t.id = p_task_id
  ) then
    raise exception 'option % and task % are not on the same workstation', p_option_id, p_task_id
      using errcode = 'check_violation';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'token hash must be 64 lowercase hex characters'
      using errcode = 'invalid_parameter_value';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('simulation_tokens:' || v_user::text, 0));
  if (
    select count(*)
    from public.simulation_tokens s
    where s.created_by = v_user and s.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'simulation token limit reached' using errcode = 'program_limit_exceeded';
  end if;

  return query
  insert into public.simulation_tokens as s (token_hash, option_id, task_id, created_by)
  values (p_token_hash, p_option_id, p_task_id, v_user)
  returning s.id, s.expires_at;
end;
$$;

-- Saves one server-scored simulation capture and makes it the task's effect for the option,
-- replacing any earlier effect for that task. The token is used up in the same transaction.
-- Returns the capture id, or null (saving nothing) when the token is used, expired or missing.
create function public.save_simulation_capture(
  p_token_id uuid,
  p_frame_count integer,
  p_inference_fps numeric,
  p_task_inputs jsonb,
  p_part_summary jsonb,
  p_valid_frame_ratio numeric,
  p_high_risk_ratio numeric,
  p_score_p90 numeric,
  p_level text,
  p_algorithm_version text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token public.simulation_tokens%rowtype;
  v_capture uuid;
begin
  select * into v_token
  from public.simulation_tokens s
  where s.id = p_token_id and s.used_at is null and s.expires_at > now()
  for update;
  if not found then
    return null;
  end if;

  insert into public.simulation_captures (
    option_id, task_id, frame_count, inference_fps, task_inputs, part_summary,
    valid_frame_ratio, high_risk_ratio, score_p90, level, algorithm_version
  )
  values (
    v_token.option_id, v_token.task_id, p_frame_count, p_inference_fps, p_task_inputs,
    p_part_summary, p_valid_frame_ratio, p_high_risk_ratio, p_score_p90, p_level,
    p_algorithm_version
  )
  returning id into v_capture;

  insert into public.option_effects as e (
    option_id, task_id, expected_high_risk_ratio, source, capture_id
  )
  values (v_token.option_id, v_token.task_id, p_high_risk_ratio, 'simulation', v_capture)
  on conflict (option_id, task_id) do update
  set expected_high_risk_ratio = excluded.expected_high_risk_ratio,
    source = 'simulation',
    capture_id = excluded.capture_id;

  update public.simulation_tokens set used_at = now() where id = v_token.id;
  return v_capture;
end;
$$;

revoke all on function public.issue_simulation_token(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.issue_simulation_token(uuid, uuid, text) to authenticated;
revoke all on function public.save_simulation_capture(
  uuid, integer, numeric, jsonb, jsonb, numeric, numeric, numeric, text, text
) from public, anon, authenticated;
grant execute on function public.save_simulation_capture(
  uuid, integer, numeric, jsonb, jsonb, numeric, numeric, numeric, text, text
) to service_role;

-- Editing an option now replaces only its manual effects. A manual value for a task that has a
-- simulation effect fails on the primary key (unique_violation), which the screen reports.
create or replace function public.save_improvement_option(
  p_option_id uuid,
  p_workstation_id uuid,
  p_title text,
  p_description text,
  p_cost bigint,
  p_effects jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_option_id is null then
    insert into public.improvement_options (workstation_id, title, description, cost)
    values (p_workstation_id, p_title, p_description, p_cost)
    returning id into v_id;
  else
    update public.improvement_options
    set title = p_title, description = p_description, cost = p_cost
    where id = p_option_id and workstation_id = p_workstation_id
    returning id into v_id;
    if v_id is null then
      raise exception 'improvement option % not found', p_option_id using errcode = 'no_data_found';
    end if;
    delete from public.option_effects where option_id = v_id and source = 'manual';
  end if;

  insert into public.option_effects (option_id, task_id, expected_high_risk_ratio, source)
  select v_id, e.task_id, e.expected_high_risk_ratio, 'manual'
  from jsonb_to_recordset(coalesce(p_effects, '[]'::jsonb))
    as e (task_id uuid, expected_high_risk_ratio numeric);
  return v_id;
end;
$$;
