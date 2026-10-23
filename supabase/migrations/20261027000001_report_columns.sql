-- The report draft needs more of each task's latest assessment (docs/console-metrics.md).
-- create or replace view only allows new columns at the end. security_invoker is written again
-- so the view keeps running with the caller's rights and RLS.
create or replace view public.task_latest_assessments
with (security_invoker = true)
as
select distinct on (s.task_id)
  s.task_id,
  a.high_risk_ratio,
  a.level,
  a.score_p90,
  a.created_at,
  a.valid_frame_ratio,
  a.algorithm_version,
  a.part_summary
from public.assessments a
join public.capture_sessions s on s.id = a.session_id
where a.method = 'reba'
order by s.task_id, a.created_at desc, a.id desc;
