-- Agreements must not be created without a confirmed price.
-- The client already refuses ambiguous prices; this guard stops anyone bypassing it through the API
-- (a NULL price would fall back to the default commission instead of the real 5%).
create or replace function public.reject_agreement_without_price()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.price is null then
    raise exception 'AGREED_PRICE_REQUIRED'
      using errcode = '23514',
            detail = 'A confirmed service price is required before creating an agreement.';
  end if;
  return new;
end;
$$;

drop trigger if exists agreements_require_confirmed_price on public.agreements;
create trigger agreements_require_confirmed_price
  before insert or update of price on public.agreements
  for each row execute function public.reject_agreement_without_price();
