-- Server-side guard: phone numbers can't be typed into user-authored free text (chat, bio, descriptions, requests...).
-- Sharing a number happens only through the "share my phone" checkbox at agreement time.

create or replace function public.contains_phone_number(p_text text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text;
begin
  if p_text is null then
    return false;
  end if;
  v := translate(p_text, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  return v ~ '(^|[^0-9])09[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
      or v ~ '(^|[^0-9])(([+]|00)?963)[[:space:]().-]*9[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
      or v ~ '(^|[^0-9])([+]|00)[[:space:]]*[0-9][0-9[:space:]().-]{7,}[0-9]([^0-9]|$)'
      or v ~ '(^|[^0-9])[0-9]{9,15}([^0-9]|$)'
      or v ~ '(^|[^0-9])[0-9]([[:space:]().-]+[0-9]){8,14}([^0-9]|$)';
end;
$$;

-- Chat messages: clients may only send plain text; system messages come only from trusted server functions.
create or replace function public.reject_phone_numbers_in_chat_message()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(new.message_type::text, 'text') <> 'text' then
    if current_user in ('postgres', 'service_role', 'supabase_admin') then
      return new;
    end if;
    raise exception 'INVALID_MESSAGE_TYPE' using errcode = '23514';
  end if;
  if public.contains_phone_number(new.body) then
    raise exception 'PHONE_NUMBER_NOT_ALLOWED' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_phone_numbers_in_chat_message on public.messages;
create trigger reject_phone_numbers_in_chat_message
  before insert or update of body on public.messages
  for each row execute function public.reject_phone_numbers_in_chat_message();

-- Other free-text columns. Only values that CHANGED are checked, so legacy rows never block unrelated updates.
-- Arguments are column names; "a.b" reads a JSON key inside column a.
create or replace function public.reject_phone_numbers_in_text_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  col text;
  v_new text;
  v_old text;
begin
  foreach col in array tg_argv loop
    v_new := to_jsonb(new) #>> string_to_array(col, '.');
    v_old := case when tg_op = 'UPDATE' then to_jsonb(old) #>> string_to_array(col, '.') else null end;
    if v_new is not null and v_new is distinct from v_old and public.contains_phone_number(v_new) then
      raise exception 'PHONE_NUMBER_NOT_ALLOWED' using errcode = '23514', detail = 'Phone numbers are not allowed in ' || col;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists reject_phone_numbers_provider_profiles on public.provider_profiles;
create trigger reject_phone_numbers_provider_profiles
  before insert or update on public.provider_profiles
  for each row execute function public.reject_phone_numbers_in_text_columns('bio');

drop trigger if exists reject_phone_numbers_provider_services on public.provider_services;
create trigger reject_phone_numbers_provider_services
  before insert or update on public.provider_services
  for each row execute function public.reject_phone_numbers_in_text_columns('description', 'structured_data.additional_info');

drop trigger if exists reject_phone_numbers_service_requests on public.service_requests;
create trigger reject_phone_numbers_service_requests
  before insert or update on public.service_requests
  for each row execute function public.reject_phone_numbers_in_text_columns('raw_text', 'additional_info', 'service_area', 'region');

drop trigger if exists reject_phone_numbers_users on public.users;
create trigger reject_phone_numbers_users
  before insert or update on public.users
  for each row execute function public.reject_phone_numbers_in_text_columns('full_name');

drop trigger if exists reject_phone_numbers_ratings on public.ratings;
create trigger reject_phone_numbers_ratings
  before insert or update on public.ratings
  for each row execute function public.reject_phone_numbers_in_text_columns('comment');

drop trigger if exists reject_phone_numbers_reports on public.reports;
create trigger reject_phone_numbers_reports
  before insert or update on public.reports
  for each row execute function public.reject_phone_numbers_in_text_columns('details');
