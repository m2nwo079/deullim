-- Improvement requests and quotes (docs/data-model.md): a manager opens a request for one
-- improvement option, partners quote on open requests, and the manager accepts one quote.
-- Status changes go through open_request, close_request and accept_quote only.

-- option_id is added as not null, so both tables must be empty (checked in dev and prod).
do $$
begin
  if exists (select 1 from public.improvement_requests) or exists (select 1 from public.quotes) then
    raise exception 'improvement_requests and quotes must be empty before this migration';
  end if;
end;
$$;

-- Requests: what partners see is only title, description and desired date.
alter table public.improvement_requests
  add column option_id uuid not null references public.improvement_options (id) on delete cascade,
  add column title text not null check (char_length(title) between 1 and 80),
  add column description text check (char_length(description) <= 1000),
  add column desired_by date,
  add column created_at timestamptz not null default now(),
  add column opened_at timestamptz,
  add column closed_at timestamptz,
  add constraint improvement_requests_status_times check (
    (status = 'draft' and opened_at is null and closed_at is null)
    or (status = 'open' and opened_at is not null and closed_at is null)
    or (status = 'closed' and opened_at is not null and closed_at is not null)
  );

-- At most one draft or open request per option.
create unique index improvement_requests_one_active
  on public.improvement_requests (option_id)
  where status in ('draft', 'open');

-- The option must be on the request's workstation; content changes only while a draft.
create function private.check_improvement_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.improvement_options o
    where o.id = new.option_id and o.workstation_id = new.workstation_id
  ) then
    raise exception 'option % is not on workstation %', new.option_id, new.workstation_id
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft'
    and (new.title, new.description, new.desired_by)
      is distinct from (old.title, old.description, old.desired_by) then
    raise exception 'only draft requests can be edited' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger improvement_requests_check
  before insert or update on public.improvement_requests
  for each row execute function private.check_improvement_request();

-- Quotes: one per partner and request, with a note and times.
alter table public.quotes
  add column note text check (char_length(note) <= 500),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint quotes_one_per_partner unique (request_id, partner_id);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function private.touch_updated_at();

-- Options: quote_id names the accepted quote the cost came from. A cost typed by the manager
-- clears it, and it can only point to an accepted quote of a request for this option.
create function private.check_option_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.cost is distinct from old.cost
    and new.quote_id is not distinct from old.quote_id then
    new.quote_id := null;
  end if;
  if new.quote_id is not null
    and (tg_op = 'INSERT' or new.quote_id is distinct from old.quote_id)
    and not exists (
      select 1
      from public.quotes q
      join public.improvement_requests r on r.id = q.request_id
      where q.id = new.quote_id and q.status = 'accepted' and r.option_id = new.id
    ) then
    raise exception 'quote % is not an accepted quote for option %', new.quote_id, new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger improvement_options_check_quote
  before insert or update on public.improvement_options
  for each row execute function private.check_option_quote();

revoke all on function private.check_improvement_request() from public;
revoke all on function private.touch_updated_at() from public;
revoke all on function private.check_option_quote() from public;

-- Requests a partner company has quoted on, read without RLS to avoid a policy cycle between
-- improvement_requests and quotes.
create function private.quoted_request_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select q.request_id
  from public.quotes q
  where q.partner_id in (select private.member_partner_ids());
$$;
revoke all on function private.quoted_request_ids() from public;
grant execute on function private.quoted_request_ids() to authenticated;

-- Managers write request content only; new requests are always drafts.
revoke insert, update on public.improvement_requests from authenticated;
grant insert (workstation_id, option_id, title, description, desired_by)
  on public.improvement_requests to authenticated;
grant update (title, description, desired_by) on public.improvement_requests to authenticated;
create policy improvement_requests_delete_draft on public.improvement_requests
  as restrictive for delete to authenticated
  using (status = 'draft');

-- Partners read open requests, and requests they have quoted on after those close.
drop policy improvement_requests_select_partner on public.improvement_requests;
create policy improvement_requests_select_partner on public.improvement_requests
  for select to authenticated
  using (
    (status = 'open' and exists (select 1 from private.member_partner_ids()))
    or id in (select private.quoted_request_ids())
  );

