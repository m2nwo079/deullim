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

-- Only the two synthetic sites, so rows of the demo site (demo-data.sql) do not change the count.
select s.name as site_name, v.label, v.merged, v.workstation_id, v.week_start, v.report_count
from public.workstation_pain_summary v
left join public.sites s on s.id = v.site_id
where s.name in ('합성 제1공장', '합성 제2공장')
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
select g.parent_group, g.workstation_count, g.merged, g.visible, g.reason
from public.pain_group_visibility g
join public.sites s on s.id = g.site_id
where s.name in ('합성 제1공장', '합성 제2공장')
order by g.visible, g.parent_group;
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
    select t.id, 450, 15, at
    from public.tasks t
    join public.workstations w on w.id = t.workstation_id
    join public.sites site on site.id = w.site_id
    -- Task names repeat across sites (the demo site has a 하부 용접 too).
    where t.name = task_name and site.name in ('합성 제1공장', '합성 제2공장')
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
   join public.tasks t on t.id = v.task_id
   join public.workstations w on w.id = t.workstation_id
   where t.name = '하부 용접' and w.code = 'WLD-03') = 'high'
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
   join public.tasks t on t.id = v.task_id
   join public.workstations w on w.id = t.workstation_id
   where t.name = '하부 용접' and w.code = 'WLD-03') as report_columns_from_latest,
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

-- 13. Ad hoc surveys (migration 20261028000001). Run this block on its own, from begin to rollback.
--     Surveys are written as the manager of 합성 제1공장, as the console does.
--     Expected: every column is true.
begin;
select
  set_config('verify.weld', (select id::text from public.workstations where code = 'WLD-03'), true),
  set_config('verify.press', (select id::text from public.workstations where code = 'PRS-02'), true),
  set_config('verify.other_ws', (select id::text from public.workstations where code = 'MCH-01'), true),
  set_config('verify.manager', (select m.profile_id::text from public.site_members m
    join public.sites s on s.id = m.site_id
    join public.profiles p on p.id = m.profile_id
    where s.name = '합성 제1공장' and p.role = 'manager' limit 1), true);

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

select set_config(
  'request.jwt.claims',
  json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date, note)
values (pg_temp.v('weld'), 'new_work', date '2026-10-14', date '2026-11-14', 'verify');
select
  pg_temp.keep('manager_inserts', exists (
    select 1 from public.adhoc_surveys
    where workstation_id = pg_temp.v('weld') and status = 'open' and created_at is not null)),
  pg_temp.keep('bad_reason_rejected', pg_temp.fails($q$
    insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date)
    values (pg_temp.v('press'), '신고 누적', date '2026-10-14', date '2026-11-14') $q$)),
  pg_temp.keep('due_out_of_range_rejected', pg_temp.fails($q$
    insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date)
    values (pg_temp.v('press'), 'disease', date '2026-10-14', date '2026-11-15') $q$)
    and pg_temp.fails($q$
    insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date)
    values (pg_temp.v('press'), 'disease', date '2026-10-14', date '2026-10-14') $q$)),
  pg_temp.keep('long_note_rejected', pg_temp.fails($q$
    insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date, note)
    values (pg_temp.v('press'), 'disease', date '2026-10-14', date '2026-11-14', repeat('가', 501)) $q$)),
  pg_temp.keep('second_open_rejected', pg_temp.fails($q$
    insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date)
    values (pg_temp.v('weld'), 'work_change', date '2026-10-20', date '2026-11-20') $q$)),
  pg_temp.keep('other_site_rejected', pg_temp.fails($q$
    insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date)
    values (pg_temp.v('other_ws'), 'new_work', date '2026-10-14', date '2026-11-14') $q$)),
  pg_temp.keep('done_needs_completed_on', pg_temp.fails($q$
    update public.adhoc_surveys set status = 'done' where workstation_id = pg_temp.v('weld') $q$)
    and pg_temp.fails($q$
    update public.adhoc_surveys set status = 'done', completed_on = date '2026-10-13'
    where workstation_id = pg_temp.v('weld') $q$));
update public.adhoc_surveys set status = 'done', completed_on = date '2026-10-20'
where workstation_id = pg_temp.v('weld');
insert into public.adhoc_surveys (workstation_id, trigger_reason, occurred_on, due_date)
values (pg_temp.v('weld'), 'work_change', date '2026-10-20', date '2026-11-20');
select pg_temp.keep('reopen_after_done', (
  select count(*) = 2 and count(*) filter (where status = 'open') = 1
  from public.adhoc_surveys where workstation_id = pg_temp.v('weld')));
reset role;

