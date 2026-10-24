-- Removes the demo site of demo-data.sql and everything under it. Run as one script in the SQL
-- editor. Every table below the site is deleted by cascade (docs/deployment.md, 시연 데이터);
-- QR tokens of the demo workstations go too, so issue and print them again after reloading.
-- The fictional companies are not under the site, so they are deleted by name afterwards;
-- 합성 설비 업체 (seed.sql) stays.
-- The last row shows how many rows were removed and that no demo row is left in any table.

begin;

-- BEGIN GENERATED: site name
select set_config('demo.site_name', '시연 공장', true);
-- END GENERATED: site name
-- BEGIN GENERATED: partner names
select set_config('demo.partners', '["가람설비(가상)","누리자동화(가상)","다온기계(가상)"]', true);
-- END GENERATED: partner names

-- Rows that belong to the demo site, per table.
create function pg_temp.demo_counts()
returns table (
  sites bigint, site_members bigint, workstations bigint, tasks bigint, capture_sessions bigint,
  assessments bigint, entry_tokens bigint, report_rate_limits bigint, pain_reports bigint,
  suggestions bigint, improvement_options bigint, option_effects bigint,
  improvement_requests bigint, quotes bigint, improvement_plans bigint, plan_items bigint,
  adhoc_surveys bigint, simulation_tokens bigint, simulation_captures bigint, partners bigint
)
language sql
as $$
  with site as (
    select id from public.sites where name = current_setting('demo.site_name')
  ),
  ws as (
    select w.id from public.workstations w where w.site_id in (select id from site)
  ),
  task as (
    select t.id from public.tasks t where t.workstation_id in (select id from ws)
  )
  select
    (select count(*) from site),
    (select count(*) from public.site_members where site_id in (select id from site)),
    (select count(*) from ws),
    (select count(*) from task),
    (select count(*) from public.capture_sessions where task_id in (select id from task)),
    (select count(*) from public.assessments a
     join public.capture_sessions c on c.id = a.session_id
     where c.task_id in (select id from task)),
    (select count(*) from public.entry_tokens where workstation_id in (select id from ws)),
    (select count(*) from public.report_rate_limits r
     join public.entry_tokens e on e.id = r.token_id
     where e.workstation_id in (select id from ws)),
    (select count(*) from public.pain_reports where workstation_id in (select id from ws)),
    (select count(*) from public.suggestions where workstation_id in (select id from ws)),
    (select count(*) from public.improvement_options where workstation_id in (select id from ws)),
    (select count(*) from public.option_effects where task_id in (select id from task)),
    (select count(*) from public.improvement_requests where workstation_id in (select id from ws)),
    (select count(*) from public.quotes q
     join public.improvement_requests r on r.id = q.request_id
     where r.workstation_id in (select id from ws)),
    (select count(*) from public.improvement_plans where site_id in (select id from site)),
    (select count(*) from public.plan_items where workstation_id in (select id from ws)),
    (select count(*) from public.adhoc_surveys where workstation_id in (select id from ws)),
    (select count(*) from public.simulation_tokens where task_id in (select id from task)),
    (select count(*) from public.simulation_captures where task_id in (select id from task)),
    (select count(*) from public.partners
     where company_name in (select jsonb_array_elements_text(current_setting('demo.partners')::jsonb)))
$$;

select set_config(
  'demo.removed',
  (select (c.sites + c.site_members + c.workstations + c.tasks + c.capture_sessions
    + c.assessments + c.entry_tokens + c.report_rate_limits + c.pain_reports + c.suggestions
    + c.improvement_options + c.option_effects + c.improvement_requests + c.quotes
    + c.improvement_plans + c.plan_items + c.adhoc_surveys + c.simulation_tokens
    + c.simulation_captures + c.partners)::text
   from pg_temp.demo_counts() c),
  true
);

delete from public.sites where name = current_setting('demo.site_name');
delete from public.partners
where company_name in (select jsonb_array_elements_text(current_setting('demo.partners')::jsonb));

select current_setting('demo.removed')::bigint as removed_rows, c.*
from pg_temp.demo_counts() c;

commit;
