-- Checks to run in the SQL editor after the migrations, seed.sql and link-accounts.sql.
-- Run blocks 1 to 3 on their own. Run blocks 4 to 7 together, from begin to rollback,
-- because they share one transaction that adds test groups and acts as the manager.
-- The rollback removes the test groups. Block 8 is a separate transaction for entry token rules.
-- Rule: each block gathers its results into one row from its last SELECT, because the Supabase
-- SQL editor shows only the last result when several statements run. Keep intermediate results
-- with set_config and read them back in that final SELECT.

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

-- 10. Latest assessment per task (migration 20261024000001). Run this block on its own, from begin to rollback.
--     Test captures are added to 하부 용접 (합성 제1공장) and to a test task in 합성 제2공장.
--     Their times are a few minutes ahead, so they are the newest even if dev already has captures.
--     Expected: every column is true.
begin;
insert into public.tasks (workstation_id, name, daily_hours, load_category, coupling)
select w.id, 'verify-latest', 1, 'lt5', 'good'
from public.workstations w where w.code = 'MCH-01';
-- Kept before switching roles, so the manager check below compares ids directly.
select set_config('verify.other_task', t.id::text, true)
from public.tasks t where t.name = 'verify-latest';

create function pg_temp.add_capture(task_name text, method text, level text, at timestamptz)
returns void
language sql
as $$
  with s as (
    insert into public.capture_sessions (task_id, frame_count, inference_fps, created_at)
    select t.id, 450, 15, at from public.tasks t where t.name = task_name
    returning id
  )
  insert into public.assessments (session_id, method, part_summary, valid_frame_ratio,
    high_risk_ratio, score_p90, level, algorithm_version, created_at)
  select s.id, method, '{}'::jsonb, 1, 0.5, 9, level, 'reba-2d-v1', at from s;
$$;

select pg_temp.add_capture('하부 용접', 'reba', 'caution', now() + interval '1 minute');
select pg_temp.add_capture('하부 용접', 'reba', 'high', now() + interval '2 minutes');
-- A newer non-REBA row must be ignored.
select pg_temp.add_capture('하부 용접', 'rula', 'low', now() + interval '3 minutes');
select pg_temp.add_capture('verify-latest', 'reba', 'very-high', now() + interval '1 minute');

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

select
  (select v.level from public.task_latest_assessments v
   join public.tasks t on t.id = v.task_id where t.name = '하부 용접') = 'high'
    as picks_latest_reba,
  not exists (
    select 1 from public.task_latest_assessments v
    where v.task_id = current_setting('verify.other_task')::uuid
  ) and not exists (
    select 1 from public.task_latest_assessments v
    where v.task_id not in (select t.id from public.tasks t)
  ) as other_site_hidden,
  (select 'security_invoker=true' = any (c.reloptions)
   from pg_class c where c.oid = 'public.task_latest_assessments'::regclass) as is_security_invoker,
  has_table_privilege('authenticated', 'public.task_latest_assessments', 'select')
    and not has_table_privilege('authenticated', 'public.task_latest_assessments', 'insert')
    and not has_table_privilege('anon', 'public.task_latest_assessments', 'select')
    as select_only_for_authenticated,
  (select v.algorithm_version = 'reba-2d-v1' and v.valid_frame_ratio = 1 and v.part_summary = '{}'::jsonb
   from public.task_latest_assessments v
   join public.tasks t on t.id = v.task_id where t.name = '하부 용접') as report_columns_from_latest,
  (select count(*) = 3 from information_schema.columns
   where table_schema = 'public' and table_name = 'task_latest_assessments'
     and column_name in ('valid_frame_ratio', 'algorithm_version', 'part_summary')) as report_columns_present;
rollback;

-- 11. Improvement options (migration 20261025000001). Run this block on its own, from begin to rollback.
--     A test task and option are added to 가공 1라인 (합성 제2공장) as the owner first,
--     then the checks run as the manager of 합성 제1공장. Expected: every column is true.
begin;
insert into public.tasks (workstation_id, name, daily_hours, load_category, coupling)
select w.id, 'verify-other-task', 1, 'lt5', 'good' from public.workstations w where w.code = 'MCH-01';
insert into public.improvement_options (workstation_id, title, cost)
select w.id, 'verify-other-option', 1 from public.workstations w where w.code = 'MCH-01';