select
  pg_temp.ok('manager_inserts') as manager_inserts,
  pg_temp.ok('bad_reason_rejected') as bad_reason_rejected,
  pg_temp.ok('due_out_of_range_rejected') as due_out_of_range_rejected,
  pg_temp.ok('long_note_rejected') as long_note_rejected,
  pg_temp.ok('second_open_rejected') as second_open_rejected,
  pg_temp.ok('other_site_rejected') as other_site_rejected,
  pg_temp.ok('done_needs_completed_on') as done_needs_completed_on,
  pg_temp.ok('reopen_after_done') as reopen_after_done;
rollback;

-- 14. Demo data (supabase/demo-data.sql). Run this block on its own, from the check below to
--     rollback, after loading the demo data. Counts and levels are read as the owner; what the
--     console shows (groups, screening alert, surveys) is read as a manager of the demo site.
--     Expected: every column is true.
begin;
-- BEGIN GENERATED: site name
select set_config('demo.site_name', '시연 공장', true);
-- END GENERATED: site name
do $$
begin
  if not exists (select 1 from public.sites where name = current_setting('demo.site_name')) then
    raise exception 'load demo-data.sql before running block 14';
  end if;
end;
$$;

select
  set_config('verify.demo_site',
    (select id::text from public.sites where name = current_setting('demo.site_name')), true),
  set_config('verify.demo_manager', (select m.profile_id::text from public.site_members m
    join public.sites s on s.id = m.site_id
    join public.profiles p on p.id = m.profile_id
    where s.name = current_setting('demo.site_name') and p.role = 'manager' limit 1), true);

create function pg_temp.v(name text) returns uuid
language sql
as $$ select current_setting('verify.' || name)::uuid $$;

create function pg_temp.keep(name text, ok boolean) returns void
language sql
as $$ select set_config('verify.ok_' || name, coalesce(ok, false)::text, true) $$;

create function pg_temp.ok(name text) returns boolean
language sql
as $$ select current_setting('verify.ok_' || name)::boolean $$;

-- Latest assessments of the demo site with their session's frame count.
create temporary view demo_latest as
select a.*, c.frame_count
from public.assessments a
join public.capture_sessions c on c.id = a.session_id
join public.tasks t on t.id = c.task_id
join public.workstations w on w.id = t.workstation_id
where w.site_id = pg_temp.v('demo_site');

select
  pg_temp.keep('manager_linked', current_setting('verify.demo_manager', true) <> ''),
  pg_temp.keep('counts', (select count(*) = 9 from public.workstations where site_id = pg_temp.v('demo_site'))
    and (select count(*) = 15 from public.tasks t join public.workstations w on w.id = t.workstation_id
         where w.site_id = pg_temp.v('demo_site'))
    and (select count(*) = 12 from demo_latest)
    and (select count(*) = 10 from public.improvement_options o
         join public.workstations w on w.id = o.workstation_id where w.site_id = pg_temp.v('demo_site'))),
  pg_temp.keep('all_four_levels', (
    select count(*) filter (where level = 'very-high') = 2
      and count(*) filter (where level = 'high') = 3
      and count(*) filter (where level = 'caution') = 4
      and count(*) filter (where level = 'low') = 3
    from demo_latest)),
  pg_temp.keep('levels_match_scores', (
    select bool_and(
      level = case when score_p90 <= 3 then 'low' when score_p90 <= 7 then 'caution'
                   when score_p90 <= 10 then 'high' else 'very-high' end
      and algorithm_version = 'reba-2d-v1'
      and (score_p90 >= 8) = (high_risk_ratio > 0.1)
      and (select sum(value::numeric) from jsonb_each_text(part_summary -> 'trunk'))
        = round(valid_frame_ratio * frame_count))
    from demo_latest)),
  pg_temp.keep('effects_manual', (
    select count(*) > 0 and bool_and(e.source = 'manual')
    from public.option_effects e
    join public.improvement_options o on o.id = e.option_id
    join public.workstations w on w.id = o.workstation_id
    where w.site_id = pg_temp.v('demo_site')));

