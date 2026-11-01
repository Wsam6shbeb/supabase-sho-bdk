-- Extend the existing chat phone guard to catch phone numbers written as digit words.
-- The same normalization is implemented in the app for an immediate user-facing warning.

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

  -- Convert common Arabic/colloquial and English spoken digit names.
  v_body := regexp_replace(v_body, '(صفر|زيرو|zero)', '0', 'gi');
  v_body := regexp_replace(v_body, '(واحده|واحدة|واحد|أحد|احد|one)', '1', 'gi');
  v_body := regexp_replace(v_body, '(اثنين|اتنين|تنين|ثنين|two)', '2', 'gi');
  v_body := regexp_replace(v_body, '(ثلاثة|ثلاثه|تلاتة|تلاته|three)', '3', 'gi');
  v_body := regexp_replace(v_body, '(أربعة|اربعة|أربعه|اربعه|four)', '4', 'gi');
  v_body := regexp_replace(v_body, '(خمسة|خمسه|five)', '5', 'gi');
  v_body := regexp_replace(v_body, '(ستة|سته|six)', '6', 'gi');
  v_body := regexp_replace(v_body, '(سبعة|سبعه|seven)', '7', 'gi');
  v_body := regexp_replace(v_body, '(ثمانية|ثمانيه|تمانية|تمنية|تمنيه|eight)', '8', 'gi');
  v_body := regexp_replace(v_body, '(تسعة|تسعه|nine)', '9', 'gi');

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