-- Ids kept before switching roles, so the checks below compare them directly.
select
  set_config('verify.weld', (select id::text from public.workstations where code = 'WLD-03'), true),
  set_config('verify.press', (select id::text from public.workstations where code = 'PRS-02'), true),
  set_config('verify.other_ws', (select id::text from public.workstations where code = 'MCH-01'), true),
  set_config('verify.weld_task', (select t.id::text from public.tasks t
    join public.workstations w on w.id = t.workstation_id where w.code = 'WLD-03'
    order by t.name limit 1), true),
  set_config('verify.press_task', (select t.id::text from public.tasks t
    join public.workstations w on w.id = t.workstation_id where w.code = 'PRS-02'
    order by t.name limit 1), true),
  set_config('verify.other_task', (select id::text from public.tasks where name = 'verify-other-task'), true),
  set_config('verify.other_option',
    (select id::text from public.improvement_options where title = 'verify-other-option'), true);

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

create function pg_temp.v(name text) returns uuid
language sql
as $$ select current_setting('verify.' || name)::uuid $$;

-- Keeps a check result for the final row.
create function pg_temp.keep(name text, ok boolean) returns void
language sql
as $$ select set_config('verify.ok_' || name, coalesce(ok, false)::text, true) $$;

create function pg_temp.ok(name text) returns boolean
language sql
as $$ select current_setting('verify.ok_' || name)::boolean $$;

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

select set_config('verify.option', public.save_improvement_option(
  null, pg_temp.v('weld'), 'verify-option', null, 100000,
  jsonb_build_array(jsonb_build_object('task_id', pg_temp.v('weld_task'), 'expected_high_risk_ratio', 0.1))
)::text, true);

select
  pg_temp.keep('saved_with_effect', (select count(*) from public.option_effects
    where option_id = pg_temp.v('option') and task_id = pg_temp.v('weld_task')
      and expected_high_risk_ratio = 0.1 and source = 'manual') = 1),
  pg_temp.keep('other_site_insert_rejected', pg_temp.fails($q$
    insert into public.improvement_options (workstation_id, title, cost)
    values (pg_temp.v('other_ws'), 'x', 1) $q$)),
  pg_temp.keep('move_to_other_site_rejected', pg_temp.fails($q$
    update public.improvement_options set workstation_id = pg_temp.v('other_ws')
    where id = pg_temp.v('option') $q$)),
  pg_temp.keep('move_within_site_rejected', pg_temp.fails($q$
    update public.improvement_options set workstation_id = pg_temp.v('press')
    where id = pg_temp.v('option') $q$)),
  pg_temp.keep('task_move_rejected', pg_temp.fails($q$
    update public.tasks set workstation_id = pg_temp.v('press')
    where id = pg_temp.v('weld_task') $q$)),
  pg_temp.keep('other_site_task_effect_rejected', pg_temp.fails($q$
    insert into public.option_effects
    values (pg_temp.v('option'), pg_temp.v('other_task'), 0.1, 'manual') $q$)),
  pg_temp.keep('other_workstation_effect_rejected', pg_temp.fails($q$
    insert into public.option_effects
    values (pg_temp.v('option'), pg_temp.v('press_task'), 0.1, 'manual') $q$)),
  pg_temp.keep('other_site_save_rejected', pg_temp.fails($q$
    select public.save_improvement_option(pg_temp.v('other_option'), pg_temp.v('other_ws'),
      'x', null, 1, '[]') $q$)),
  pg_temp.keep('bad_effect_save_rejected', pg_temp.fails($q$
    select public.save_improvement_option(null, pg_temp.v('weld'), 'verify-atomic', null, 1,
      jsonb_build_array(jsonb_build_object(
        'task_id', pg_temp.v('press_task'), 'expected_high_risk_ratio', 0.1))) $q$)),
  pg_temp.keep('anon_cannot_execute', not has_function_privilege('anon',
    'public.save_improvement_option(uuid,uuid,text,text,bigint,jsonb)', 'execute'));

-- Separate statements, so the checks after them see what they changed.
select public.save_improvement_option(pg_temp.v('option'), pg_temp.v('weld'), 'verify-option-2', 'note',
  200000, '[]');
update public.improvement_options set title = 'changed' where id = pg_temp.v('other_option');
delete from public.improvement_options where id = pg_temp.v('other_option');
select
  pg_temp.keep('effects_replaced',
    (select title = 'verify-option-2' and description = 'note' and cost = 200000
     from public.improvement_options where id = pg_temp.v('option'))
    and not exists (select 1 from public.option_effects where option_id = pg_temp.v('option'))),
  pg_temp.keep('failed_save_left_nothing',
    not exists (select 1 from public.improvement_options where title = 'verify-atomic'));
