-- Synthetic demo tasks with REBA manager inputs (docs/assessment-rules.md). Run after seed.sql.
-- Safe to run again: a task whose name already exists on its workstation is skipped.

-- Workstations are found by site name, so a duplicated site would get the tasks too.
do $$
begin
  if (select count(*) from public.sites where name = '합성 제1공장') <> 1 then
    raise exception 'expected exactly one site named 합성 제1공장';
  end if;
end;
$$;

insert into public.tasks (
  workstation_id, name, daily_hours, load_category, load_shock, coupling,
  static_hold, unstable_base, sitting, arm_supported
)
select w.id, t.name, t.daily_hours, t.load_category, t.load_shock, t.coupling,
  t.static_hold, t.unstable_base, t.sitting, t.arm_supported
from (values
  ('WLD-03', '하부 용접', 4, 'lt5', false, 'fair', true, false, false, false),
  ('WLD-03', '부품 올리기', 2, '5to10', false, 'fair', false, false, false, false),
  ('PRS-02', '판재 투입', 6, '5to10', false, 'fair', false, false, false, false),
  ('PNT-A1', '스프레이 도장', 5, 'lt5', false, 'good', true, false, false, false),
  ('ASM-01', '볼트 체결', 7, 'lt5', false, 'good', false, false, false, false),
  ('LOG-01', '박스 하역', 3, 'gt10', true, 'poor', false, true, false, false),
  ('PKG-01', '상자 포장', 6, 'lt5', false, 'fair', false, false, true, true)
) as t (
  code, name, daily_hours, load_category, load_shock, coupling,
  static_hold, unstable_base, sitting, arm_supported
)
join public.sites s on s.name = '합성 제1공장'
join public.workstations w on w.site_id = s.id and w.code = t.code
where not exists (
  select 1 from public.tasks existing
  where existing.workstation_id = w.id and existing.name = t.name
);
