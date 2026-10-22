-- Checks to run in the SQL editor after the migrations, seed.sql and link-accounts.sql.
-- Run blocks 1 to 3 on their own. Run blocks 4 to 7 together, from begin to rollback,
-- because they share one transaction that adds test groups and acts as the manager.
-- The rollback removes the test groups.

-- 1. RLS is enabled on every table in public.
--    Expected: 0 rows.
select c.relname as table_without_rls
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and not c.relrowsecurity;

-- 2. anon has no privileges on any table or view in public.
--    Expected: 0 rows.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public';

-- 3. pain_group_visibility reads workstations only, never pain_reports.
--    Expected: 1 row, public.workstations.
select distinct d.refobjid::regclass as referenced_relation
from pg_depend d
join pg_rewrite r on r.oid = d.objid
where r.ev_class = 'public.pain_group_visibility'::regclass
  and d.refclassid = 'pg_class'::regclass
  and d.refobjid <> 'public.pain_group_visibility'::regclass;

-- 4. Pain summary as the manager of 합성 제1공장.
--    Two test groups that cannot be shown are added first, each with a pain report:
--    '품질' (one workstation, 4 people) and '보관' (two workstations, 2 + 2 people).
--    Expected:
--    - 5 rows, all for 합성 제1공장:
--      용접 3번 작업대 7, 프레스 2라인 5, 도장 부스 A 3, 조립 1라인 4, 물류 2
--      (counts can split across two weeks if the seeded times cross a Monday).
--    - '물류' has merged = true and workstation_id null.
--    - No row is labelled '자재 입고장', '포장 라인', '품질', '보관' or a test workstation name.
--    - No row has site_name '합성 제2공장'.
begin;
insert into public.workstations (site_id, parent_group, name, code, headcount)
select s.id, t.parent_group, t.name, t.code, t.headcount
from public.sites s, (values
  ('품질', '검사대', 'TEST-QC', 4),
  ('보관', '창고 A', 'TEST-SA', 2),
  ('보관', '창고 B', 'TEST-SB', 2)
) as t (parent_group, name, code, headcount)
where s.name = '합성 제1공장';
insert into public.pain_reports (workstation_id, body_parts, intensity, created_at)
select w.id, array['neck'], 'mild', now() - interval '2 days'
from public.workstations w
where w.code like 'TEST-%';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', m.profile_id, 'role', 'authenticated')::text,
  true
)
from public.site_members m
join public.sites s on s.id = m.site_id
where s.name = '합성 제1공장'
limit 1;
set local role authenticated;

select s.name as site_name, v.label, v.merged, v.workstation_id, v.week_start, v.report_count
from public.workstation_pain_summary v
left join public.sites s on s.id = v.site_id
order by v.label, v.week_start;

-- 5. Same manager: rows from 합성 제2공장 are invisible in tables and the view.
--    Expected: every count is 0.
select
  (select count(*) from public.sites where name = '합성 제2공장') as sites_b,
  (select count(*) from public.workstations where code like 'MCH-%') as workstations_b,
  (select count(*) from public.workstation_pain_summary where label like '가공%') as summary_b;

-- 6. Same manager: pain_reports cannot be read directly.
--    Expected: false.
select has_table_privilege('authenticated', 'public.pain_reports', 'select') as can_read_pain_reports;

-- 7. Same manager: group visibility.
--    Expected 6 rows:
--    - 보관: visible false, reason under_five
--    - 품질: visible false, reason single_workstation
--    - 물류: merged true, visible true
--    - 조립, 도장, 차체: merged false, visible true
select parent_group, workstation_count, merged, visible, reason
from public.pain_group_visibility
order by visible, parent_group;
rollback;