-- Partners change or withdraw their own quote only while it is submitted and the request open.
grant insert (note), update (note) on public.quotes to authenticated;
grant delete on public.quotes to authenticated;
drop policy quotes_update_partner on public.quotes;
create policy quotes_update_partner on public.quotes
  for update to authenticated
  using (
    partner_id in (select private.member_partner_ids())
    and status = 'submitted'
    and request_id in (select r.id from public.improvement_requests r where r.status = 'open')
  )
  with check (partner_id in (select private.member_partner_ids()));
create policy quotes_delete_partner on public.quotes
  for delete to authenticated
  using (
    partner_id in (select private.member_partner_ids())
    and status = 'submitted'
    and request_id in (select r.id from public.improvement_requests r where r.status = 'open')
  );

-- Managers read the names of companies that quoted on their requests.
create policy partners_select_manager on public.partners
  for select to authenticated
  using (id in (select q.partner_id from public.quotes q));

-- An option with a draft or open request cannot be deleted; close the request first.
-- Deleting the option removes its closed requests and their quotes (cascade).
create policy improvement_options_delete_no_active_request on public.improvement_options
  as restrictive for delete to authenticated
  using (not exists (
    select 1 from public.improvement_requests r
    where r.option_id = improvement_options.id and r.status in ('draft', 'open')
  ));

-- Status changes. security definer: the caller must manage the request's workstation
-- (private.managed_workstation_ids filters by auth.uid() and the manager role itself).
create function public.open_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.improvement_requests r
    where r.id = p_request_id and r.workstation_id in (select private.managed_workstation_ids())
  ) then
    raise exception 'request % is not on a managed workstation', p_request_id
      using errcode = 'insufficient_privilege';
  end if;
  update public.improvement_requests
  set status = 'open', opened_at = now()
  where id = p_request_id and status = 'draft';
  if not found then
    raise exception 'request % is not a draft', p_request_id
      using errcode = 'object_not_in_prerequisite_state';
  end if;
end;
$$;

-- Closes an open request without accepting; submitted quotes become rejected.
create function public.close_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.improvement_requests r
    where r.id = p_request_id and r.workstation_id in (select private.managed_workstation_ids())
  ) then
    raise exception 'request % is not on a managed workstation', p_request_id
      using errcode = 'insufficient_privilege';
  end if;
  update public.improvement_requests
  set status = 'closed', closed_at = now()
  where id = p_request_id and status = 'open';
  if not found then
    raise exception 'request % is not open', p_request_id
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  update public.quotes set status = 'rejected'
  where request_id = p_request_id and status = 'submitted';
end;
$$;

-- Accepts one quote: the request closes, the other submitted quotes become rejected, and the
-- option's cost becomes the quoted price. p_price and p_updated_at are what the manager saw;
-- if the partner changed the quote since, nothing changes (serialization_failure).
create function public.accept_quote(p_quote_id uuid, p_price bigint, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_request public.improvement_requests%rowtype;
begin
  select r.* into v_request
  from public.improvement_requests r
  join public.quotes q on q.request_id = r.id
  where q.id = p_quote_id and r.workstation_id in (select private.managed_workstation_ids())
  for update of r;
  if not found then
    raise exception 'quote % is not on a managed workstation', p_quote_id
      using errcode = 'insufficient_privilege';
  end if;
  select * into v_quote from public.quotes q where q.id = p_quote_id for update;
  if v_request.status <> 'open' or v_quote.status <> 'submitted' then
    raise exception 'quote % cannot be accepted now', p_quote_id
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_quote.price <> p_price or v_quote.updated_at <> p_updated_at then
    raise exception 'quote % changed after it was shown', p_quote_id
      using errcode = 'serialization_failure';
  end if;

  update public.quotes
  set status = case when id = p_quote_id then 'accepted' else 'rejected' end
  where request_id = v_request.id and status = 'submitted';
  update public.improvement_requests
  set status = 'closed', closed_at = now()
  where id = v_request.id;
  update public.improvement_options
  set cost = v_quote.price, quote_id = v_quote.id
  where id = v_request.option_id;
end;
$$;

revoke all on function public.open_request(uuid) from public, anon, service_role;
revoke all on function public.close_request(uuid) from public, anon, service_role;
revoke all on function public.accept_quote(uuid, bigint, timestamptz) from public, anon, service_role;
grant execute on function public.open_request(uuid) to authenticated;
grant execute on function public.close_request(uuid) to authenticated;
grant execute on function public.accept_quote(uuid, bigint, timestamptz) to authenticated;
