-- Deullim schema v1. Tables and columns follow docs/data-model.md.
-- Workers have no accounts: pain_reports and suggestions have no author column.

create schema if not exists private;

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.workstations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  -- Upper unit used to merge workstations with fewer than 5 people.
  parent_group text not null,
  name text not null,
  code text,
  headcount integer not null check (headcount >= 0),
  unique (site_id, code)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid not null references public.workstations (id) on delete cascade,
  name text not null,
  daily_hours numeric not null check (daily_hours > 0 and daily_hours <= 24),
  load_category text not null check (load_category in ('lt5', '5to10', 'gt10')),
  load_shock boolean not null default false,
  coupling text not null check (coupling in ('good', 'fair', 'poor', 'unacceptable')),
  static_hold boolean not null default false,
  unstable_base boolean not null default false,
  sitting boolean not null default false,
  arm_supported boolean not null default false
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('manager', 'partner')),
  display_name text not null
);

create table public.site_members (
  site_id uuid not null references public.sites (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (site_id, profile_id)
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  company_name text not null
);

create table public.partner_members (
  partner_id uuid not null references public.partners (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (partner_id, profile_id)
);

-- QR entry tokens. Only the SHA-256 hash is stored, never the raw token.
create table public.entry_tokens (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid not null references public.workstations (id) on delete cascade,
  token_hash text not null unique,
  active boolean not null default true,
  expires_at timestamptz not null default now() + interval '90 days'
);

create table public.report_rate_limits (
  token_id uuid not null references public.entry_tokens (id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (token_id, window_start)
);

create table public.capture_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  frame_count integer not null check (frame_count >= 0),
  inference_fps numeric not null check (inference_fps > 0),
  created_at timestamptz not null default now()
);

-- Scores recomputed on the server (docs/assessment-rules.md, session results).
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.capture_sessions (id) on delete cascade,
  method text not null check (method in ('reba', 'rula')),
  part_summary jsonb not null,
  valid_frame_ratio numeric not null check (valid_frame_ratio between 0 and 1),
  high_risk_ratio numeric not null check (high_risk_ratio between 0 and 1),
  score_p90 numeric not null,
  level text not null check (level in ('low', 'caution', 'high', 'very-high')),
  algorithm_version text not null,
  created_at timestamptz not null default now()
);

create table public.pain_reports (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid not null references public.workstations (id) on delete cascade,
  body_parts text[] not null check (
    cardinality(body_parts) > 0
    and body_parts <@ array['neck', 'shoulder', 'arm_elbow', 'hand_wrist', 'lower_back', 'leg_foot']
  ),
  intensity text not null check (intensity in ('mild', 'moderate', 'severe', 'very_severe')),
  created_at timestamptz not null default now(),
  -- Set by trigger; any value sent by the caller is overwritten.
  visible_from timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid not null references public.workstations (id) on delete cascade,
  body text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

create table public.improvement_requests (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid not null references public.workstations (id) on delete cascade,
  -- Partners can read only requests in the open status.
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by uuid not null default auth.uid() references public.profiles (id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.improvement_requests (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  price bigint not null check (price >= 0),
  lead_time_days integer not null check (lead_time_days >= 0),
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected'))
);

create table public.improvement_options (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid not null references public.workstations (id) on delete cascade,
  title text not null,
  cost bigint not null check (cost >= 0),
  expected_risk_reduction numeric,
  duration_days integer check (duration_days >= 0),
  quote_id uuid unique references public.quotes (id) on delete set null
);

create table public.option_effects (
  option_id uuid not null references public.improvement_options (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  expected_high_risk_ratio numeric not null check (expected_high_risk_ratio between 0 and 1),
  source text not null check (source in ('simulation', 'manual')),
  primary key (option_id, task_id)
);

create table public.improvement_plans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  budget bigint not null check (budget >= 0),
  solver_version text not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.plan_items (
  plan_id uuid not null references public.improvement_plans (id) on delete cascade,
  option_id uuid not null references public.improvement_options (id) on delete cascade,
  primary key (plan_id, option_id)
);

create table public.adhoc_surveys (
  id uuid primary key default gen_random_uuid(),
  workstation_id uuid not null references public.workstations (id) on delete cascade,
  trigger_reason text not null,
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'done'))
);

-- Reports from workstations with fewer than 5 people become visible 24 hours later
-- (CLAUDE.md security principles, docs/data-model.md).
create function private.set_pain_report_visible_from()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.visible_from := new.created_at + case
    when (select w.headcount from public.workstations w where w.id = new.workstation_id) < 5
      then interval '24 hours'
    else interval '0'
  end;
  return new;
end;
$$;

create trigger pain_reports_set_visible_from
before insert or update of created_at, workstation_id, visible_from on public.pain_reports
for each row execute function private.set_pain_report_visible_from();
