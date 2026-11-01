-- Add additional colloquial Syrian spellings for the spoken digit eight.
-- Keep the database guard aligned with src/domain/chatSafety.ts.
create or replace function public.reject_phone_numbers_in_chat_message()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_body text;
begin
  if coalesce(new.message_type, 'text') <> 'text' then
    if current_user in ('postgres', 'service_role', 'supabase_admin') then
      return new;
    end if;
    raise exception 'INVALID_MESSAGE_TYPE'
      using errcode = '23514',
            detail = 'Clients may only send text chat messages.';
  end if;

  v_body := translate(
    coalesce(new.body, ''),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );

  v_body := regexp_replace(v_body, '\m(صفر|زيرو|zero)\M', '0', 'gi');
  v_body := regexp_replace(v_body, '\m(واحده|واحدة|واحد|أحد|احد|one)\M', '1', 'gi');
  v_body := regexp_replace(v_body, '\m(اثنين|اتنين|تنين|ثنين|two)\M', '2', 'gi');
  v_body := regexp_replace(v_body, '\m(ثلاثة|ثلاثه|تلاتة|تلاته|three)\M', '3', 'gi');
  v_body := regexp_replace(v_body, '\m(أربعة|اربعة|أربعه|اربعه|four)\M', '4', 'gi');
  v_body := regexp_replace(v_body, '\m(خمسة|خمسه|five)\M', '5', 'gi');
  v_body := regexp_replace(v_body, '\m(ستة|سته|six)\M', '6', 'gi');
  v_body := regexp_replace(v_body, '\m(سبعة|سبعه|seven)\M', '7', 'gi');
  v_body := regexp_replace(v_body, '\m(ثمانية|ثمانيه|تمانية|تمانه|تمانة|تمنية|تمنيه|eight)\M', '8', 'gi');
  v_body := regexp_replace(v_body, '\m(تسعة|تسعه|nine)\M', '9', 'gi');

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