reset role;
select pg_temp.keep('other_site_option_untouched',
  (select title = 'verify-other-option' from public.improvement_options
   where id = pg_temp.v('other_option')));

select
  pg_temp.ok('saved_with_effect') as saved_with_effect,
  pg_temp.ok('effects_replaced') as effects_replaced,
  pg_temp.ok('failed_save_left_nothing') as failed_save_left_nothing,
  pg_temp.ok('other_site_insert_rejected') as other_site_insert_rejected,
  pg_temp.ok('move_to_other_site_rejected') as move_to_other_site_rejected,
  pg_temp.ok('move_within_site_rejected') as move_within_site_rejected,
  pg_temp.ok('task_move_rejected') as task_move_rejected,
  pg_temp.ok('other_site_task_effect_rejected') as other_site_task_effect_rejected,
  pg_temp.ok('other_workstation_effect_rejected') as other_workstation_effect_rejected,
  pg_temp.ok('other_site_save_rejected') as other_site_save_rejected,
  pg_temp.ok('bad_effect_save_rejected') as bad_effect_save_rejected,
  pg_temp.ok('other_site_option_untouched') as other_site_option_untouched,
  pg_temp.ok('anon_cannot_execute') as anon_cannot_execute;
rollback;

-- 12. Improvement plans (migration 20261026000001). Run this block on its own, from the check below
--     to rollback. Test options are added to 용접 3번 작업대, 프레스 2라인 and 가공 1라인 as the owner,
--     plans are saved as service_role, then read as the manager of 합성 제1공장.
--     Needs a linked partner account (link-accounts.sql). Expected: every column is true.
do $$
begin
  if not exists (select 1 from public.partner_members) then
    raise exception 'link a partner account with link-accounts.sql before running block 12';
  end if;
end;
$$;
begin;
insert into public.improvement_options (workstation_id, title, cost)
select w.id, t.title, 100000
from public.workstations w
join (values ('WLD-03', 'verify-weld'), ('WLD-03', 'verify-weld-2'),
             ('PRS-02', 'verify-press'), ('MCH-01', 'verify-other')) as t (code, title)
  on t.code = w.code;

select
  set_config('verify.site', (select id::text from public.sites where name = '합성 제1공장'), true),
  set_config('verify.other_site', (select id::text from public.sites where name = '합성 제2공장'), true),
  set_config('verify.manager', (select m.profile_id::text from public.site_members m
    join public.sites s on s.id = m.site_id
    join public.profiles p on p.id = m.profile_id
    where s.name = '합성 제1공장' and p.role = 'manager' limit 1), true),
  set_config('verify.partner', (select profile_id::text from public.partner_members limit 1), true),
  set_config('verify.weld', (select id::text from public.improvement_options where title = 'verify-weld'), true),
  set_config('verify.weld_2', (select id::text from public.improvement_options where title = 'verify-weld-2'), true),
  set_config('verify.press', (select id::text from public.improvement_options where title = 'verify-press'), true),
  set_config('verify.other', (select id::text from public.improvement_options where title = 'verify-other'), true);

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

create function pg_temp.v(name text) returns uuid
language sql
as $$ select current_setting('verify.' || name)::uuid $$;

create function pg_temp.keep(name text, ok boolean) returns void
language sql
as $$ select set_config('verify.ok_' || name, coalesce(ok, false)::text, true) $$;

create function pg_temp.ok(name text) returns boolean
language sql
as $$ select current_setting('verify.ok_' || name)::boolean $$;

-- Items are sent one option per element, as the Server Action sends them.
-- Reductions differ (1.5, 2.5, ...) so the stored total shows they were summed.
create function pg_temp.save(profile text, site text, variadic options text[]) returns uuid
language sql
as $$
  select public.save_improvement_plan(
    pg_temp.v(profile), pg_temp.v(site), 500000, 'mckp-dp-v1', 10, '[]',
    (select coalesce(jsonb_agg(jsonb_build_object(
       'option_id', pg_temp.v(o.name), 'cost', 100000, 'reduction', o.n + 0.5,
       'manual_estimate', true)), '[]')
     from unnest(options) with ordinality as o (name, n)))
$$;

-- The partner joins the site here, so only the role check can reject its save.
insert into public.site_members (site_id, profile_id)
values (pg_temp.v('site'), pg_temp.v('partner'));

