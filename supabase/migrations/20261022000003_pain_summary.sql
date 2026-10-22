-- Pain report grouping rule and weekly summary (docs/data-model.md, CLAUDE.md security principles).

-- Which parent_groups can show pain reports. Reads workstations only, never pain_reports,
-- so it reveals nothing about whether reports exist. RLS on workstations applies to the caller.
-- - merged: the group has a workstation with fewer than 5 people, so the whole group is one row.
-- - visible = false: a merged group with a single workstation or fewer than 5 people in total.
create view public.pain_group_visibility
with (security_invoker = true)
as
select
  site_id,
  parent_group,
  workstation_count,
  merged,
  reason is null as visible,
  reason
from (
  select
    w.site_id,
    w.parent_group,
    count(*)::integer as workstation_count,
    bool_or(w.headcount < 5) as merged,
    case
      when not bool_or(w.headcount < 5) then null
      when count(*) < 2 then 'single_workstation'
      when sum(w.headcount) < 5 then 'under_five'
    end as reason
  from public.workstations w
  group by w.site_id, w.parent_group
) as g;

revoke all on public.pain_group_visibility from public, anon, authenticated, service_role;
grant select on public.pain_group_visibility to authenticated;

-- Weekly summary for managers.
-- - Uses pain_group_visibility for the grouping rule; hidden groups produce no row at all.
-- - Only reports whose visible_from has passed are counted (24-hour delay for small workstations).
-- - No individual report time is exposed; rows are bucketed by week (Monday start, Asia/Seoul).
--
-- The view runs with its owner's privileges (security_invoker is off) because managers have no
-- privileges on pain_reports. It filters to the caller's own sites itself.
create view public.workstation_pain_summary
with (security_barrier = true)
as
with units as (
  select
    w.id as workstation_id,
    w.site_id,
    w.parent_group,
    g.merged,
    case when g.merged then null else w.id end as unit_workstation_id,
    case when g.merged then w.parent_group else w.name end as label
  from public.workstations w
  join public.pain_group_visibility g
    on g.site_id = w.site_id and g.parent_group = w.parent_group
  where g.visible
)
select
  u.site_id,
  u.parent_group,
  u.unit_workstation_id as workstation_id,
  u.label,
  u.merged,
  date_trunc('week', r.created_at at time zone 'Asia/Seoul')::date as week_start,
  count(*)::integer as report_count,
  (count(*) filter (where r.intensity = 'mild'))::integer as mild_count,
  (count(*) filter (where r.intensity = 'moderate'))::integer as moderate_count,
  (count(*) filter (where r.intensity = 'severe'))::integer as severe_count,
  (count(*) filter (where r.intensity = 'very_severe'))::integer as very_severe_count,
  (count(*) filter (where 'neck' = any (r.body_parts)))::integer as neck_count,
  (count(*) filter (where 'shoulder' = any (r.body_parts)))::integer as shoulder_count,
  (count(*) filter (where 'arm_elbow' = any (r.body_parts)))::integer as arm_elbow_count,
  (count(*) filter (where 'hand_wrist' = any (r.body_parts)))::integer as hand_wrist_count,
  (count(*) filter (where 'lower_back' = any (r.body_parts)))::integer as lower_back_count,
  (count(*) filter (where 'leg_foot' = any (r.body_parts)))::integer as leg_foot_count
from units u
join public.pain_reports r on r.workstation_id = u.workstation_id
where r.visible_from <= now()
  and u.site_id in (select private.managed_site_ids())
group by u.site_id, u.parent_group, u.unit_workstation_id, u.label, u.merged, week_start;

revoke all on public.workstation_pain_summary from public, anon, authenticated, service_role;
grant select on public.workstation_pain_summary to authenticated;
