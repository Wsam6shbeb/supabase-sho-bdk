-- Prevent phone numbers in user-authored chat messages at the database boundary.
-- Client-side validation improves UX; this trigger prevents bypassing it through direct API calls.
create or replace function public.reject_phone_numbers_in_chat_message()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_body text;
begin
  if coalesce(new.message_type, 'text') <> 'text' then
    return new;
  end if;

  v_body := translate(
    coalesce(new.body, ''),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );

  if v_body ~ '(^|[^0-9])09[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
     or v_body ~ '(^|[^0-9])(([+]|00)?963)[[:space:]().-]*9[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
     or v_body ~ '(^|[^0-9])([+]|00)[[:space:]]*[0-9][0-9[:space:]().-]{7,}[0-9]([^0-9]|$)'
     or v_body ~ '(^|[^0-9])[0-9]{9,15}([^0-9]|$)'
     or v_body ~ '(^|[^0-9])[0-9]([[:space:]().-]+[0-9]){8,14}([^0-9]|$)' then
    raise exception 'PHONE_NUMBER_NOT_ALLOWED'
      using errcode = '23514',
            detail = 'Phone numbers are not allowed in chat messages.';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_phone_numbers_in_chat_message on public.messages;

create trigger reject_phone_numbers_in_chat_message
before insert or update of body on public.messages
for each row
execute function public.reject_phone_numbers_in_chat_message();


-- Agreements must not be created without a confirmed price.
-- The client now refuses ambiguous prices; this database guard also prevents bypassing that check.
create or replace function public.reject_agreement_without_price()
returns trigger
language plpgsql
set search_path = public
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
for each row
execute function public.reject_agreement_without_price();
