-- Synthetic demo data. No real company, person, account or token.
-- Run once after the migrations. Accounts are linked separately with link-accounts.sql.

with site as (
  insert into public.sites (name) values ('합성 제1공장') returning id
)
insert into public.workstations (site_id, parent_group, name, code, headcount)
select site.id, w.parent_group, w.name, w.code, w.headcount
from site, (values
  ('차체', '용접 3번 작업대', 'WLD-03', 6),
  ('차체', '프레스 2라인', 'PRS-02', 8),
  ('도장', '도장 부스 A', 'PNT-A1', 5),
  ('조립', '조립 1라인', 'ASM-01', 12),
  -- Fewer than 5 people: must appear only inside the merged '물류' row.
  ('물류', '자재 입고장', 'LOG-01', 3),
  ('물류', '포장 라인', 'PKG-01', 7)
) as w (parent_group, name, code, headcount);

-- Second site, used only to check that one site's manager cannot see another site's rows.
with site as (
  insert into public.sites (name) values ('합성 제2공장') returning id
)
insert into public.workstations (site_id, parent_group, name, code, headcount)
select site.id, w.parent_group, w.name, w.code, w.headcount
from site, (values
  ('가공', '가공 1라인', 'MCH-01', 9),
  ('가공', '가공 2라인', 'MCH-02', 6)
) as w (parent_group, name, code, headcount);

insert into public.partners (company_name) values ('합성 설비 업체');

-- Pain reports created 25 hours ago or earlier, so the 24-hour delay has already passed.
-- Body parts and intensity cycle deterministically.
insert into public.pain_reports (workstation_id, body_parts, intensity, created_at)
select
  w.id,
  array[(array['neck', 'shoulder', 'arm_elbow', 'hand_wrist', 'lower_back', 'leg_foot'])[1 + n % 6]],
  (array['mild', 'moderate', 'severe', 'very_severe'])[1 + n % 4],
  now() - make_interval(hours => 25 + n * 3)
from (values
  ('합성 제1공장', 'WLD-03', 7),
  ('합성 제1공장', 'PRS-02', 5),
  ('합성 제1공장', 'PNT-A1', 3),
  ('합성 제1공장', 'ASM-01', 4),
  ('합성 제1공장', 'LOG-01', 2),
  ('합성 제2공장', 'MCH-01', 4),
  ('합성 제2공장', 'MCH-02', 3)
) as c (site_name, code, reports)
join public.sites s on s.name = c.site_name
join public.workstations w on w.site_id = s.id and w.code = c.code
cross join lateral generate_series(1, c.reports) as n;
