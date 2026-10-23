-- Improvement option input (docs/data-model.md): description, effect consistency, atomic save.

alter table public.improvement_options
  add column description text check (char_length(description) <= 500);

-- An effect must point to a task of the option's own workstation, whatever role writes it.
create function private.check_option_effect_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.improvement_options o
    join public.tasks t on t.workstation_id = o.workstation_id
    where o.id = new.option_id and t.id = new.task_id
  ) then
    raise exception 'option % and task % are not on the same workstation', new.option_id, new.task_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger option_effects_same_workstation
  before insert or update on public.option_effects
  for each row execute function private.check_option_effect_task();

-- Options and tasks never move to another workstation, so existing effects stay consistent.
create function private.keep_workstation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workstation_id <> old.workstation_id then
    raise exception '% rows cannot move to another workstation', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger improvement_options_keep_workstation
  before update of workstation_id on public.improvement_options
  for each row execute function private.keep_workstation();
create trigger tasks_keep_workstation
  before update of workstation_id on public.tasks
  for each row execute function private.keep_workstation();

revoke all on function private.check_option_effect_task() from public;
revoke all on function private.keep_workstation() from public;

-- Saves an option and replaces its effects in one transaction. security invoker: the caller's RLS
-- applies, so a manager can only write options of their own sites. Effects are saved as manual.
-- p_option_id null creates a new option; otherwise the option must be on p_workstation_id.
create function public.save_improvement_option(
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
    delete from public.option_effects where option_id = v_id;
  end if;

  insert into public.option_effects (option_id, task_id, expected_high_risk_ratio, source)
  select v_id, e.task_id, e.expected_high_risk_ratio, 'manual'
  from jsonb_to_recordset(coalesce(p_effects, '[]'::jsonb))
    as e (task_id uuid, expected_high_risk_ratio numeric);
  return v_id;
end;
$$;

revoke all on function public.save_improvement_option(uuid, uuid, text, text, bigint, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_improvement_option(uuid, uuid, text, text, bigint, jsonb)
  to authenticated;
