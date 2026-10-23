-- Worker submissions: per-kind hourly limits and atomic save functions (docs/data-model.md).
-- The functions run with the caller's privileges and only service_role (Route Handlers) may call them.
-- service_role's table-level grant on report_rate_limits (20261022000002) also covers the new column.

-- Limits are counted per token and per request kind in fixed hourly windows.
alter table public.report_rate_limits
  add column kind text not null default 'pain' check (kind in ('pain', 'assessment'));
alter table public.report_rate_limits alter column kind drop default;
alter table public.report_rate_limits drop constraint report_rate_limits_pkey;
alter table public.report_rate_limits add primary key (token_id, kind, window_start);

-- Counts one request in the current hour; false when the limit is already reached.
-- The row lock taken by the upsert keeps concurrent requests from passing the limit.
create function private.consume_rate_limit(p_token_id uuid, p_kind text, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_limit < 1 then
    raise exception 'rate limit must be at least 1';
  end if;
  insert into public.report_rate_limits as r (token_id, kind, window_start, count)
  values (p_token_id, p_kind, date_trunc('hour', now()), 1)
  on conflict (token_id, kind, window_start)
  do update set count = r.count + 1
  where r.count < p_limit
  returning r.count into v_count;
  return v_count is not null;
end;
$$;

-- Workstation of an active, unexpired token, or null.
create function private.token_workstation(p_token_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select e.workstation_id
  from public.entry_tokens e
  where e.id = p_token_id and e.active and e.expires_at > now();
$$;

-- Saves one capture session and its server-computed assessment in one transaction.
-- Returns false, saving nothing, when the token's hourly assessment limit is reached.
create function public.save_assessment(
  p_token_id uuid,
  p_task_id uuid,
  p_frame_count integer,
  p_inference_fps numeric,
  p_part_summary jsonb,
  p_valid_frame_ratio numeric,
  p_high_risk_ratio numeric,
  p_score_p90 numeric,
  p_level text,
  p_algorithm_version text,
  p_limit integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workstation uuid := private.token_workstation(p_token_id);
  v_session uuid;
begin
  if v_workstation is null then
    raise exception 'entry token is not valid';
  end if;
  if not exists (
    select 1 from public.tasks t where t.id = p_task_id and t.workstation_id = v_workstation
  ) then
    raise exception 'task does not belong to the token''s workstation';
  end if;
  if not private.consume_rate_limit(p_token_id, 'assessment', p_limit) then
    return false;
  end if;

  insert into public.capture_sessions (task_id, frame_count, inference_fps)
  values (p_task_id, p_frame_count, p_inference_fps)
  returning id into v_session;

  insert into public.assessments (
    session_id, method, part_summary, valid_frame_ratio, high_risk_ratio,
    score_p90, level, algorithm_version
  )
  values (
    v_session, 'reba', p_part_summary, p_valid_frame_ratio, p_high_risk_ratio,
    p_score_p90, p_level, p_algorithm_version
  );
  return true;
end;
$$;

-- Saves one pain report for the token's workstation; visible_from is set by the existing trigger.
-- Returns false, saving nothing, when the token's hourly pain report limit is reached.
create function public.submit_pain_report(
  p_token_id uuid,
  p_body_parts text[],
  p_intensity text,
  p_limit integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workstation uuid := private.token_workstation(p_token_id);
begin
  if v_workstation is null then
    raise exception 'entry token is not valid';
  end if;
  if not private.consume_rate_limit(p_token_id, 'pain', p_limit) then
    return false;
  end if;

  insert into public.pain_reports (workstation_id, body_parts, intensity)
  values (v_workstation, p_body_parts, p_intensity);
  return true;
end;
$$;

revoke all on function private.consume_rate_limit(uuid, text, integer) from public;
revoke all on function private.token_workstation(uuid) from public;
revoke all on function public.save_assessment(
  uuid, uuid, integer, numeric, jsonb, numeric, numeric, numeric, text, text, integer
) from public, anon, authenticated;
revoke all on function public.submit_pain_report(uuid, text[], text, integer)
  from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.consume_rate_limit(uuid, text, integer) to service_role;
grant execute on function private.token_workstation(uuid) to service_role;
grant execute on function public.save_assessment(
  uuid, uuid, integer, numeric, jsonb, numeric, numeric, numeric, text, text, integer
) to service_role;
grant execute on function public.submit_pain_report(uuid, text[], text, integer) to service_role;
