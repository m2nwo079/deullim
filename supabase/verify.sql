-- Checks to run in the SQL editor after the migrations, seed.sql and link-accounts.sql.
-- Run blocks 1 to 3 on their own. Run blocks 4 to 7 together, from begin to rollback,
-- because they share one transaction that adds test groups and acts as the manager.
-- The rollback removes the test groups. Block 8 is a separate transaction for entry token rules.

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

-- 8. Entry token rules (migration 20261022000004). Run this block on its own, from begin to rollback.
--    It adds test tokens to 용접 3번 작업대 and removes them with the rollback.
--    Expected: every *_rejected column is true and extend_90_days_allowed is true.
begin;
create function pg_temp.fails(stmt text) returns boolean
language plpgsql
as $$
begin
  execute stmt;
  -- Undo a statement that succeeded and report it as not failing.
  raise sqlstate 'DL001';
exception
  when sqlstate 'DL001' then return false;
  when others then return true;
end;
$$;

-- Real tokens of this workstation are set aside first; the rollback restores them.
update public.entry_tokens t set active = false
from public.workstations w
where t.workstation_id = w.id and w.code = 'WLD-03' and t.active;
insert into public.entry_tokens (workstation_id, token_hash)
select w.id, 'verify-old' from public.workstations w where w.code = 'WLD-03';
update public.entry_tokens set active = false where token_hash = 'verify-old';
insert into public.entry_tokens (workstation_id, token_hash)
select w.id, 'verify-current' from public.workstations w where w.code = 'WLD-03';

select
  pg_temp.fails($q$
    insert into public.entry_tokens (workstation_id, token_hash)
    select w.id, 'verify-second-active' from public.workstations w where w.code = 'WLD-03'
  $q$) as second_active_rejected,
  pg_temp.fails($q$
    update public.entry_tokens set active = true where token_hash = 'verify-old'
  $q$) as reactivation_rejected,
  pg_temp.fails($q$
    update public.entry_tokens set expires_at = now() + interval '91 days'
    where token_hash = 'verify-current'
  $q$) as extend_over_90_days_rejected,
  not pg_temp.fails($q$
    update public.entry_tokens set expires_at = now() + interval '90 days'
    where token_hash = 'verify-current'
  $q$) as extend_90_days_allowed;
rollback;

-- 9. Worker submissions (migration 20261023000001). Run this block on its own, from begin to rollback.
--    It adds a test token to 용접 3번 작업대 and removes it with the rollback.
--    Expected: every column is true.
begin;
-- Real tokens of this workstation are set aside first; the rollback restores them.
update public.entry_tokens t set active = false
from public.workstations w
where t.workstation_id = w.id and w.code = 'WLD-03' and t.active;
insert into public.entry_tokens (workstation_id, token_hash)
select w.id, 'verify-submit' from public.workstations w where w.code = 'WLD-03';

create function pg_temp.fails(stmt text) returns boolean
language plpgsql
as $$
begin
  execute stmt;
  raise sqlstate 'DL001';
exception
  when sqlstate 'DL001' then return false;
  when others then return true;
end;
$$;

create function pg_temp.pain_calls(n integer) returns boolean[]
language plpgsql
as $$
declare
  results boolean[] := '{}';
begin
  for i in 1..n loop
    results := results || public.submit_pain_report(
      (select id from public.entry_tokens where token_hash = 'verify-submit'),
      array['neck'], 'mild', 20);
  end loop;
  return results;
end;
$$;

create function pg_temp.assessment_calls(n integer, task_code text) returns boolean[]
language plpgsql
as $$
declare
  results boolean[] := '{}';
begin
  for i in 1..n loop
    results := results || public.save_assessment(
      (select id from public.entry_tokens where token_hash = 'verify-submit'),
      (select t.id from public.tasks t join public.workstations w on w.id = t.workstation_id
       where w.code = task_code order by t.name limit 1),
      450, 15, '{}'::jsonb, 1, 0, 3, 'low', 'reba-2d-v1', 10);
  end loop;
  return results;
end;
$$;

set local role service_role;
select
  -- Rows that existed before this migration were filled with 'pain'.
  not exists (
    select 1 from public.report_rate_limits r
    where r.token_id <> (select id from public.entry_tokens where token_hash = 'verify-submit')
      and r.kind <> 'pain'
  ) as old_rows_are_pain,
  pg_temp.pain_calls(21) = array_fill(true, array[20]) || false as pain_21st_rejected,
  pg_temp.assessment_calls(11, 'WLD-03') = array_fill(true, array[10]) || false
    as assessment_11th_rejected,
  pg_temp.fails($q$ select pg_temp.assessment_calls(1, 'PRS-02') $q$) as other_task_rejected,
  not has_function_privilege('anon', 'public.submit_pain_report(uuid,text[],text,integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.save_assessment(uuid,uuid,integer,numeric,jsonb,numeric,numeric,numeric,text,text,integer)', 'execute')
    as anon_and_authenticated_blocked;
-- A separate statement, so it sees the rows the functions above inserted.
select count(*) = 10 as ten_sessions_saved
from public.assessments a
join public.capture_sessions s on s.id = a.session_id
where s.created_at = now();
reset role;
update public.entry_tokens set active = false where token_hash = 'verify-submit';
set local role service_role;
select pg_temp.fails($q$
  select public.submit_pain_report(
    (select id from public.entry_tokens where token_hash = 'verify-submit'), array['neck'], 'mild', 20)
$q$) as inactive_token_rejected;
rollback;
