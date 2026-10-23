-- Saved improvement plans keep the values computed at save time, and only the server writes them,
-- through save_improvement_plan after recomputing the plan (docs/data-model.md).

-- No plan screen existed before, so no rows are expected. Stop rather than invent snapshot values.
do $$
begin
  if exists (select 1 from public.improvement_plans) or exists (select 1 from public.plan_items) then
    raise exception 'expected no saved plans before this migration';
  end if;
end;
$$;

alter table public.improvement_plans
  add column total_cost bigint not null check (total_cost >= 0),
  add column total_reduction numeric not null,
  add column exposure_before numeric,
  add column warnings jsonb not null default '[]'::jsonb;

-- One item per workstation, with the values used at save time. Editing or deleting an option
-- later leaves the saved plan as it was; option_id becomes null when the option is deleted.
alter table public.plan_items
  drop constraint plan_items_pkey,
  drop constraint plan_items_option_id_fkey,
  alter column option_id drop not null,
  add column workstation_id uuid not null references public.workstations (id) on delete cascade,
  add column workstation_name text not null,
  add column option_title text not null,
  add column cost bigint not null check (cost >= 0),
  add column reduction numeric not null,
  add column manual_estimate boolean not null,
  add constraint plan_items_pkey primary key (plan_id, workstation_id),
  add constraint plan_items_option_id_fkey foreign key (option_id)
    references public.improvement_options (id) on delete set null;

-- Managers only read plans. Writes go through save_improvement_plan below.
revoke insert, update, delete on public.improvement_plans, public.plan_items from authenticated;

-- Called by the console Server Action with service_role after it recomputes the plan.
-- Checks that the profile is a manager of the site, and that every item is a current option of
-- that site at the cost the plan used. Titles and workstation names come from the database, and
-- the plan totals are the sums of the saved items, so they cannot disagree.
create function public.save_improvement_plan(
  p_profile_id uuid,
  p_site_id uuid,
  p_budget bigint,
  p_solver_version text,
  p_exposure_before numeric,
  p_warnings jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
begin
  if not exists (
    select 1
    from public.site_members m
    join public.profiles p on p.id = m.profile_id
    where m.profile_id = p_profile_id and m.site_id = p_site_id and p.role = 'manager'
  ) then
    raise exception 'profile % does not manage site %', p_profile_id, p_site_id
      using errcode = 'insufficient_privilege';
  end if;

  -- One statement, so the items, their sums and both inserts read the same snapshot.
  with items as (
    select w.id as workstation_id, w.name as workstation_name, o.id as option_id,
      o.title as option_title, o.cost, i.reduction, i.manual_estimate
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as i (option_id uuid, cost bigint, reduction numeric, manual_estimate boolean)
    join public.improvement_options o on o.id = i.option_id and o.cost = i.cost
    join public.workstations w on w.id = o.workstation_id and w.site_id = p_site_id
  ),
  plan as (
    insert into public.improvement_plans (
      site_id, budget, solver_version, created_by, total_cost, total_reduction, exposure_before,
      warnings
    )
    select p_site_id, p_budget, p_solver_version, p_profile_id, coalesce(sum(cost), 0),
      coalesce(sum(reduction), 0), p_exposure_before, coalesce(p_warnings, '[]'::jsonb)
    from items
    returning id
  ),
  saved as (
    insert into public.plan_items (
      plan_id, workstation_id, workstation_name, option_id, option_title, cost, reduction,
      manual_estimate
    )
    select plan.id, items.workstation_id, items.workstation_name, items.option_id,
      items.option_title, items.cost, items.reduction, items.manual_estimate
    from plan, items
    returning 1
  )
  select (select id from plan), (select count(*) from saved) into v_id, v_count;

  if v_count <> jsonb_array_length(coalesce(p_items, '[]'::jsonb)) then
    raise exception 'plan items must be current options of site %', p_site_id
      using errcode = 'check_violation';
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_improvement_plan(uuid, uuid, bigint, text, numeric, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_improvement_plan(uuid, uuid, bigint, text, numeric, jsonb, jsonb)
  to service_role;
grant select on public.site_members, public.profiles, public.improvement_options to service_role;
grant select, insert on public.improvement_plans, public.plan_items to service_role;
