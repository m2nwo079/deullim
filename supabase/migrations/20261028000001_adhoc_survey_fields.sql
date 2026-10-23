-- Ad hoc surveys: legal reason codes, occurrence date, note and completion (docs/data-model.md).
alter table public.adhoc_surveys
  add column occurred_on date not null,
  add column note text check (char_length(note) <= 500),
  add column completed_on date,
  add column created_at timestamptz not null default now(),
  add constraint adhoc_surveys_trigger_reason_check
    check (trigger_reason in ('disease', 'new_work', 'work_change')),
  -- The due date is computed by the app (Civil Act art. 157, 160); this only bounds it.
  add constraint adhoc_surveys_due_date_check
    check (due_date > occurred_on and due_date <= occurred_on + 31),
  add constraint adhoc_surveys_completed_check
    check ((status = 'done') = (completed_on is not null)
      and (completed_on is null or completed_on >= occurred_on));

-- One open survey per workstation.
create unique index adhoc_surveys_one_open
  on public.adhoc_surveys (workstation_id) where status = 'open';