set local role service_role;
select set_config('verify.plan', pg_temp.save('manager', 'site', 'weld', 'press')::text, true);
select
  pg_temp.keep('other_site_rejected', pg_temp.fails($q$ select pg_temp.save('manager', 'other_site', 'other') $q$)),
  pg_temp.keep('foreign_option_rejected', pg_temp.fails($q$ select pg_temp.save('manager', 'site', 'other') $q$)),
  pg_temp.keep('partner_rejected', pg_temp.fails($q$ select pg_temp.save('partner', 'site', 'weld') $q$)),
  pg_temp.keep('two_per_workstation_rejected',
    pg_temp.fails($q$ select pg_temp.save('manager', 'site', 'weld', 'weld_2') $q$)),
  pg_temp.keep('stale_cost_rejected', pg_temp.fails($q$
    select public.save_improvement_plan(pg_temp.v('manager'), pg_temp.v('site'), 500000, 'mckp-dp-v1',
      10, '[]', jsonb_build_array(jsonb_build_object(
        'option_id', pg_temp.v('weld'), 'cost', 90000, 'reduction', 1, 'manual_estimate', false))) $q$));
reset role;

select pg_temp.keep('totals_are_item_sums', (
  select p.total_cost = 200000 and p.total_reduction = 4
    and p.total_cost = (select sum(cost) from public.plan_items where plan_id = p.id)
    and p.total_reduction = (select sum(reduction) from public.plan_items where plan_id = p.id)
  from public.improvement_plans p where p.id = pg_temp.v('plan')));

-- Edit and delete the saved options as the owner: the plan keeps its values.
update public.improvement_options set title = 'changed', cost = 1 where id = pg_temp.v('weld');
delete from public.improvement_options where id = pg_temp.v('press');
-- A plan of the other site, which the manager must not see.
insert into public.improvement_plans (site_id, budget, solver_version, created_by, total_cost, total_reduction)
values (pg_temp.v('other_site'), 1, 'mckp-dp-v1', pg_temp.v('manager'), 0, 0);
select pg_temp.keep('snapshot_kept', (
  select count(*) = 2
    and bool_and(cost = 100000)
    and bool_or(option_title = 'verify-weld' and option_id = pg_temp.v('weld') and reduction = 1.5)
    and bool_or(option_title = 'verify-press' and option_id is null and workstation_name = '프레스 2라인')
  from public.plan_items where plan_id = pg_temp.v('plan')));

select set_config(
  'request.jwt.claims',
  json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select
  pg_temp.keep('manager_reads_own_plan', exists (
    select 1 from public.improvement_plans
    where id = pg_temp.v('plan') and created_by = pg_temp.v('manager') and total_cost = 200000)),
  pg_temp.keep('other_site_plan_hidden',
    not exists (select 1 from public.improvement_plans where site_id = pg_temp.v('other_site'))),
  pg_temp.keep('manager_cannot_write', pg_temp.fails($q$
      insert into public.improvement_plans (site_id, budget, solver_version, total_cost, total_reduction)
      values (pg_temp.v('site'), 1, 'x', 0, 0) $q$)
    and pg_temp.fails($q$ update public.plan_items set cost = 1 where plan_id = pg_temp.v('plan') $q$)
    and pg_temp.fails($q$ delete from public.improvement_plans where id = pg_temp.v('plan') $q$)),
  pg_temp.keep('only_service_role_executes',
    not has_function_privilege('authenticated',
      'public.save_improvement_plan(uuid,uuid,bigint,text,numeric,jsonb,jsonb)', 'execute')
    and not has_function_privilege('anon',
      'public.save_improvement_plan(uuid,uuid,bigint,text,numeric,jsonb,jsonb)', 'execute'));
reset role;

select
  pg_temp.ok('totals_are_item_sums') as totals_are_item_sums,
  pg_temp.ok('snapshot_kept') as snapshot_kept,
  pg_temp.ok('other_site_rejected') as other_site_rejected,
  pg_temp.ok('foreign_option_rejected') as foreign_option_rejected,
  pg_temp.ok('partner_rejected') as partner_rejected,
  pg_temp.ok('two_per_workstation_rejected') as two_per_workstation_rejected,
  pg_temp.ok('stale_cost_rejected') as stale_cost_rejected,
  pg_temp.ok('manager_reads_own_plan') as manager_reads_own_plan,
  pg_temp.ok('other_site_plan_hidden') as other_site_plan_hidden,
  pg_temp.ok('manager_cannot_write') as manager_cannot_write,
  pg_temp.ok('only_service_role_executes') as only_service_role_executes;
rollback;