select set_config(
  'request.jwt.claims',
  json_build_object('sub', pg_temp.v('demo_manager'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select
  pg_temp.keep('merged_and_hidden_groups', (
    select bool_or(parent_group = '물류' and merged and visible)
      and bool_or(parent_group = '검사' and not visible and reason = 'single_workstation')
    from public.pain_group_visibility where site_id = pg_temp.v('demo_site'))
    and not exists (select 1 from public.workstation_pain_summary
                    where site_id = pg_temp.v('demo_site') and parent_group = '검사')),
  pg_temp.keep('alert_units', (
    select array_agg(label order by label) = array['물류', '용접 1라인']
    from (
      select label
      from public.workstation_pain_summary
      where site_id = pg_temp.v('demo_site')
        and week_start >= date_trunc('week', now() at time zone 'Asia/Seoul')::date - 21
      group by label
      having sum(moderate_count + severe_count + very_severe_count) >= 3
    ) as units)),
  pg_temp.keep('surveys', (
    select count(*) = 5
      and count(*) filter (where status = 'open') = 3
      and count(*) filter (where status = 'open'
        and due_date between (now() at time zone 'Asia/Seoul')::date
          and (now() at time zone 'Asia/Seoul')::date + 7) = 1
      and count(distinct trigger_reason) = 3
    from public.adhoc_surveys a
    join public.workstations w on w.id = a.workstation_id
    where w.site_id = pg_temp.v('demo_site')));
reset role;

select
  pg_temp.ok('manager_linked') as manager_linked,
  pg_temp.ok('counts') as counts,
  pg_temp.ok('all_four_levels') as all_four_levels,
  pg_temp.ok('levels_match_scores') as levels_match_scores,
  pg_temp.ok('effects_manual') as effects_manual,
  pg_temp.ok('merged_and_hidden_groups') as merged_and_hidden_groups,
  pg_temp.ok('alert_units') as alert_units,
  pg_temp.ok('surveys') as surveys;
rollback;

-- 15. Site-scoped console lists (fix/site-scoped-lists). Run this block on its own, from the check
--     below to rollback, after loading the demo data. A manager of both 시연 공장 and 합성 제1공장
--     reads each site apart, and cannot write to 합성 제2공장 or link an effect across sites.
--     Expected: every column is true.
begin;
-- BEGIN GENERATED: site name for block 15
select set_config('demo.site_name', '시연 공장', true);
-- END GENERATED: site name for block 15
do $$
begin
  if not exists (select 1 from public.sites where name = current_setting('demo.site_name')) then
    raise exception 'load demo-data.sql before running block 15';
  end if;
end;
$$;

-- Ids are read as the owner; the checks below run as the manager.
select
  set_config('verify.demo_site',
    (select id::text from public.sites where name = current_setting('demo.site_name')), true),
  set_config('verify.synthetic_site',
    (select id::text from public.sites where name = '합성 제1공장'), true),
  set_config('verify.manager', (select m.profile_id::text from public.site_members m
    join public.sites s on s.id = m.site_id
    join public.profiles p on p.id = m.profile_id
    where s.name = current_setting('demo.site_name') and p.role = 'manager' limit 1), true),
  set_config('verify.demo_ws', (select w.id::text from public.workstations w
    join public.sites s on s.id = w.site_id
    where s.name = current_setting('demo.site_name') and w.code = 'LOG-01'), true),
  set_config('verify.other_ws', (select w.id::text from public.workstations w
    join public.sites s on s.id = w.site_id
    where s.name = '합성 제2공장' and w.code = 'MCH-01'), true),
  set_config('verify.demo_option', (select o.id::text from public.improvement_options o
    join public.workstations w on w.id = o.workstation_id
    join public.sites s on s.id = w.site_id
    where s.name = current_setting('demo.site_name') and o.title = '리프트 테이블'), true),
  set_config('verify.synthetic_task', (select t.id::text from public.tasks t
    join public.workstations w on w.id = t.workstation_id
    join public.sites s on s.id = w.site_id
    where s.name = '합성 제1공장' order by t.name limit 1), true);

create function pg_temp.v(name text) returns uuid
language sql
as $$ select current_setting('verify.' || name)::uuid $$;

create function pg_temp.keep(name text, ok boolean) returns void
language sql
as $$ select set_config('verify.ok_' || name, coalesce(ok, false)::text, true) $$;

create function pg_temp.ok(name text) returns boolean
language sql
as $$ select current_setting('verify.ok_' || name)::boolean $$;

-- The error code a statement raises, or 'none' when it succeeds.
create function pg_temp.sqlstate_of(statement text) returns text
language plpgsql
as $$
begin
  execute statement;
  return 'none';
exception when others then
  return sqlstate;
end;
$$;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select
  pg_temp.keep('two_sites', (
    select array_agg(name order by name) = array['시연 공장', '합성 제1공장'] from public.sites)),
  pg_temp.keep('lists_by_site', (
    select count(*) = 9 from public.workstations where site_id = pg_temp.v('demo_site'))
    and (select count(*) = 1 from public.workstations
         where site_id = pg_temp.v('demo_site') and name = '자재 입고장')
    and (select count(*) = 1 from public.workstations
         where site_id = pg_temp.v('synthetic_site') and name = '자재 입고장')
    and (select count(*) = 10 from public.improvement_options
         where workstation_id in (select id from public.workstations
                                  where site_id = pg_temp.v('demo_site')))
    and not exists (select 1 from public.workstations where id = pg_temp.v('other_ws'))),
  pg_temp.keep('issue_own_site', pg_temp.sqlstate_of(format(
    'select public.issue_entry_token(%L, %L)', pg_temp.v('demo_ws'), 'verify-own-site')) = 'none'),
  pg_temp.keep('issue_other_site_rejected', pg_temp.sqlstate_of(format(
    'select public.issue_entry_token(%L, %L)', pg_temp.v('other_ws'), 'verify-other-site'))
    = '42501'),
  pg_temp.keep('option_other_site_rejected', pg_temp.sqlstate_of(format(
    'select public.save_improvement_option(null, %L, %L, null, 1000, %L)',
    pg_temp.v('other_ws'), 'verify', '[]')) = '42501'),
  pg_temp.keep('effect_across_sites_rejected', pg_temp.sqlstate_of(format(
    'insert into public.option_effects (option_id, task_id, expected_high_risk_ratio, source)
     values (%L, %L, 0.1, %L)', pg_temp.v('demo_option'), pg_temp.v('synthetic_task'), 'manual'))
    = '23514');
reset role;

select
  pg_temp.ok('two_sites') as two_sites,
  pg_temp.ok('lists_by_site') as lists_by_site,
  pg_temp.ok('issue_own_site') as issue_own_site,
  pg_temp.ok('issue_other_site_rejected') as issue_other_site_rejected,
  pg_temp.ok('option_other_site_rejected') as option_other_site_rejected,
  pg_temp.ok('effect_across_sites_rejected') as effect_across_sites_rejected;
rollback;

-- 16. Simulation effects (migration 20261029000001). Run this block on its own, from the check
--     below to rollback, after loading the demo data. A manager of the demo site issues one-time
--     tokens, service_role saves a capture, and the manager edits the option afterwards.
--     Expected: every column is true.
begin;
-- BEGIN GENERATED: site name for block 16
select set_config('demo.site_name', '시연 공장', true);
-- END GENERATED: site name for block 16
do $$
begin
  if not exists (select 1 from public.sites where name = current_setting('demo.site_name')) then
    raise exception 'load demo-data.sql before running block 16';
  end if;
end;
$$;

-- An option of 합성 제2공장, which the demo manager does not manage.
insert into public.improvement_options (workstation_id, title, cost)
select w.id, 'verify other site', 1000
from public.workstations w
join public.sites s on s.id = w.site_id
where s.name = '합성 제2공장' and w.code = 'MCH-01';

-- Ids are read as the owner; the checks below run as the manager, service_role or anon.
-- 볼트 체결 (ASM-A) has a manual effect from 공구 밸런서 in the demo data.
select
  set_config('verify.manager', (select m.profile_id::text from public.site_members m
    join public.sites s on s.id = m.site_id
    join public.profiles p on p.id = m.profile_id
    where s.name = current_setting('demo.site_name') and p.role = 'manager' limit 1), true),
  set_config('verify.option', (select o.id::text from public.improvement_options o
    join public.workstations w on w.id = o.workstation_id
    join public.sites s on s.id = w.site_id
    where s.name = current_setting('demo.site_name') and o.title = '공구 밸런서'), true),
  set_config('verify.workstation', (select w.id::text from public.workstations w
    join public.sites s on s.id = w.site_id
    where s.name = current_setting('demo.site_name') and w.code = 'ASM-A'), true),
  set_config('verify.task', (select t.id::text from public.tasks t
    join public.workstations w on w.id = t.workstation_id
    join public.sites s on s.id = w.site_id
    where s.name = current_setting('demo.site_name') and w.code = 'ASM-A'
      and t.name = '볼트 체결'), true),
  set_config('verify.other_option', (select o.id::text from public.improvement_options o
    where o.title = 'verify other site'), true),
  set_config('verify.latest_before', (select count(*)::text from public.task_latest_assessments), true),
  set_config('verify.assessments_before', (select count(*)::text from public.assessments), true);

create function pg_temp.v(name text) returns uuid
language sql
as $$ select current_setting('verify.' || name)::uuid $$;

create function pg_temp.keep(name text, ok boolean) returns void
language sql
as $$ select set_config('verify.ok_' || name, coalesce(ok, false)::text, true) $$;

create function pg_temp.ok(name text) returns boolean
language sql
as $$ select current_setting('verify.ok_' || name)::boolean $$;

-- The error code a statement raises, or 'none' when it succeeds.
create function pg_temp.sqlstate_of(statement text) returns text
language plpgsql
as $$
begin
  execute statement;
  return 'none';
exception when others then
  return sqlstate;
end;
$$;

-- A 64-character hex hash, different for each n.
create function pg_temp.hash(n integer) returns text
language sql
as $$ select encode(sha256(('verify-simulation-' || n)::bytea), 'hex') $$;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select set_config('verify.token', (select token_id::text
  from public.issue_simulation_token(pg_temp.v('option'), pg_temp.v('task'), pg_temp.hash(1))), true);
select
  pg_temp.keep('other_site_rejected', pg_temp.sqlstate_of(format(
    'select public.issue_simulation_token(%L, %L, %L)',
    pg_temp.v('other_option'), pg_temp.v('task'), pg_temp.hash(2))) = '42501'),
  pg_temp.keep('direct_writes_rejected', pg_temp.sqlstate_of(format(
    'insert into public.simulation_tokens (token_hash, option_id, task_id, created_by)
     values (%L, %L, %L, %L)',
    pg_temp.hash(3), pg_temp.v('option'), pg_temp.v('task'), pg_temp.v('manager'))) = '42501'
    and pg_temp.sqlstate_of(format(
      'update public.option_effects set source = %L where option_id = %L and task_id = %L',
      'simulation', pg_temp.v('option'), pg_temp.v('task'))) = '42501'),
  pg_temp.keep('save_needs_service_role', pg_temp.sqlstate_of(format(
    'select public.save_simulation_capture(%L, 10, 15, %L, %L, 1, 0.05, 6, %L, %L)',
    pg_temp.v('token'), '{}', '{}', 'caution', 'reba-2d-v1')) = '42501');
reset role;

set local role anon;
select pg_temp.keep('anon_cannot_issue', pg_temp.sqlstate_of(format(
  'select public.issue_simulation_token(%L, %L, %L)',
  pg_temp.v('option'), pg_temp.v('task'), pg_temp.hash(4))) = '42501');
reset role;

-- An expired token, made by the owner.
insert into public.simulation_tokens (token_hash, option_id, task_id, created_by, expires_at)
values (pg_temp.hash(5), pg_temp.v('option'), pg_temp.v('task'), pg_temp.v('manager'),
  now() - interval '1 minute');

set local role service_role;
select set_config('verify.capture', coalesce(public.save_simulation_capture(
  pg_temp.v('token'), 150, 15, '{"load_category": "lt5"}', '{"trunk": {"1": 150}}',
  1, 0.02, 6, 'caution', 'reba-2d-v1')::text, ''), true);
select pg_temp.keep('used_and_expired_rejected',
  public.save_simulation_capture(pg_temp.v('token'), 150, 15, '{}', '{}', 1, 0, 1, 'low',
    'reba-2d-v1') is null
  and public.save_simulation_capture(
    (select id from public.simulation_tokens where token_hash = pg_temp.hash(5)),
    150, 15, '{}', '{}', 1, 0, 1, 'low', 'reba-2d-v1') is null);
reset role;

select pg_temp.keep('effect_saved', (
  select e.source = 'simulation' and e.expected_high_risk_ratio = 0.02
    and e.capture_id::text = current_setting('verify.capture')
  from public.option_effects e
  where e.option_id = pg_temp.v('option') and e.task_id = pg_temp.v('task'))
  and (select used_at is not null from public.simulation_tokens where id = pg_temp.v('token'))
  and (select task_inputs ->> 'load_category' = 'lt5' from public.simulation_captures
       where id::text = current_setting('verify.capture')));

-- Not in the latest-assessment view or in assessments.
select
  set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.keep('not_an_assessment',
  (select count(*) from public.task_latest_assessments)::text
    = current_setting('verify.latest_before')
  and (select count(*) from public.assessments)::text = current_setting('verify.assessments_before'));

-- Editing the option keeps the simulation effect; a manual value for that task is refused.
select pg_temp.keep('survives_edit', pg_temp.sqlstate_of(format(
    'select public.save_improvement_option(%L, %L, %L, null, 600000, %L)',
    pg_temp.v('option'), pg_temp.v('workstation'), '공구 밸런서', '[]')) = 'none'
  and (select source = 'simulation' from public.option_effects
       where option_id = pg_temp.v('option') and task_id = pg_temp.v('task'))
  and pg_temp.sqlstate_of(format(
    'select public.save_improvement_option(%L, %L, %L, null, 600000, %L)',
    pg_temp.v('option'), pg_temp.v('workstation'), '공구 밸런서',
    json_build_array(json_build_object('task_id', pg_temp.v('task'),
      'expected_high_risk_ratio', 0.01)))) = '23505');

-- The hourly limit: with the issued and the expired token, 18 more pass and the 21st is refused.
select pg_temp.keep('hourly_limit', (
  select count(*) = 18 from generate_series(10, 27) as n
  where pg_temp.sqlstate_of(format('select public.issue_simulation_token(%L, %L, %L)',
    pg_temp.v('option'), pg_temp.v('task'), pg_temp.hash(n))) = 'none')
  and pg_temp.sqlstate_of(format('select public.issue_simulation_token(%L, %L, %L)',
    pg_temp.v('option'), pg_temp.v('task'), pg_temp.hash(28))) = '54000');
reset role;

select
  pg_temp.ok('other_site_rejected') as other_site_rejected,
  pg_temp.ok('direct_writes_rejected') as direct_writes_rejected,
  pg_temp.ok('save_needs_service_role') as save_needs_service_role,
  pg_temp.ok('anon_cannot_issue') as anon_cannot_issue,
  pg_temp.ok('used_and_expired_rejected') as used_and_expired_rejected,
  pg_temp.ok('effect_saved') as effect_saved,
  pg_temp.ok('not_an_assessment') as not_an_assessment,
  pg_temp.ok('survives_edit') as survives_edit,
  pg_temp.ok('hourly_limit') as hourly_limit;
rollback;

-- 17. Improvement requests and quotes (migration 20261030000001). Run this block on its own,
--     from the check below to rollback, after loading the demo data and linking the partner
--     account (link-accounts.sql). Requests and quotes are made by the owner, then read and
--     changed as the demo manager and as the partner.
--     Expected: every column is true.
begin;
-- BEGIN GENERATED: site name for block 17
select set_config('demo.site_name', '시연 공장', true);
-- END GENERATED: site name for block 17
do $$
begin
  if not exists (select 1 from public.sites where name = current_setting('demo.site_name')) then
    raise exception 'load demo-data.sql before running block 17';
  end if;
  if not exists (select 1 from public.partner_members m join public.partners p on p.id = m.partner_id
                 where p.company_name = '합성 설비 업체') then
    raise exception 'link the partner account (link-accounts.sql) before running block 17';
  end if;
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

-- The error code a statement raises, or 'none' when it succeeds.
create function pg_temp.sqlstate_of(statement text) returns text
language plpgsql
as $$
begin
  execute statement;
  return 'none';
exception when others then
  return sqlstate;
end;
$$;

create function pg_temp.option_id(p_site text, p_title text) returns uuid
language sql
as $$
  select o.id from public.improvement_options o
  join public.workstations w on w.id = o.workstation_id
  join public.sites s on s.id = w.site_id
  where s.name = p_site and o.title = p_title
$$;

-- Another company and an option of 합성 제2공장, which the demo manager does not manage.
insert into public.partners (company_name) values ('verify other company');
insert into public.improvement_options (workstation_id, title, cost)
select w.id, 'verify other site', 1000
from public.workstations w join public.sites s on s.id = w.site_id
where s.name = '합성 제2공장' and w.code = 'MCH-01';

select
  set_config('verify.manager', (select m.profile_id::text from public.site_members m
    join public.sites s on s.id = m.site_id
    join public.profiles p on p.id = m.profile_id
    where s.name = current_setting('demo.site_name') and p.role = 'manager' limit 1), true),
  set_config('verify.partner_user', (select m.profile_id::text from public.partner_members m
    join public.partners p on p.id = m.partner_id
    where p.company_name = '합성 설비 업체' limit 1), true),
  set_config('verify.partner', (select id::text from public.partners
    where company_name = '합성 설비 업체'), true),
  set_config('verify.other_partner', (select id::text from public.partners
    where company_name = 'verify other company'), true),
  set_config('verify.draft_option', pg_temp.option_id(current_setting('demo.site_name'), '리프트 테이블')::text, true),
  set_config('verify.open_option', pg_temp.option_id(current_setting('demo.site_name'), '공구 밸런서')::text, true),
  set_config('verify.closed_option', pg_temp.option_id(current_setting('demo.site_name'), '보조 롤러')::text, true),
  set_config('verify.other_option', pg_temp.option_id('합성 제2공장', 'verify other site')::text, true);

-- A draft, an open and a closed request on the demo site, and an open one on 합성 제2공장.
insert into public.improvement_requests
  (workstation_id, option_id, title, status, opened_at, closed_at, created_by)
select o.workstation_id, o.id, v.title, v.status, v.opened_at, v.closed_at, pg_temp.v('manager')
from (values
  (pg_temp.v('draft_option'), 'verify draft', 'draft', null::timestamptz, null::timestamptz),
  (pg_temp.v('open_option'), 'verify open', 'open', now(), null),
  (pg_temp.v('closed_option'), 'verify closed', 'closed', now(), now()),
  (pg_temp.v('other_option'), 'verify other site', 'open', now(), null)
) as v (option_id, title, status, opened_at, closed_at)
join public.improvement_options o on o.id = v.option_id;

select
  set_config('verify.draft', (select id::text from public.improvement_requests where title = 'verify draft'), true),
  set_config('verify.open', (select id::text from public.improvement_requests where title = 'verify open'), true),
  set_config('verify.other_request', (select id::text from public.improvement_requests where title = 'verify other site'), true);

-- The other company's quotes on the open request and on 합성 제2공장.
insert into public.quotes (request_id, partner_id, price, lead_time_days)
values (pg_temp.v('open'), pg_temp.v('other_partner'), 1500000, 20),
  (pg_temp.v('other_request'), pg_temp.v('other_partner'), 900000, 10);
select set_config('verify.other_site_quote', (select id::text from public.quotes
  where request_id = pg_temp.v('other_request')), true);

-- As the partner.
select set_config('request.jwt.claims',
  json_build_object('sub', pg_temp.v('partner_user'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.quotes (request_id, partner_id, price, lead_time_days, note)
values (pg_temp.v('open'), pg_temp.v('partner'), 1200000, 14, 'verify note');
select set_config('verify.quote', (select id::text from public.quotes
  where request_id = pg_temp.v('open') and partner_id = pg_temp.v('partner')), true);
select
  pg_temp.keep('partner_reads_open_only', (
    select array_agg(title order by title) = array['verify open', 'verify other site']
    from public.improvement_requests)),
  pg_temp.keep('other_quotes_hidden', (
    select count(*) = 1 and bool_and(partner_id = pg_temp.v('partner')) from public.quotes)),
  pg_temp.keep('partner_columns_locked',
    pg_temp.sqlstate_of(format('update public.quotes set status = %L where id = %L',
      'accepted', pg_temp.v('quote'))) = '42501'
    and pg_temp.sqlstate_of(format('update public.quotes set request_id = %L where id = %L',
      pg_temp.v('other_request'), pg_temp.v('quote'))) = '42501'
    and pg_temp.sqlstate_of(format('update public.quotes set partner_id = %L where id = %L',
      pg_temp.v('other_partner'), pg_temp.v('quote'))) = '42501'
    and pg_temp.sqlstate_of(format('select public.open_request(%L)', pg_temp.v('draft'))) = '42501'),
  pg_temp.keep('partner_no_console_data',
    (select count(*) = 0 from public.workstations)
    and (select count(*) = 0 from public.tasks)
    and (select count(*) = 0 from public.improvement_options)
    and (select count(*) = 0 from public.assessments)
    and (select count(*) = 0 from public.task_latest_assessments)
    and (select count(*) = 0 from public.workstation_pain_summary)
    and (select count(*) = 0 from public.pain_group_visibility)
    and (select count(*) = 0 from public.adhoc_surveys)
    and (select count(*) = 0 from public.improvement_plans)
    and (select count(*) = 0 from public.sites)
    and pg_temp.sqlstate_of('select 1 from public.pain_reports') = '42501');
reset role;
select set_config('verify.quote_seen_at',
  (select updated_at::text from public.quotes where id = pg_temp.v('quote')), true);

-- As the manager.
select set_config('request.jwt.claims',
  json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text, true);
set local role authenticated;
select
  pg_temp.keep('manager_writes_own_site_only',
    pg_temp.sqlstate_of(format(
      'insert into public.improvement_requests (workstation_id, option_id, title)
       select workstation_id, id, %L from public.improvement_options where id = %L',
      'verify', pg_temp.v('other_option'))) = 'none'
    and not exists (select 1 from public.improvement_requests where option_id = pg_temp.v('other_option')
                    and title = 'verify')
    and pg_temp.sqlstate_of(format(
      'update public.improvement_requests set status = %L where id = %L',
      'closed', pg_temp.v('open'))) = '42501'
    and pg_temp.sqlstate_of(format('select public.accept_quote(%L, 900000, now())',
      pg_temp.v('other_site_quote'))) = '42501'),
  pg_temp.keep('company_names', (
    select array_agg(company_name order by company_name) = array['verify other company', '합성 설비 업체']
    from public.partners));
reset role;

-- A direct insert with the other site's ids (read by the owner) is refused: the trigger cannot
-- see the option (23514) or RLS refuses the row (42501), and nothing is added.
select set_config('verify.other_ws',
  (select workstation_id::text from public.improvement_options where id = pg_temp.v('other_option')), true);
select set_config('request.jwt.claims',
  json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.keep('other_site_request_rejected', pg_temp.sqlstate_of(format(
  'insert into public.improvement_requests (workstation_id, option_id, title) values (%L, %L, %L)',
  pg_temp.v('other_ws'), pg_temp.v('other_option'), 'verify')) in ('42501', '23514'));
reset role;
select pg_temp.keep('other_site_request_rejected', pg_temp.ok('other_site_request_rejected')
  and not exists (select 1 from public.improvement_requests where title = 'verify'));

-- The partner changes the price after the manager saw it: accepting the old one is refused.
select set_config('request.jwt.claims',
  json_build_object('sub', pg_temp.v('partner_user'), 'role', 'authenticated')::text, true);
set local role authenticated;
update public.quotes set price = 1100000 where id = pg_temp.v('quote');
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', pg_temp.v('manager'), 'role', 'authenticated')::text, true);
set local role authenticated;
select pg_temp.keep('stale_quote_rejected',
  pg_temp.sqlstate_of(format('select public.accept_quote(%L, 1200000, %L)',
    pg_temp.v('quote'), current_setting('verify.quote_seen_at'))) = '40001'
  and pg_temp.sqlstate_of(format('select public.accept_quote(%L, 1100000, %L)',
    pg_temp.v('quote'), current_setting('verify.quote_seen_at'))) = '40001');
select pg_temp.keep('active_request_blocks_delete', pg_temp.sqlstate_of(format(
  'delete from public.improvement_options where id = %L', pg_temp.v('draft_option'))) = 'none'
  and exists (select 1 from public.improvement_options where id = pg_temp.v('draft_option')));
select public.accept_quote(pg_temp.v('quote'), 1100000,
  (select updated_at from public.quotes where id = pg_temp.v('quote')));
select pg_temp.keep('accepted', (
    select status = 'closed' and closed_at is not null
    from public.improvement_requests where id = pg_temp.v('open'))
  and (select array_agg(status order by price) = array['accepted', 'rejected']
       from public.quotes where request_id = pg_temp.v('open'))
  and (select cost = 1100000 and quote_id = pg_temp.v('quote')
       from public.improvement_options where id = pg_temp.v('open_option')));
-- A cost typed by the manager clears the quote link.
select public.save_improvement_option(pg_temp.v('open_option'),
  (select workstation_id from public.improvement_options where id = pg_temp.v('open_option')),
  '공구 밸런서', null, 1000000, '[]');
select pg_temp.keep('typed_cost_clears_quote', (
  select cost = 1000000 and quote_id is null
  from public.improvement_options where id = pg_temp.v('open_option')));
reset role;

-- After closing, the partner still sees the request it quoted on but cannot change the quote.
select set_config('request.jwt.claims',
  json_build_object('sub', pg_temp.v('partner_user'), 'role', 'authenticated')::text, true);
set local role authenticated;
with changed as (
  update public.quotes set price = 1 where id = pg_temp.v('quote') returning 1
)
select pg_temp.keep('closed_quote_locked', (select count(*) = 0 from changed)
  and exists (select 1 from public.improvement_requests where id = pg_temp.v('open')));
with removed as (
  delete from public.quotes where id = pg_temp.v('quote') returning 1
)
select pg_temp.keep('closed_quote_locked', pg_temp.ok('closed_quote_locked')
  and (select count(*) = 0 from removed));
reset role;

select pg_temp.keep('functions_for_authenticated_only', (
  select bool_and(not has_function_privilege('anon', f, 'execute')
    and not has_function_privilege('service_role', f, 'execute')
    and has_function_privilege('authenticated', f, 'execute'))
  from unnest(array['public.open_request(uuid)', 'public.close_request(uuid)',
    'public.accept_quote(uuid,bigint,timestamptz)']) as f));

select
  pg_temp.ok('partner_reads_open_only') as partner_reads_open_only,
  pg_temp.ok('other_quotes_hidden') as other_quotes_hidden,
  pg_temp.ok('partner_columns_locked') as partner_columns_locked,
  pg_temp.ok('partner_no_console_data') as partner_no_console_data,
  pg_temp.ok('manager_writes_own_site_only') as manager_writes_own_site_only,
  pg_temp.ok('other_site_request_rejected') as other_site_request_rejected,
  pg_temp.ok('company_names') as company_names,
  pg_temp.ok('stale_quote_rejected') as stale_quote_rejected,
  pg_temp.ok('active_request_blocks_delete') as active_request_blocks_delete,
  pg_temp.ok('accepted') as accepted,
  pg_temp.ok('typed_cost_clears_quote') as typed_cost_clears_quote,
  pg_temp.ok('closed_quote_locked') as closed_quote_locked,
  pg_temp.ok('functions_for_authenticated_only') as functions_for_authenticated_only;
rollback;
