-- Synthetic demo site for presenting the console (docs/deployment.md, 시연 데이터).
-- No real company, person, account or token. Assessments and simulation captures are scores of
-- synthetic postures (tests/fixtures/demo_data_v1.json, demo_extra_v1.json); nothing comes from
-- AI Hub data or real video. The equipment companies are fictional and marked "(가상)".
--
-- Run after the migrations, seed.sql and link-accounts.sql, as one script in the SQL editor.
-- To load it again, run demo-cleanup.sql first. Times are relative to now(), so load it on the
-- day of the presentation (docs/deployment.md).
--
-- Generated parts are written by tests from the fixture; edit the fixture, not those parts:
--   DEMO_SQL_WRITE=1 npm run test -- demo   (in web/)

begin;

-- BEGIN GENERATED: site name
select set_config('demo.site_name', '시연 공장', true);
-- END GENERATED: site name
-- BEGIN GENERATED: partner names
select set_config('demo.partners', '["가람설비(가상)","누리자동화(가상)","다온기계(가상)"]', true);
-- END GENERATED: partner names

-- Running this again would add a second demo site. The demo site's managers are copied from
-- 합성 제1공장, so no email address appears here.
do $$
begin
  if exists (select 1 from public.sites where name = current_setting('demo.site_name')) then
    raise exception 'demo-data.sql has already been applied; run demo-cleanup.sql first';
  end if;
  if not exists (
    select 1
    from public.site_members m
    join public.sites s on s.id = m.site_id
    join public.profiles p on p.id = m.profile_id
    where s.name = '합성 제1공장' and p.role = 'manager'
  ) then
    raise exception 'no manager of 합성 제1공장 to copy; run link-accounts.sql first';
  end if;
  if exists (
    select 1 from public.partners
    where company_name in (select jsonb_array_elements_text(current_setting('demo.partners')::jsonb))
  ) then
    raise exception 'demo companies already exist; run demo-cleanup.sql first';
  end if;
  if (select count(*) from public.partners where company_name = '합성 설비 업체') <> 1 then
    raise exception 'expected one 합성 설비 업체 from seed.sql';
  end if;
end;
$$;

insert into public.sites (name) values (current_setting('demo.site_name'));

insert into public.site_members (site_id, profile_id)
select demo.id, m.profile_id
from public.sites demo
cross join public.site_members m
join public.sites s on s.id = m.site_id
join public.profiles p on p.id = m.profile_id
where demo.name = current_setting('demo.site_name')
  and s.name = '합성 제1공장'
  and p.role = 'manager';

-- Workstations, tasks with their manager inputs, capture sessions, assessments, options and
-- manual effects. Workstations are found by code within the demo site only.
-- BEGIN GENERATED: structure
insert into public.workstations (site_id, parent_group, name, code, headcount)
select s.id, v.parent_group, v.name, v.code, v.headcount
from (values
  ('차체', '용접 1라인', 'WLD-01', 8),
  ('차체', '용접 2라인', 'WLD-02', 6),
  ('차체', '프레스 1라인', 'PRS-01', 10),
  ('도장', '도장 부스', 'PNT-01', 7),
  ('조립', '조립 A라인', 'ASM-A', 12),
  ('조립', '조립 B라인', 'ASM-B', 9),
  ('물류', '자재 입고장', 'LOG-01', 3),
  ('물류', '출하장', 'LOG-02', 6),
  ('검사', '외관 검사대', 'QC-01', 3)
) as v (parent_group, name, code, headcount)
join public.sites s on s.name = current_setting('demo.site_name');

insert into public.tasks (
  workstation_id, name, daily_hours, load_category, load_shock, coupling,
  static_hold, unstable_base, sitting, arm_supported
)
select w.id, v.name, v.daily_hours, v.load_category, v.load_shock, v.coupling,
  v.static_hold, v.unstable_base, v.sitting, v.arm_supported
from (values
  ('WLD-01', '하부 용접', 4, '5to10', true, 'poor', true, true, false, false),
  ('WLD-01', '지그 교체', 2, 'gt10', false, 'poor', false, false, false, false),
  ('WLD-02', '측면 용접', 5, '5to10', false, 'fair', true, false, false, false),
  ('PRS-01', '판재 투입', 6, 'gt10', true, 'fair', false, false, false, false),
  ('PRS-01', '금형 점검', 1, 'lt5', false, 'good', false, false, false, false),
  ('PNT-01', '스프레이 도장', 5, '5to10', false, 'fair', true, false, false, false),
  ('PNT-01', '부품 거치', 2, '5to10', false, 'fair', false, false, false, false),
  ('ASM-A', '볼트 체결', 6, '5to10', false, 'fair', true, false, false, false),
  ('ASM-A', '하네스 연결', 2, 'lt5', false, 'good', false, false, false, false),
  ('ASM-B', '검사 표시', 7, 'lt5', false, 'good', false, false, true, true),
  ('LOG-01', '박스 하역', 3, 'gt10', true, 'poor', false, true, false, false),
  ('LOG-02', '팔레트 적재', 4, '5to10', false, 'fair', false, false, false, false),
  ('LOG-02', '랩핑', 2, 'lt5', false, 'good', false, false, false, false),
  ('QC-01', '외관 검사', 6, 'lt5', false, 'good', false, false, true, true),
  ('QC-01', '불량 분리', 2, 'lt5', false, 'good', false, false, false, false)
) as v (
  code, name, daily_hours, load_category, load_shock, coupling,
  static_hold, unstable_base, sitting, arm_supported
)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code;

-- One capture session per assessed task, then its assessment as the server would store it.
insert into public.capture_sessions (task_id, frame_count, inference_fps, created_at)
select t.id, v.frame_count, v.inference_fps, now() - make_interval(days => v.days_ago)
from (values
  ('WLD-01', '하부 용접', 450, 15, 3),
  ('WLD-01', '지그 교체', 450, 15, 5),
  ('WLD-02', '측면 용접', 450, 15, 6),
  ('PRS-01', '판재 투입', 450, 15, 4),
  ('PNT-01', '스프레이 도장', 450, 15, 9),
  ('PNT-01', '부품 거치', 450, 15, 9),
  ('ASM-A', '볼트 체결', 450, 15, 12),
  ('ASM-A', '하네스 연결', 450, 15, 12),
  ('ASM-B', '검사 표시', 450, 15, 15),
  ('LOG-01', '박스 하역', 450, 15, 2),
  ('LOG-02', '팔레트 적재', 450, 15, 7),
  ('QC-01', '외관 검사', 450, 15, 18)
) as v (code, task, frame_count, inference_fps, days_ago)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code
join public.tasks t on t.workstation_id = w.id and t.name = v.task;

insert into public.assessments (
  session_id, method, part_summary, valid_frame_ratio, high_risk_ratio, score_p90, level,
  algorithm_version, created_at
)
select c.id, 'reba', v.part_summary::jsonb, v.valid_frame_ratio, v.high_risk_ratio, v.score_p90,
  v.level, v.algorithm_version, c.created_at
