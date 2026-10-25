-- quotes.updated_at is the partner's last change (docs/data-model.md): only a change of price,
-- lead_time_days or note moves it. Status changes by accept_quote and close_request keep it,
-- so a closed request still shows when each company last changed its quote. The acceptance
-- time is improvement_requests.closed_at.
-- accept_quote compares updated_at with what the manager saw; that check is about partner
-- changes, so it keeps working. Rows already touched by a status change are not restored.
drop trigger quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at
  before update of price, lead_time_days, note on public.quotes
  for each row
  when (
    old.price is distinct from new.price
    or old.lead_time_days is distinct from new.lead_time_days
    or old.note is distinct from new.note
  )
  execute function private.touch_updated_at();
