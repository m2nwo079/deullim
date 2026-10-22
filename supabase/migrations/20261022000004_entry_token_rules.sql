-- One active QR token per workstation, atomic issue/reissue, and update guards (docs/data-model.md).

create unique index entry_tokens_one_active_per_workstation
  on public.entry_tokens (workstation_id)
  where active;

-- Deactivates the workstation's active token and adds a new one in one transaction.
-- Runs with the caller's privileges, so RLS limits it to the manager's own sites.
-- Result columns are prefixed to avoid ambiguity with the table's column names.
create function public.issue_entry_token(p_workstation_id uuid, p_token_hash text)
returns table (token_id uuid, token_expires_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.entry_tokens t
  set active = false
  where t.workstation_id = p_workstation_id and t.active;

  return query
  insert into public.entry_tokens as t (workstation_id, token_hash)
  values (p_workstation_id, p_token_hash)
  returning t.id, t.expires_at;
end;
$$;

revoke all on function public.issue_entry_token(uuid, text) from public, anon;
grant execute on function public.issue_entry_token(uuid, text) to authenticated;

-- Inactive tokens are final (no reactivation, no extension); expiry can reach at most 90 days ahead.
create function private.guard_entry_token_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not old.active then
    raise exception 'inactive entry tokens cannot be changed';
  end if;
  if new.expires_at > now() + interval '90 days' then
    raise exception 'entry token expiry cannot exceed 90 days from now';
  end if;
  return new;
end;
$$;

create trigger entry_tokens_guard_update
before update on public.entry_tokens
for each row execute function private.guard_entry_token_update();