from (values
  ('WLD-01', '하부 용접', '{"trunk":{"1":189,"2":3,"3":3,"4":210},"neck":{"1":194,"2":211},"legs":{"1":405},"upper_arm":{"1":192,"2":3,"3":210},"lower_arm":{"1":193,"2":212},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.5209876543209877, 11, 'very-high', 'reba-2d-v1'),
  ('WLD-01', '지그 교체', '{"trunk":{"1":279,"2":3,"3":3,"4":120},"neck":{"1":284,"2":121},"legs":{"1":405},"upper_arm":{"1":282,"2":2,"3":121},"lower_arm":{"1":283,"2":122},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.29876543209876544, 9, 'high', 'reba-2d-v1'),
  ('WLD-02', '측면 용접', '{"trunk":{"1":264,"2":3,"3":3,"4":135},"neck":{"1":269,"2":136},"legs":{"1":405},"upper_arm":{"1":267,"2":3,"3":135},"lower_arm":{"1":268,"2":137},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.3333333333333333, 9, 'high', 'reba-2d-v1'),
  ('PRS-01', '판재 투입', '{"trunk":{"1":264,"2":3,"3":3,"4":135},"neck":{"1":269,"2":136},"legs":{"1":405},"upper_arm":{"1":267,"2":2,"3":136},"lower_arm":{"1":268,"2":137},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.3358024691358025, 10, 'high', 'reba-2d-v1'),
  ('PNT-01', '스프레이 도장', '{"trunk":{"1":369,"2":3,"3":3,"4":30},"neck":{"1":374,"2":31},"legs":{"1":405},"upper_arm":{"1":192,"2":1,"3":32,"4":180},"lower_arm":{"1":193,"2":212},"wrist":{"1":223,"2":182},"wrist_unjudged_ratio":0}', 0.9, 0.07654320987654321, 6, 'caution', 'reba-2d-v1'),
  ('PNT-01', '부품 거치', '{"trunk":{"1":369,"2":3,"3":3,"4":30},"neck":{"1":374,"2":31},"legs":{"1":256,"2":4,"3":2,"4":143},"upper_arm":{"1":372,"2":3,"3":30},"lower_arm":{"1":373,"2":32},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.07407407407407407, 4, 'caution', 'reba-2d-v1'),
  ('ASM-A', '볼트 체결', '{"trunk":{"1":384,"2":3,"3":3,"4":15},"neck":{"1":389,"2":16},"legs":{"1":405},"upper_arm":{"1":252,"2":1,"3":17,"4":135},"lower_arm":{"1":253,"2":152},"wrist":{"1":268,"2":137},"wrist_unjudged_ratio":0}', 0.9, 0.03950617283950617, 6, 'caution', 'reba-2d-v1'),
  ('ASM-A', '하네스 연결', '{"trunk":{"1":405},"neck":{"1":405},"legs":{"1":405},"upper_arm":{"1":405},"lower_arm":{"1":405},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0, 1, 'low', 'reba-2d-v1'),
  ('ASM-B', '검사 표시', '{"trunk":{"1":420},"neck":{"1":420},"legs":{"1":420},"upper_arm":{"1":420},"lower_arm":{"1":420},"wrist":{"1":420},"wrist_unjudged_ratio":0}', 0.9333333333333333, 0, 1, 'low', 'reba-2d-v1'),
  ('LOG-01', '박스 하역', '{"trunk":{"1":219,"2":3,"3":3,"4":180},"neck":{"1":224,"2":181},"legs":{"1":180,"2":2,"3":223},"upper_arm":{"1":222,"2":2,"3":181},"lower_arm":{"1":223,"2":182},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.45925925925925926, 11, 'very-high', 'reba-2d-v1'),
  ('LOG-02', '팔레트 적재', '{"trunk":{"1":369,"2":3,"3":3,"4":30},"neck":{"1":374,"2":31},"legs":{"1":271,"2":4,"3":2,"4":128},"upper_arm":{"1":372,"2":2,"3":31},"lower_arm":{"1":373,"2":32},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.07407407407407407, 4, 'caution', 'reba-2d-v1'),
  ('QC-01', '외관 검사', '{"trunk":{"1":420},"neck":{"1":420},"legs":{"1":420},"upper_arm":{"1":420},"lower_arm":{"1":420},"wrist":{"1":420},"wrist_unjudged_ratio":0}', 0.9333333333333333, 0, 1, 'low', 'reba-2d-v1')
) as v (code, task, part_summary, valid_frame_ratio, high_risk_ratio, score_p90, level, algorithm_version)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code
join public.tasks t on t.workstation_id = w.id and t.name = v.task
join public.capture_sessions c on c.task_id = t.id;

insert into public.improvement_options (workstation_id, title, description, cost)
select w.id, v.title, v.description, v.cost
from (values
  ('WLD-01', '리프트 테이블', '용접물을 허리 높이로 올려 숙임을 줄여요.', 1500000),
  ('WLD-01', '자동 용접 지그', '용접물을 회전시켜 아래쪽 용접을 앞쪽에서 해요.', 6000000),
  ('WLD-02', '작업대 높이 조절', null::text, 800000),
  ('PRS-01', '보조 롤러', '판재를 밀어 넣을 때 드는 힘을 줄여요.', 1200000),
  ('PRS-01', '판재 자동 공급기', null::text, 9000000),
  ('PNT-01', '회전 거치대', null::text, 2000000),
  ('ASM-A', '공구 밸런서', '공구 무게를 줄로 받쳐 팔 부담을 줄여요.', 600000),
  ('ASM-A', '높이 조절 컨베이어', null::text, 4500000),
  ('LOG-01', '전동 리프터', '상자를 바닥에서 들어 올리지 않게 해요.', 3000000),
  ('LOG-02', '팔레트 회전대', null::text, 900000)
) as v (code, title, description, cost)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code;

insert into public.option_effects (option_id, task_id, expected_high_risk_ratio, source)
select o.id, t.id, v.expected_high_risk_ratio, 'manual'
from (values
  ('WLD-01', '리프트 테이블', '하부 용접', 0.3),
  ('WLD-01', '리프트 테이블', '지그 교체', 0.15),
  ('WLD-01', '자동 용접 지그', '하부 용접', 0.1),
  ('WLD-01', '자동 용접 지그', '지그 교체', 0.1),
  ('WLD-02', '작업대 높이 조절', '측면 용접', 0.15),
  ('PRS-01', '보조 롤러', '판재 투입', 0.2),
  ('PRS-01', '판재 자동 공급기', '판재 투입', 0.05),
  ('PNT-01', '회전 거치대', '스프레이 도장', 0.02),
  ('PNT-01', '회전 거치대', '부품 거치', 0.03),
  ('ASM-A', '공구 밸런서', '볼트 체결', 0.01),
  ('ASM-A', '높이 조절 컨베이어', '볼트 체결', 0),
  ('LOG-01', '전동 리프터', '박스 하역', 0.1),
  ('LOG-02', '팔레트 회전대', '팔레트 적재', 0.02)
) as v (code, title, task, expected_high_risk_ratio)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code
join public.improvement_options o on o.workstation_id = w.id and o.title = v.title
join public.tasks t on t.workstation_id = w.id and t.name = v.task;
-- END GENERATED: structure

-- BEGIN GENERATED: simulations
-- Simulation captures as save_simulation_capture would store them, then each becomes its
-- option's effect for the task, replacing the manual value.
insert into public.simulation_captures (
  option_id, task_id, frame_count, inference_fps, task_inputs, part_summary,
  valid_frame_ratio, high_risk_ratio, score_p90, level, algorithm_version, created_at
)
select o.id, t.id, v.frame_count, v.inference_fps, v.task_inputs::jsonb, v.part_summary::jsonb,
  v.valid_frame_ratio, v.high_risk_ratio, v.score_p90, v.level, v.algorithm_version,
  now() - make_interval(days => v.days_ago)
from (values
  ('WLD-01', '리프트 테이블', '하부 용접', 450, 15, '{"load_category":"5to10","load_shock":true,"coupling":"poor","static_hold":true,"unstable_base":true,"sitting":false,"arm_supported":false}', '{"trunk":{"1":279,"2":3,"3":3,"4":120},"neck":{"1":284,"2":121},"legs":{"1":405},"upper_arm":{"1":282,"2":3,"3":120},"lower_arm":{"1":283,"2":122},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.29876543209876544, 11, 'very-high', 'reba-2d-v1', 3),
  ('WLD-02', '작업대 높이 조절', '측면 용접', 450, 15, '{"load_category":"5to10","load_shock":false,"coupling":"fair","static_hold":true,"unstable_base":false,"sitting":false,"arm_supported":false}', '{"trunk":{"1":339,"2":3,"3":3,"4":60},"neck":{"1":344,"2":61},"legs":{"1":405},"upper_arm":{"1":342,"2":3,"3":60},"lower_arm":{"1":343,"2":62},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.14814814814814814, 9, 'high', 'reba-2d-v1', 2),
  ('PRS-01', '보조 롤러', '판재 투입', 450, 15, '{"load_category":"gt10","load_shock":true,"coupling":"fair","static_hold":false,"unstable_base":false,"sitting":false,"arm_supported":false}', '{"trunk":{"1":324,"2":3,"3":3,"4":75},"neck":{"1":329,"2":76},"legs":{"1":405},"upper_arm":{"1":327,"2":2,"3":76},"lower_arm":{"1":328,"2":77},"wrist":{"1":405},"wrist_unjudged_ratio":0}', 0.9, 0.18765432098765433, 10, 'high', 'reba-2d-v1', 1)
) as v (
  code, option, task, frame_count, inference_fps, task_inputs, part_summary,
  valid_frame_ratio, high_risk_ratio, score_p90, level, algorithm_version, days_ago
)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code
join public.improvement_options o on o.workstation_id = w.id and o.title = v.option
join public.tasks t on t.workstation_id = w.id and t.name = v.task;

insert into public.option_effects as e (
  option_id, task_id, expected_high_risk_ratio, source, capture_id
)
select c.option_id, c.task_id, c.high_risk_ratio, 'simulation', c.id
from public.simulation_captures c
join public.tasks t on t.id = c.task_id
join public.workstations w on w.id = t.workstation_id
join public.sites s on s.id = w.site_id and s.name = current_setting('demo.site_name')
on conflict (option_id, task_id) do update
set expected_high_risk_ratio = excluded.expected_high_risk_ratio,
  source = 'simulation',
  capture_id = excluded.capture_id;
-- END GENERATED: simulations

-- Fictional equipment companies. They have no accounts; their quotes are entered here.
-- 합성 설비 업체 (seed.sql, with the partner account) quotes too, so its 들림 파트너스 screen
-- shows an open, an accepted and a rejected quote.
insert into public.partners (company_name)
select jsonb_array_elements_text(current_setting('demo.partners')::jsonb);

-- BEGIN GENERATED: requests
-- Requests in every status. The demo site's first manager is recorded as their author.
insert into public.improvement_requests (
  workstation_id, option_id, title, description, desired_by, status, created_by,
  created_at, opened_at, closed_at
)
select w.id, o.id, v.title, v.description,
  (now() at time zone 'Asia/Seoul')::date + v.desired_in_days,
  v.status, m.profile_id,
  now() - make_interval(days => v.created_days_ago),
  now() - make_interval(days => v.opened_days_ago),
  now() - make_interval(days => v.closed_days_ago)
from (values
  ('PNT-01', '회전 거치대', 'draft', '도장 부스 부품 회전 거치대', '도장할 부품을 돌려 가며 칠할 수 있는 회전 거치대. 설치 공간 2m × 2m, 부품 무게 20kg 이하.', null::integer, 2, null::integer, null::integer),
  ('WLD-01', '자동 용접 지그', 'open', '차체 하부 자동 용접 지그', '차체 하부를 뒤집어 고정해 위보기 용접을 줄이는 지그. 기존 1라인 작업대 자리에 설치, 설치 중 라인 정지는 주말 이틀 이내.', 30, 6, 5, null::integer),
  ('PRS-01', '보조 롤러', 'closed', '프레스 판재 투입용 보조 롤러', '판재를 밀어 넣을 때 받쳐 주는 보조 롤러 컨베이어. 길이 3m, 판재 무게 25kg 이하.', null::integer, 20, 18, 6),
  ('PRS-01', '판재 자동 공급기', 'closed', '프레스 판재 자동 공급기', '판재를 한 장씩 자동으로 공급하는 장치. 예산 검토용.', null::integer, 16, 15, 3)
) as v (
  code, option, status, title, description, desired_in_days, created_days_ago,
  opened_days_ago, closed_days_ago
)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code
join public.improvement_options o on o.workstation_id = w.id and o.title = v.option
cross join lateral (
  select sm.profile_id
  from public.site_members sm
  join public.profiles p on p.id = sm.profile_id
  where sm.site_id = s.id and p.role = 'manager'
  order by sm.profile_id
  limit 1
) as m;

-- Quotes. On a closed request each quote was last changed when the request closed, as
-- close_request and accept_quote do; on an open one, when it was submitted.
insert into public.quotes (
  request_id, partner_id, price, lead_time_days, note, status, created_at, updated_at
)
select r.id, p.id, v.price, v.lead_time_days, v.note,
  case when r.status = 'open' then 'submitted' when v.accepted then 'accepted' else 'rejected' end,
  now() - make_interval(days => v.submitted_days_ago),
  coalesce(r.closed_at, now() - make_interval(days => v.submitted_days_ago))
from (values
  ('WLD-01', '자동 용접 지그', '가람설비(가상)', 4500000, 30, '설치와 시운전 포함, 무상 보증 1년', false, 4),
  ('WLD-01', '자동 용접 지그', '누리자동화(가상)', 5200000, 21, '설치 포함', false, 3),
  ('WLD-01', '자동 용접 지그', '다온기계(가상)', 5800000, 14, null::text, false, 2),
  ('WLD-01', '자동 용접 지그', '합성 설비 업체', 5000000, 25, '설치 포함, 작업자 교육 1회', false, 1),
  ('PRS-01', '보조 롤러', '합성 설비 업체', 1100000, 10, '설치 포함', true, 15),
  ('PRS-01', '보조 롤러', '다온기계(가상)', 1350000, 7, null::text, false, 14),
  ('PRS-01', '판재 자동 공급기', '가람설비(가상)', 9500000, 60, '기초 공사 별도', false, 12),
  ('PRS-01', '판재 자동 공급기', '다온기계(가상)', 10200000, 45, null::text, false, 11),
  ('PRS-01', '판재 자동 공급기', '합성 설비 업체', 9800000, 50, null::text, false, 10)
) as v (code, option, partner, price, lead_time_days, note, accepted, submitted_days_ago)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code
join public.improvement_options o on o.workstation_id = w.id and o.title = v.option
join public.improvement_requests r on r.option_id = o.id
join public.partners p on p.company_name = v.partner;
-- END GENERATED: requests

-- An accepted quote sets its option's cost, as accept_quote does.
update public.improvement_options o
set cost = q.price, quote_id = q.id
from public.quotes q
join public.improvement_requests r on r.id = q.request_id
join public.workstations w on w.id = r.workstation_id
join public.sites s on s.id = w.site_id
where q.status = 'accepted' and r.option_id = o.id and s.name = current_setting('demo.site_name');

-- Pain reports. Times count back from now(); visible_from is set by the trigger
-- (24 hours later for workstations under 5 people).
-- - Screening alert (moderate or worse, last 4 weeks): 용접 1라인 (5) and the merged 물류 group (4).
-- - Below the alert: 프레스 1라인, 도장 부스, 조립 A라인 (2 or fewer each).
-- - 외관 검사대 is a hidden group: its reports never appear on the console.
-- - Reports 1 to 6 hours old fall in this week when loaded on a Monday after 07:00 (KST).
-- - Reports 5 to 11 weeks old appear only in the report draft's 12-week table.
insert into public.pain_reports (workstation_id, body_parts, intensity, created_at)
select w.id, r.body_parts, r.intensity, now() - make_interval(hours => r.hours_ago)
from (values
  ('WLD-01', array['lower_back'], 'severe', 2),
  ('WLD-01', array['lower_back', 'leg_foot'], 'moderate', 5),
  ('WLD-01', array['shoulder'], 'moderate', 50),
  ('WLD-01', array['lower_back'], 'very_severe', 120),
  ('WLD-01', array['neck'], 'moderate', 300),
  ('WLD-01', array['hand_wrist'], 'mild', 200),
  ('WLD-01', array['lower_back'], 'mild', 400),
  ('LOG-01', array['lower_back'], 'severe', 30),
  ('LOG-01', array['shoulder', 'lower_back'], 'moderate', 220),
  ('LOG-02', array['lower_back'], 'moderate', 75),
  ('LOG-02', array['arm_elbow'], 'moderate', 330),
  ('LOG-02', array['leg_foot'], 'mild', 150),
  ('PRS-01', array['shoulder'], 'moderate', 100),
  ('PRS-01', array['lower_back'], 'severe', 260),
  ('PRS-01', array['hand_wrist'], 'mild', 3),
  ('PRS-01', array['neck'], 'mild', 180),
  ('PNT-01', array['neck', 'shoulder'], 'severe', 90),
  ('PNT-01', array['shoulder'], 'mild', 140),
  ('PNT-01', array['arm_elbow'], 'mild', 350),
  ('ASM-A', array['hand_wrist'], 'moderate', 60),
  ('ASM-A', array['hand_wrist', 'arm_elbow'], 'moderate', 280),
  ('ASM-A', array['neck'], 'mild', 4),
  ('ASM-A', array['shoulder'], 'mild', 170),
  ('ASM-A', array['hand_wrist'], 'mild', 420),
  ('QC-01', array['neck'], 'severe', 40),
  ('QC-01', array['neck', 'shoulder'], 'severe', 130),
  ('QC-01', array['lower_back'], 'moderate', 240),
  ('WLD-02', array['shoulder'], 'moderate', 900),
  ('WLD-02', array['neck'], 'severe', 1300),
  ('ASM-B', array['hand_wrist'], 'mild', 1000),
  ('PRS-01', array['lower_back'], 'moderate', 1500),
  ('WLD-01', array['lower_back'], 'severe', 1700)
) as r (code, body_parts, intensity, hours_ago)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = r.code;

-- Due dates come from the app's own rule (dueDateFor), written as a table by a test, so SQL
-- never computes them itself.
create temporary table demo_due_dates (occurred_on date primary key, due_date date not null)
on commit drop;
-- BEGIN GENERATED: due dates
insert into demo_due_dates (occurred_on, due_date) values
  ('2026-06-01', '2026-07-01'),
  ('2026-06-02', '2026-07-02'),
  ('2026-06-03', '2026-07-03'),
  ('2026-06-04', '2026-07-04'),
  ('2026-06-05', '2026-07-05'),
  ('2026-06-06', '2026-07-06'),
  ('2026-06-07', '2026-07-07'),
  ('2026-06-08', '2026-07-08'),
  ('2026-06-09', '2026-07-09'),
  ('2026-06-10', '2026-07-10'),
  ('2026-06-11', '2026-07-11'),
  ('2026-06-12', '2026-07-12'),
  ('2026-06-13', '2026-07-13'),
  ('2026-06-14', '2026-07-14'),
  ('2026-06-15', '2026-07-15'),
  ('2026-06-16', '2026-07-16'),
  ('2026-06-17', '2026-07-17'),
  ('2026-06-18', '2026-07-18'),
  ('2026-06-19', '2026-07-19'),
  ('2026-06-20', '2026-07-20'),
  ('2026-06-21', '2026-07-21'),
  ('2026-06-22', '2026-07-22'),
  ('2026-06-23', '2026-07-23'),
  ('2026-06-24', '2026-07-24'),
  ('2026-06-25', '2026-07-25'),
  ('2026-06-26', '2026-07-26'),
  ('2026-06-27', '2026-07-27'),
  ('2026-06-28', '2026-07-28'),
  ('2026-06-29', '2026-07-29'),
  ('2026-06-30', '2026-07-31'),
  ('2026-07-01', '2026-08-01'),
  ('2026-07-02', '2026-08-02'),
  ('2026-07-03', '2026-08-03'),
  ('2026-07-04', '2026-08-04'),
  ('2026-07-05', '2026-08-05'),
  ('2026-07-06', '2026-08-06'),
  ('2026-07-07', '2026-08-07'),
  ('2026-07-08', '2026-08-08'),
  ('2026-07-09', '2026-08-09'),
  ('2026-07-10', '2026-08-10'),
  ('2026-07-11', '2026-08-11'),
  ('2026-07-12', '2026-08-12'),
  ('2026-07-13', '2026-08-13'),
  ('2026-07-14', '2026-08-14'),
  ('2026-07-15', '2026-08-15'),
  ('2026-07-16', '2026-08-16'),
  ('2026-07-17', '2026-08-17'),
  ('2026-07-18', '2026-08-18'),
  ('2026-07-19', '2026-08-19'),
  ('2026-07-20', '2026-08-20'),
  ('2026-07-21', '2026-08-21'),
  ('2026-07-22', '2026-08-22'),
  ('2026-07-23', '2026-08-23'),
  ('2026-07-24', '2026-08-24'),
  ('2026-07-25', '2026-08-25'),
  ('2026-07-26', '2026-08-26'),
  ('2026-07-27', '2026-08-27'),
  ('2026-07-28', '2026-08-28'),
  ('2026-07-29', '2026-08-29'),
  ('2026-07-30', '2026-08-30'),
  ('2026-07-31', '2026-08-31'),
  ('2026-08-01', '2026-09-01'),
  ('2026-08-02', '2026-09-02'),
  ('2026-08-03', '2026-09-03'),
  ('2026-08-04', '2026-09-04'),
  ('2026-08-05', '2026-09-05'),
  ('2026-08-06', '2026-09-06'),
  ('2026-08-07', '2026-09-07'),
  ('2026-08-08', '2026-09-08'),
  ('2026-08-09', '2026-09-09'),
  ('2026-08-10', '2026-09-10'),
  ('2026-08-11', '2026-09-11'),
  ('2026-08-12', '2026-09-12'),
  ('2026-08-13', '2026-09-13'),
  ('2026-08-14', '2026-09-14'),
  ('2026-08-15', '2026-09-15'),
  ('2026-08-16', '2026-09-16'),
  ('2026-08-17', '2026-09-17'),
  ('2026-08-18', '2026-09-18'),
  ('2026-08-19', '2026-09-19'),
  ('2026-08-20', '2026-09-20'),
  ('2026-08-21', '2026-09-21'),
  ('2026-08-22', '2026-09-22'),
  ('2026-08-23', '2026-09-23'),
  ('2026-08-24', '2026-09-24'),
  ('2026-08-25', '2026-09-25'),
  ('2026-08-26', '2026-09-26'),
  ('2026-08-27', '2026-09-27'),
  ('2026-08-28', '2026-09-28'),
  ('2026-08-29', '2026-09-29'),
  ('2026-08-30', '2026-09-30'),
  ('2026-08-31', '2026-09-30'),
  ('2026-09-01', '2026-10-01'),
  ('2026-09-02', '2026-10-02'),
  ('2026-09-03', '2026-10-03'),
  ('2026-09-04', '2026-10-04'),
  ('2026-09-05', '2026-10-05'),
  ('2026-09-06', '2026-10-06'),
  ('2026-09-07', '2026-10-07'),
  ('2026-09-08', '2026-10-08'),
  ('2026-09-09', '2026-10-09'),
  ('2026-09-10', '2026-10-10'),
  ('2026-09-11', '2026-10-11'),
  ('2026-09-12', '2026-10-12'),
  ('2026-09-13', '2026-10-13'),
  ('2026-09-14', '2026-10-14'),
  ('2026-09-15', '2026-10-15'),
  ('2026-09-16', '2026-10-16'),
  ('2026-09-17', '2026-10-17'),
  ('2026-09-18', '2026-10-18'),
  ('2026-09-19', '2026-10-19'),
  ('2026-09-20', '2026-10-20'),
  ('2026-09-21', '2026-10-21'),
  ('2026-09-22', '2026-10-22'),
  ('2026-09-23', '2026-10-23'),
  ('2026-09-24', '2026-10-24'),
  ('2026-09-25', '2026-10-25'),
  ('2026-09-26', '2026-10-26'),
  ('2026-09-27', '2026-10-27'),
  ('2026-09-28', '2026-10-28'),
  ('2026-09-29', '2026-10-29'),
  ('2026-09-30', '2026-10-31'),
  ('2026-10-01', '2026-11-01'),
  ('2026-10-02', '2026-11-02'),
  ('2026-10-03', '2026-11-03'),
  ('2026-10-04', '2026-11-04'),
  ('2026-10-05', '2026-11-05'),
  ('2026-10-06', '2026-11-06'),
  ('2026-10-07', '2026-11-07'),
  ('2026-10-08', '2026-11-08'),
  ('2026-10-09', '2026-11-09'),
  ('2026-10-10', '2026-11-10'),
  ('2026-10-11', '2026-11-11'),
  ('2026-10-12', '2026-11-12'),
  ('2026-10-13', '2026-11-13'),
  ('2026-10-14', '2026-11-14'),
  ('2026-10-15', '2026-11-15'),
  ('2026-10-16', '2026-11-16'),
  ('2026-10-17', '2026-11-17'),
  ('2026-10-18', '2026-11-18'),
  ('2026-10-19', '2026-11-19'),
  ('2026-10-20', '2026-11-20'),
  ('2026-10-21', '2026-11-21'),
  ('2026-10-22', '2026-11-22'),
  ('2026-10-23', '2026-11-23'),
  ('2026-10-24', '2026-11-24'),
  ('2026-10-25', '2026-11-25'),
  ('2026-10-26', '2026-11-26'),
  ('2026-10-27', '2026-11-27'),
  ('2026-10-28', '2026-11-28'),
  ('2026-10-29', '2026-11-29'),
  ('2026-10-30', '2026-11-30'),
  ('2026-10-31', '2026-11-30'),
  ('2026-11-01', '2026-12-01'),
  ('2026-11-02', '2026-12-02'),
  ('2026-11-03', '2026-12-03'),
  ('2026-11-04', '2026-12-04'),
  ('2026-11-05', '2026-12-05'),
  ('2026-11-06', '2026-12-06'),
  ('2026-11-07', '2026-12-07'),
  ('2026-11-08', '2026-12-08'),
  ('2026-11-09', '2026-12-09'),
  ('2026-11-10', '2026-12-10'),
  ('2026-11-11', '2026-12-11'),
  ('2026-11-12', '2026-12-12'),
  ('2026-11-13', '2026-12-13'),
  ('2026-11-14', '2026-12-14'),
  ('2026-11-15', '2026-12-15'),
  ('2026-11-16', '2026-12-16'),
  ('2026-11-17', '2026-12-17'),
  ('2026-11-18', '2026-12-18'),
  ('2026-11-19', '2026-12-19'),
  ('2026-11-20', '2026-12-20'),
  ('2026-11-21', '2026-12-21'),
  ('2026-11-22', '2026-12-22'),
  ('2026-11-23', '2026-12-23'),
  ('2026-11-24', '2026-12-24'),
  ('2026-11-25', '2026-12-25'),
  ('2026-11-26', '2026-12-26'),
  ('2026-11-27', '2026-12-27'),
  ('2026-11-28', '2026-12-28'),
  ('2026-11-29', '2026-12-29'),
  ('2026-11-30', '2026-12-31'),
  ('2026-12-01', '2027-01-01'),
  ('2026-12-02', '2027-01-02'),
  ('2026-12-03', '2027-01-03'),
  ('2026-12-04', '2027-01-04'),
  ('2026-12-05', '2027-01-05'),
  ('2026-12-06', '2027-01-06'),
  ('2026-12-07', '2027-01-07'),
  ('2026-12-08', '2027-01-08'),
  ('2026-12-09', '2027-01-09'),
  ('2026-12-10', '2027-01-10'),
  ('2026-12-11', '2027-01-11'),
  ('2026-12-12', '2027-01-12'),
  ('2026-12-13', '2027-01-13'),
  ('2026-12-14', '2027-01-14'),
  ('2026-12-15', '2027-01-15'),
  ('2026-12-16', '2027-01-16'),
  ('2026-12-17', '2027-01-17'),
  ('2026-12-18', '2027-01-18'),
  ('2026-12-19', '2027-01-19'),
  ('2026-12-20', '2027-01-20'),
  ('2026-12-21', '2027-01-21'),
  ('2026-12-22', '2027-01-22'),
  ('2026-12-23', '2027-01-23'),
  ('2026-12-24', '2027-01-24'),
  ('2026-12-25', '2027-01-25'),
  ('2026-12-26', '2027-01-26'),
  ('2026-12-27', '2027-01-27'),
  ('2026-12-28', '2027-01-28'),
  ('2026-12-29', '2027-01-29'),
  ('2026-12-30', '2027-01-30'),
  ('2026-12-31', '2027-01-31'),
  ('2027-01-01', '2027-02-01'),
  ('2027-01-02', '2027-02-02'),
  ('2027-01-03', '2027-02-03'),
  ('2027-01-04', '2027-02-04'),
  ('2027-01-05', '2027-02-05'),
  ('2027-01-06', '2027-02-06'),
  ('2027-01-07', '2027-02-07'),
  ('2027-01-08', '2027-02-08'),
  ('2027-01-09', '2027-02-09'),
  ('2027-01-10', '2027-02-10'),
  ('2027-01-11', '2027-02-11'),
  ('2027-01-12', '2027-02-12'),
  ('2027-01-13', '2027-02-13'),
  ('2027-01-14', '2027-02-14'),
  ('2027-01-15', '2027-02-15'),
  ('2027-01-16', '2027-02-16'),
  ('2027-01-17', '2027-02-17'),
  ('2027-01-18', '2027-02-18'),
  ('2027-01-19', '2027-02-19'),
  ('2027-01-20', '2027-02-20'),
  ('2027-01-21', '2027-02-21'),
  ('2027-01-22', '2027-02-22'),
  ('2027-01-23', '2027-02-23'),
  ('2027-01-24', '2027-02-24'),
  ('2027-01-25', '2027-02-25'),
  ('2027-01-26', '2027-02-26'),
  ('2027-01-27', '2027-02-27'),
  ('2027-01-28', '2027-02-28'),
  ('2027-01-29', '2027-02-28'),
  ('2027-01-30', '2027-02-28'),
  ('2027-01-31', '2027-02-28'),
  ('2027-02-01', '2027-03-01'),
  ('2027-02-02', '2027-03-02'),
  ('2027-02-03', '2027-03-03'),
  ('2027-02-04', '2027-03-04'),
  ('2027-02-05', '2027-03-05'),
  ('2027-02-06', '2027-03-06'),
  ('2027-02-07', '2027-03-07'),
  ('2027-02-08', '2027-03-08'),
  ('2027-02-09', '2027-03-09'),
  ('2027-02-10', '2027-03-10'),
  ('2027-02-11', '2027-03-11'),
  ('2027-02-12', '2027-03-12'),
  ('2027-02-13', '2027-03-13'),
  ('2027-02-14', '2027-03-14'),
  ('2027-02-15', '2027-03-15'),
  ('2027-02-16', '2027-03-16'),
  ('2027-02-17', '2027-03-17'),
  ('2027-02-18', '2027-03-18'),
  ('2027-02-19', '2027-03-19'),
  ('2027-02-20', '2027-03-20'),
  ('2027-02-21', '2027-03-21'),
  ('2027-02-22', '2027-03-22'),
  ('2027-02-23', '2027-03-23'),
  ('2027-02-24', '2027-03-24'),
  ('2027-02-25', '2027-03-25'),
  ('2027-02-26', '2027-03-26'),
  ('2027-02-27', '2027-03-27'),
  ('2027-02-28', '2027-03-31'),
  ('2027-03-01', '2027-04-01'),
  ('2027-03-02', '2027-04-02'),
  ('2027-03-03', '2027-04-03'),
  ('2027-03-04', '2027-04-04'),
  ('2027-03-05', '2027-04-05'),
  ('2027-03-06', '2027-04-06'),
  ('2027-03-07', '2027-04-07'),
  ('2027-03-08', '2027-04-08'),
  ('2027-03-09', '2027-04-09'),
  ('2027-03-10', '2027-04-10'),
  ('2027-03-11', '2027-04-11'),
  ('2027-03-12', '2027-04-12'),
  ('2027-03-13', '2027-04-13'),
  ('2027-03-14', '2027-04-14'),
  ('2027-03-15', '2027-04-15'),
  ('2027-03-16', '2027-04-16'),
  ('2027-03-17', '2027-04-17'),
  ('2027-03-18', '2027-04-18'),
  ('2027-03-19', '2027-04-19'),
  ('2027-03-20', '2027-04-20'),
  ('2027-03-21', '2027-04-21'),
  ('2027-03-22', '2027-04-22'),
  ('2027-03-23', '2027-04-23'),
  ('2027-03-24', '2027-04-24'),
  ('2027-03-25', '2027-04-25'),
  ('2027-03-26', '2027-04-26'),
  ('2027-03-27', '2027-04-27'),
  ('2027-03-28', '2027-04-28'),
  ('2027-03-29', '2027-04-29'),
  ('2027-03-30', '2027-04-30'),
  ('2027-03-31', '2027-04-30'),
  ('2027-04-01', '2027-05-01'),
  ('2027-04-02', '2027-05-02'),
  ('2027-04-03', '2027-05-03'),
  ('2027-04-04', '2027-05-04'),
  ('2027-04-05', '2027-05-05'),
  ('2027-04-06', '2027-05-06'),
  ('2027-04-07', '2027-05-07'),
  ('2027-04-08', '2027-05-08'),
  ('2027-04-09', '2027-05-09'),
  ('2027-04-10', '2027-05-10'),
  ('2027-04-11', '2027-05-11'),
  ('2027-04-12', '2027-05-12'),
  ('2027-04-13', '2027-05-13'),
  ('2027-04-14', '2027-05-14'),
  ('2027-04-15', '2027-05-15'),
  ('2027-04-16', '2027-05-16'),
  ('2027-04-17', '2027-05-17'),
  ('2027-04-18', '2027-05-18'),
  ('2027-04-19', '2027-05-19'),
  ('2027-04-20', '2027-05-20'),
  ('2027-04-21', '2027-05-21'),
  ('2027-04-22', '2027-05-22'),
  ('2027-04-23', '2027-05-23'),
  ('2027-04-24', '2027-05-24'),
  ('2027-04-25', '2027-05-25'),
  ('2027-04-26', '2027-05-26'),
  ('2027-04-27', '2027-05-27'),
  ('2027-04-28', '2027-05-28'),
  ('2027-04-29', '2027-05-29'),
  ('2027-04-30', '2027-05-31'),
  ('2027-05-01', '2027-06-01'),
  ('2027-05-02', '2027-06-02'),
  ('2027-05-03', '2027-06-03'),
  ('2027-05-04', '2027-06-04'),
  ('2027-05-05', '2027-06-05'),
  ('2027-05-06', '2027-06-06'),
  ('2027-05-07', '2027-06-07'),
  ('2027-05-08', '2027-06-08'),
  ('2027-05-09', '2027-06-09'),
  ('2027-05-10', '2027-06-10'),
  ('2027-05-11', '2027-06-11'),
  ('2027-05-12', '2027-06-12'),
  ('2027-05-13', '2027-06-13'),
  ('2027-05-14', '2027-06-14'),
  ('2027-05-15', '2027-06-15'),
  ('2027-05-16', '2027-06-16'),
  ('2027-05-17', '2027-06-17'),
  ('2027-05-18', '2027-06-18'),
  ('2027-05-19', '2027-06-19'),
  ('2027-05-20', '2027-06-20'),
  ('2027-05-21', '2027-06-21'),
  ('2027-05-22', '2027-06-22'),
  ('2027-05-23', '2027-06-23'),
  ('2027-05-24', '2027-06-24'),
  ('2027-05-25', '2027-06-25'),
  ('2027-05-26', '2027-06-26'),
  ('2027-05-27', '2027-06-27'),
  ('2027-05-28', '2027-06-28'),
  ('2027-05-29', '2027-06-29'),
  ('2027-05-30', '2027-06-30'),
  ('2027-05-31', '2027-06-30'),
  ('2027-06-01', '2027-07-01'),
  ('2027-06-02', '2027-07-02'),
  ('2027-06-03', '2027-07-03'),
  ('2027-06-04', '2027-07-04'),
  ('2027-06-05', '2027-07-05'),
  ('2027-06-06', '2027-07-06'),
  ('2027-06-07', '2027-07-07'),
  ('2027-06-08', '2027-07-08'),
  ('2027-06-09', '2027-07-09'),
  ('2027-06-10', '2027-07-10'),
  ('2027-06-11', '2027-07-11'),
  ('2027-06-12', '2027-07-12'),
  ('2027-06-13', '2027-07-13'),
  ('2027-06-14', '2027-07-14'),
  ('2027-06-15', '2027-07-15'),
  ('2027-06-16', '2027-07-16'),
  ('2027-06-17', '2027-07-17'),
  ('2027-06-18', '2027-07-18'),
  ('2027-06-19', '2027-07-19'),
  ('2027-06-20', '2027-07-20'),
  ('2027-06-21', '2027-07-21'),
  ('2027-06-22', '2027-07-22'),
  ('2027-06-23', '2027-07-23'),
  ('2027-06-24', '2027-07-24'),
  ('2027-06-25', '2027-07-25'),
  ('2027-06-26', '2027-07-26'),
  ('2027-06-27', '2027-07-27'),
  ('2027-06-28', '2027-07-28'),
  ('2027-06-29', '2027-07-29'),
  ('2027-06-30', '2027-07-31'),
  ('2027-07-01', '2027-08-01'),
  ('2027-07-02', '2027-08-02'),
  ('2027-07-03', '2027-08-03'),
  ('2027-07-04', '2027-08-04'),
  ('2027-07-05', '2027-08-05'),
  ('2027-07-06', '2027-08-06'),
  ('2027-07-07', '2027-08-07'),
  ('2027-07-08', '2027-08-08'),
  ('2027-07-09', '2027-08-09'),
  ('2027-07-10', '2027-08-10'),
  ('2027-07-11', '2027-08-11'),
  ('2027-07-12', '2027-08-12'),
  ('2027-07-13', '2027-08-13'),
  ('2027-07-14', '2027-08-14'),
  ('2027-07-15', '2027-08-15'),
  ('2027-07-16', '2027-08-16'),
  ('2027-07-17', '2027-08-17'),
  ('2027-07-18', '2027-08-18'),
  ('2027-07-19', '2027-08-19'),
  ('2027-07-20', '2027-08-20'),
  ('2027-07-21', '2027-08-21'),
  ('2027-07-22', '2027-08-22'),
  ('2027-07-23', '2027-08-23'),
  ('2027-07-24', '2027-08-24'),
  ('2027-07-25', '2027-08-25'),
  ('2027-07-26', '2027-08-26'),
  ('2027-07-27', '2027-08-27'),
  ('2027-07-28', '2027-08-28'),
  ('2027-07-29', '2027-08-29'),
  ('2027-07-30', '2027-08-30'),
  ('2027-07-31', '2027-08-31'),
  ('2027-08-01', '2027-09-01'),
  ('2027-08-02', '2027-09-02'),
  ('2027-08-03', '2027-09-03'),
  ('2027-08-04', '2027-09-04'),
  ('2027-08-05', '2027-09-05'),
  ('2027-08-06', '2027-09-06'),
  ('2027-08-07', '2027-09-07'),
  ('2027-08-08', '2027-09-08'),
  ('2027-08-09', '2027-09-09'),
  ('2027-08-10', '2027-09-10'),
  ('2027-08-11', '2027-09-11'),
  ('2027-08-12', '2027-09-12'),
  ('2027-08-13', '2027-09-13'),
  ('2027-08-14', '2027-09-14'),
  ('2027-08-15', '2027-09-15'),
  ('2027-08-16', '2027-09-16'),
  ('2027-08-17', '2027-09-17'),
  ('2027-08-18', '2027-09-18'),
  ('2027-08-19', '2027-09-19'),
  ('2027-08-20', '2027-09-20'),
  ('2027-08-21', '2027-09-21'),
  ('2027-08-22', '2027-09-22'),
  ('2027-08-23', '2027-09-23'),
  ('2027-08-24', '2027-09-24'),
  ('2027-08-25', '2027-09-25'),
  ('2027-08-26', '2027-09-26'),
  ('2027-08-27', '2027-09-27'),
  ('2027-08-28', '2027-09-28'),
  ('2027-08-29', '2027-09-29'),
  ('2027-08-30', '2027-09-30'),
  ('2027-08-31', '2027-09-30'),
  ('2027-09-01', '2027-10-01'),
  ('2027-09-02', '2027-10-02'),
  ('2027-09-03', '2027-10-03'),
  ('2027-09-04', '2027-10-04'),
  ('2027-09-05', '2027-10-05'),
  ('2027-09-06', '2027-10-06'),
  ('2027-09-07', '2027-10-07'),
  ('2027-09-08', '2027-10-08'),
  ('2027-09-09', '2027-10-09'),
  ('2027-09-10', '2027-10-10'),
  ('2027-09-11', '2027-10-11'),
  ('2027-09-12', '2027-10-12'),
  ('2027-09-13', '2027-10-13'),
  ('2027-09-14', '2027-10-14'),
  ('2027-09-15', '2027-10-15'),
  ('2027-09-16', '2027-10-16'),
  ('2027-09-17', '2027-10-17'),
  ('2027-09-18', '2027-10-18'),
  ('2027-09-19', '2027-10-19'),
  ('2027-09-20', '2027-10-20'),
  ('2027-09-21', '2027-10-21'),
  ('2027-09-22', '2027-10-22'),
  ('2027-09-23', '2027-10-23'),
  ('2027-09-24', '2027-10-24'),
  ('2027-09-25', '2027-10-25'),
  ('2027-09-26', '2027-10-26'),
  ('2027-09-27', '2027-10-27'),
  ('2027-09-28', '2027-10-28'),
  ('2027-09-29', '2027-10-29'),
  ('2027-09-30', '2027-10-31'),
  ('2027-10-01', '2027-11-01'),
  ('2027-10-02', '2027-11-02'),
  ('2027-10-03', '2027-11-03'),
  ('2027-10-04', '2027-11-04'),
  ('2027-10-05', '2027-11-05'),
  ('2027-10-06', '2027-11-06'),
  ('2027-10-07', '2027-11-07'),
  ('2027-10-08', '2027-11-08'),
  ('2027-10-09', '2027-11-09'),
  ('2027-10-10', '2027-11-10'),
  ('2027-10-11', '2027-11-11'),
  ('2027-10-12', '2027-11-12'),
  ('2027-10-13', '2027-11-13'),
  ('2027-10-14', '2027-11-14'),
  ('2027-10-15', '2027-11-15'),
  ('2027-10-16', '2027-11-16'),
  ('2027-10-17', '2027-11-17'),
  ('2027-10-18', '2027-11-18'),
  ('2027-10-19', '2027-11-19'),
  ('2027-10-20', '2027-11-20'),
  ('2027-10-21', '2027-11-21'),
  ('2027-10-22', '2027-11-22'),
  ('2027-10-23', '2027-11-23'),
  ('2027-10-24', '2027-11-24'),
  ('2027-10-25', '2027-11-25'),
  ('2027-10-26', '2027-11-26'),
  ('2027-10-27', '2027-11-27'),
  ('2027-10-28', '2027-11-28'),
  ('2027-10-29', '2027-11-29'),
  ('2027-10-30', '2027-11-30'),
  ('2027-10-31', '2027-11-30'),
  ('2027-11-01', '2027-12-01'),
  ('2027-11-02', '2027-12-02'),
  ('2027-11-03', '2027-12-03'),
  ('2027-11-04', '2027-12-04'),
  ('2027-11-05', '2027-12-05'),
  ('2027-11-06', '2027-12-06'),
  ('2027-11-07', '2027-12-07'),
  ('2027-11-08', '2027-12-08'),
  ('2027-11-09', '2027-12-09'),
  ('2027-11-10', '2027-12-10'),
  ('2027-11-11', '2027-12-11'),
  ('2027-11-12', '2027-12-12'),
  ('2027-11-13', '2027-12-13'),
  ('2027-11-14', '2027-12-14'),
  ('2027-11-15', '2027-12-15'),
  ('2027-11-16', '2027-12-16'),
  ('2027-11-17', '2027-12-17'),
  ('2027-11-18', '2027-12-18'),
  ('2027-11-19', '2027-12-19'),
  ('2027-11-20', '2027-12-20'),
  ('2027-11-21', '2027-12-21'),
  ('2027-11-22', '2027-12-22'),
  ('2027-11-23', '2027-12-23'),
  ('2027-11-24', '2027-12-24'),
  ('2027-11-25', '2027-12-25'),
  ('2027-11-26', '2027-12-26'),
  ('2027-11-27', '2027-12-27'),
  ('2027-11-28', '2027-12-28'),
  ('2027-11-29', '2027-12-29'),
  ('2027-11-30', '2027-12-31'),
  ('2027-12-01', '2028-01-01'),
  ('2027-12-02', '2028-01-02'),
  ('2027-12-03', '2028-01-03'),
  ('2027-12-04', '2028-01-04'),
  ('2027-12-05', '2028-01-05'),
  ('2027-12-06', '2028-01-06'),
  ('2027-12-07', '2028-01-07'),
  ('2027-12-08', '2028-01-08'),
  ('2027-12-09', '2028-01-09'),
  ('2027-12-10', '2028-01-10'),
  ('2027-12-11', '2028-01-11'),
  ('2027-12-12', '2028-01-12'),
  ('2027-12-13', '2028-01-13'),
  ('2027-12-14', '2028-01-14'),
  ('2027-12-15', '2028-01-15'),
  ('2027-12-16', '2028-01-16'),
  ('2027-12-17', '2028-01-17'),
  ('2027-12-18', '2028-01-18'),
  ('2027-12-19', '2028-01-19'),
  ('2027-12-20', '2028-01-20'),
  ('2027-12-21', '2028-01-21'),
  ('2027-12-22', '2028-01-22'),
  ('2027-12-23', '2028-01-23'),
  ('2027-12-24', '2028-01-24'),
  ('2027-12-25', '2028-01-25'),
  ('2027-12-26', '2028-01-26'),
  ('2027-12-27', '2028-01-27'),
  ('2027-12-28', '2028-01-28'),
  ('2027-12-29', '2028-01-29'),
  ('2027-12-30', '2028-01-30'),
  ('2027-12-31', '2028-01-31'),
  ('2028-01-01', '2028-02-01'),
  ('2028-01-02', '2028-02-02'),
  ('2028-01-03', '2028-02-03'),
  ('2028-01-04', '2028-02-04'),
  ('2028-01-05', '2028-02-05'),
  ('2028-01-06', '2028-02-06'),
  ('2028-01-07', '2028-02-07'),
  ('2028-01-08', '2028-02-08'),
  ('2028-01-09', '2028-02-09'),
  ('2028-01-10', '2028-02-10'),
  ('2028-01-11', '2028-02-11'),
  ('2028-01-12', '2028-02-12'),
  ('2028-01-13', '2028-02-13'),
  ('2028-01-14', '2028-02-14'),
  ('2028-01-15', '2028-02-15'),
  ('2028-01-16', '2028-02-16'),
  ('2028-01-17', '2028-02-17'),
  ('2028-01-18', '2028-02-18'),
  ('2028-01-19', '2028-02-19'),
  ('2028-01-20', '2028-02-20'),
  ('2028-01-21', '2028-02-21'),
  ('2028-01-22', '2028-02-22'),
  ('2028-01-23', '2028-02-23'),
  ('2028-01-24', '2028-02-24'),
  ('2028-01-25', '2028-02-25'),
  ('2028-01-26', '2028-02-26'),
  ('2028-01-27', '2028-02-27'),
  ('2028-01-28', '2028-02-28'),
  ('2028-01-29', '2028-02-29'),
  ('2028-01-30', '2028-02-29'),
  ('2028-01-31', '2028-02-29'),
  ('2028-02-01', '2028-03-01'),
  ('2028-02-02', '2028-03-02'),
  ('2028-02-03', '2028-03-03'),
  ('2028-02-04', '2028-03-04'),
  ('2028-02-05', '2028-03-05'),
  ('2028-02-06', '2028-03-06'),
  ('2028-02-07', '2028-03-07'),
  ('2028-02-08', '2028-03-08'),
  ('2028-02-09', '2028-03-09'),
  ('2028-02-10', '2028-03-10'),
  ('2028-02-11', '2028-03-11'),
  ('2028-02-12', '2028-03-12'),
  ('2028-02-13', '2028-03-13'),
  ('2028-02-14', '2028-03-14'),
  ('2028-02-15', '2028-03-15'),
  ('2028-02-16', '2028-03-16'),
  ('2028-02-17', '2028-03-17'),
  ('2028-02-18', '2028-03-18'),
  ('2028-02-19', '2028-03-19'),
  ('2028-02-20', '2028-03-20'),
  ('2028-02-21', '2028-03-21'),
  ('2028-02-22', '2028-03-22'),
  ('2028-02-23', '2028-03-23'),
  ('2028-02-24', '2028-03-24'),
  ('2028-02-25', '2028-03-25'),
  ('2028-02-26', '2028-03-26'),
  ('2028-02-27', '2028-03-27'),
  ('2028-02-28', '2028-03-28'),
  ('2028-02-29', '2028-03-31');
-- END GENERATED: due dates

-- Ad hoc surveys, one per legal reason with open and completed ones mixed. Notes carry no
-- personal information. Days count back from today in Seoul.
-- - 용접 2라인: open, due within 7 days, so the overview shows the deadline alert.
-- - 출하장: open, so the 물류 screening alert shows it instead of a start button.
insert into public.adhoc_surveys (
  workstation_id, trigger_reason, occurred_on, due_date, status, completed_on, note
)
select w.id, v.reason, d.occurred_on, d.due_date,
  case when v.completed_days_ago is null then 'open' else 'done' end,
  (now() at time zone 'Asia/Seoul')::date - v.completed_days_ago,
  v.note
from (values
  ('WLD-02', 'new_work', 25, null::integer, '측면 용접용 신규 지그 도입'),
  ('PRS-01', 'work_change', 10, null, '판재 두께 변경으로 투입 방식 변경'),
  ('LOG-02', 'work_change', 3, null, '출하 동선 변경'),
  ('ASM-A', 'disease', 120, 100, '임시건강진단 결과 반영'),
  ('PNT-01', 'new_work', 60, 40, '도장 부스 배기 장치 교체')
) as v (code, reason, occurred_days_ago, completed_days_ago, note)
join public.sites s on s.name = current_setting('demo.site_name')
join public.workstations w on w.site_id = s.id and w.code = v.code
join demo_due_dates d
  on d.occurred_on = (now() at time zone 'Asia/Seoul')::date - v.occurred_days_ago;

-- Every part must have landed; otherwise roll everything back.
do $$
declare
  site uuid := (select id from public.sites where name = current_setting('demo.site_name'));
begin
  if (select count(*) from public.workstations where site_id = site) <> 9
    or (select count(*) from public.tasks t join public.workstations w on w.id = t.workstation_id
        where w.site_id = site) <> 15
    or (select count(*) from public.assessments a
        join public.capture_sessions c on c.id = a.session_id
        join public.tasks t on t.id = c.task_id
        join public.workstations w on w.id = t.workstation_id
        where w.site_id = site) <> 12
    or (select count(*) from public.improvement_options o
        join public.workstations w on w.id = o.workstation_id where w.site_id = site) <> 10
    or (select count(*) from public.pain_reports r
        join public.workstations w on w.id = r.workstation_id where w.site_id = site) <> 32
    or (select count(*) from public.adhoc_surveys a
        join public.workstations w on w.id = a.workstation_id where w.site_id = site) <> 5
    or (select count(*) from public.option_effects e
        join public.simulation_captures c on c.id = e.capture_id
        join public.tasks t on t.id = c.task_id
        join public.workstations w on w.id = t.workstation_id where w.site_id = site) <> 3
    or (select count(*) from public.improvement_requests r
        join public.workstations w on w.id = r.workstation_id where w.site_id = site) <> 4
    or (select count(*) from public.quotes q
        join public.improvement_requests r on r.id = q.request_id
        join public.workstations w on w.id = r.workstation_id where w.site_id = site) <> 9
    or (select count(*) from public.improvement_options o
        join public.workstations w on w.id = o.workstation_id
        where w.site_id = site and o.quote_id is not null) <> 1
  then
    raise exception 'demo data is incomplete (is today outside the due date table?); nothing was saved';
  end if;
end;
$$;

commit;
