-- Row Level Security and Data API privileges (docs/data-model.md, permissions table).
-- Privileges are granted per table on purpose; nothing relies on default grants.
-- anon gets no table privileges: workers reach the DB only through Route Handlers (service_role).

-- Membership helpers. They live in the private schema, which the Data API does not expose.
create function private.managed_site_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.site_id
  from public.site_members m
  join public.profiles p on p.id = m.profile_id
  where m.profile_id = (select auth.uid()) and p.role = 'manager';
$$;

create function private.managed_workstation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.id
  from public.workstations w
  where w.site_id in (select private.managed_site_ids());
$$;

create function private.member_partner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.partner_id
  from public.partner_members m
  join public.profiles p on p.id = m.profile_id
  where m.profile_id = (select auth.uid()) and p.role = 'partner';
$$;

revoke all on function private.managed_site_ids() from public;
revoke all on function private.managed_workstation_ids() from public;
revoke all on function private.member_partner_ids() from public;
grant usage on schema private to authenticated;
grant execute on function private.managed_site_ids() to authenticated;
grant execute on function private.managed_workstation_ids() to authenticated;
grant execute on function private.member_partner_ids() to authenticated;

-- Start from no privileges on every table, then grant explicitly.
do $$
declare
  t text;
begin
  foreach t in array array[
    'sites', 'workstations', 'tasks', 'profiles', 'site_members', 'partners', 'partner_members',
    'entry_tokens', 'report_rate_limits', 'capture_sessions', 'assessments', 'pain_reports',
    'suggestions', 'improvement_requests', 'quotes', 'improvement_options', 'option_effects',
    'improvement_plans', 'plan_items', 'adhoc_surveys'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
  end loop;
end;
$$;

-- Accounts and membership: users read only their own rows. Operators write them in the SQL editor.
grant select on public.profiles, public.site_members, public.partners, public.partner_members
  to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy site_members_select_own on public.site_members
  for select to authenticated using (profile_id = (select auth.uid()));
create policy partner_members_select_own on public.partner_members
  for select to authenticated using (profile_id = (select auth.uid()));
create policy partners_select_member on public.partners
  for select to authenticated using (id in (select private.member_partner_ids()));

-- Sites: managers read and update their own sites. Creating sites is an operator task.
grant select, update on public.sites to authenticated;
create policy sites_select_manager on public.sites
  for select to authenticated using (id in (select private.managed_site_ids()));
create policy sites_update_manager on public.sites
  for update to authenticated
  using (id in (select private.managed_site_ids()))
  with check (id in (select private.managed_site_ids()));

-- Tables scoped by site_id: managers read and write within their sites.
grant select, insert, update, delete on public.workstations, public.improvement_plans
  to authenticated;

create policy workstations_manager on public.workstations
  for all to authenticated
  using (site_id in (select private.managed_site_ids()))
  with check (site_id in (select private.managed_site_ids()));
create policy improvement_plans_manager on public.improvement_plans
  for all to authenticated
  using (site_id in (select private.managed_site_ids()))
  with check (site_id in (select private.managed_site_ids()));

-- Tables scoped by workstation_id: managers read and write within their sites.
grant select, insert, update, delete on public.tasks, public.improvement_options,
  public.improvement_requests, public.adhoc_surveys
  to authenticated;

create policy tasks_manager on public.tasks
  for all to authenticated
  using (workstation_id in (select private.managed_workstation_ids()))
  with check (workstation_id in (select private.managed_workstation_ids()));
create policy improvement_options_manager on public.improvement_options
  for all to authenticated
  using (workstation_id in (select private.managed_workstation_ids()))
  with check (workstation_id in (select private.managed_workstation_ids()));
create policy improvement_requests_manager on public.improvement_requests
  for all to authenticated
  using (workstation_id in (select private.managed_workstation_ids()))
  with check (workstation_id in (select private.managed_workstation_ids()));
create policy adhoc_surveys_manager on public.adhoc_surveys
  for all to authenticated
  using (workstation_id in (select private.managed_workstation_ids()))
  with check (workstation_id in (select private.managed_workstation_ids()));

-- New requests and plans are always recorded as created by the caller.
-- Restrictive policies are combined with AND, on top of the site checks above.
create policy improvement_requests_insert_own on public.improvement_requests
  as restrictive for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy improvement_plans_insert_own on public.improvement_plans
  as restrictive for insert to authenticated
  with check (created_by = (select auth.uid()));

-- Partners read open requests only. They get no access to pain reports or assessments.
create policy improvement_requests_select_partner on public.improvement_requests
  for select to authenticated
  using (status = 'open' and exists (select 1 from private.member_partner_ids()));

-- Child tables: scoped through their parent row, which is itself checked by RLS.
grant select, insert, update, delete on public.option_effects, public.plan_items to authenticated;

create policy option_effects_manager on public.option_effects
  for all to authenticated
  using (option_id in (select o.id from public.improvement_options o))
  with check (
    option_id in (select o.id from public.improvement_options o)
    and task_id in (select t.id from public.tasks t)
  );
create policy plan_items_manager on public.plan_items
  for all to authenticated
  using (plan_id in (select p.id from public.improvement_plans p))
  with check (
    plan_id in (select p.id from public.improvement_plans p)
    and option_id in (select o.id from public.improvement_options o)
  );

-- Capture results: managers read only. Route Handlers write them with service_role.
grant select on public.capture_sessions, public.assessments to authenticated;

create policy capture_sessions_select_manager on public.capture_sessions
  for select to authenticated
  using (task_id in (
    select t.id from public.tasks t
    where t.workstation_id in (select private.managed_workstation_ids())
  ));
create policy assessments_select_manager on public.assessments
  for select to authenticated
  using (session_id in (select s.id from public.capture_sessions s));

-- Quotes: managers read quotes on their requests; partners read and write their own company's quotes.
-- Partners may set price and lead time only; status stays 'submitted' until a manager flow changes it.
grant select on public.quotes to authenticated;
grant insert (request_id, partner_id, price, lead_time_days) on public.quotes to authenticated;
grant update (price, lead_time_days) on public.quotes to authenticated;

create policy quotes_select_manager on public.quotes
  for select to authenticated
  using (request_id in (
    select r.id from public.improvement_requests r
    where r.workstation_id in (select private.managed_workstation_ids())
  ));
create policy quotes_select_partner on public.quotes
  for select to authenticated
  using (partner_id in (select private.member_partner_ids()));
create policy quotes_insert_partner on public.quotes
  for insert to authenticated
  with check (
    partner_id in (select private.member_partner_ids())
    and request_id in (select r.id from public.improvement_requests r where r.status = 'open')
  );
create policy quotes_update_partner on public.quotes
  for update to authenticated
  using (partner_id in (select private.member_partner_ids()))
  with check (partner_id in (select private.member_partner_ids()));

-- Entry tokens: managers issue and deactivate tokens for their sites. No delete.
grant select, insert on public.entry_tokens to authenticated;
grant update (active, expires_at) on public.entry_tokens to authenticated;

create policy entry_tokens_select_manager on public.entry_tokens
  for select to authenticated
  using (workstation_id in (select private.managed_workstation_ids()));
create policy entry_tokens_insert_manager on public.entry_tokens
  for insert to authenticated
  with check (workstation_id in (select private.managed_workstation_ids()));
create policy entry_tokens_update_manager on public.entry_tokens
  for update to authenticated
  using (workstation_id in (select private.managed_workstation_ids()))
  with check (workstation_id in (select private.managed_workstation_ids()));

-- pain_reports, suggestions and report_rate_limits get no authenticated privileges or policies.
-- Managers read pain reports only through workstation_pain_summary.

-- service_role (secret key, bypasses RLS): only what worker Route Handlers need.
grant select on public.workstations, public.tasks to service_role;
grant select on public.entry_tokens to service_role;
grant select, insert, update on public.report_rate_limits to service_role;
grant select, insert on public.capture_sessions, public.assessments, public.pain_reports,
  public.suggestions
  to service_role;
