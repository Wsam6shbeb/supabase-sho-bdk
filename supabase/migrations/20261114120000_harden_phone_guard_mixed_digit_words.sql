-- Harden phone detection for spoken digits mixed with numeric groups.
-- Existing chat trigger should already call public.contains_phone_number(text).
create or replace function public.normalize_phone_text(p_text text)
returns text language plpgsql immutable set search_path = public
as $$
declare v text := coalesce(p_text, '');
begin
  v := regexp_replace(v, U&'[\200B-\200F\202A-\202E\2060\FEFF\064B-\065F\0670\0640]', '', 'g');
  v := translate(v, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  v := regexp_replace(v, '\m(صفر|زيرو|zero)\M', '0', 'gi');
  v := regexp_replace(v, '\m(واحده|واحدة|واحد|أحد|احد|one)\M', '1', 'gi');
  v := regexp_replace(v, '\m(اثنين|اتنين|تنين|ثنين|two)\M', '2', 'gi');
  v := regexp_replace(v, '\m(ثلاثة|ثلاثه|تلاتة|تلاته|three)\M', '3', 'gi');
  v := regexp_replace(v, '\m(أربعة|اربعة|أربعه|اربعه|four)\M', '4', 'gi');
  v := regexp_replace(v, '\m(خمسة|خمسه|five)\M', '5', 'gi');
  v := regexp_replace(v, '\m(ستة|سته|six)\M', '6', 'gi');
  v := regexp_replace(v, '\m(سبعة|سبعه|seven)\M', '7', 'gi');
  v := regexp_replace(v, '\m(ثمانية|ثمانيه|تمانية|تمانه|تمانة|تمنية|تمنيه|eight)\M', '8', 'gi');
  v := regexp_replace(v, '\m(تسعة|تسعه|nine)\M', '9', 'gi');
  return v;
end;
$$;

create or replace function public.contains_phone_number(p_text text)
returns boolean language plpgsql immutable set search_path = public
as $$
declare v text; m text; v_digits integer; v_singles integer;
begin
  if p_text is null then return false; end if;
  v := public.normalize_phone_text(p_text);
  if v ~ '(^|[^0-9])09[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
     or v ~ '(^|[^0-9])(([+]|00)?963)[[:space:]().-]*9[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
     or v ~ '(^|[^0-9])([+]|00)[[:space:]]*[0-9][0-9[:space:]().-]{7,}[0-9]([^0-9]|$)'
     or v ~ '(^|[^0-9])[0-9]{9,15}([^0-9]|$)'
     or v ~ '(^|[^0-9])[0-9]([[:space:]().-]+[0-9]){8,14}([^0-9]|$)'
     or v ~ '(^|[^0-9])0[[:space:]().-]*9[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)'
     or v ~ '(^|[^0-9])([+]|00)?[[:space:]().-]*9[[:space:]().-]*6[[:space:]().-]*3[[:space:]().-]*9[[:space:]().-]*[0-9][0-9[:space:]().-]{6,}[0-9]([^0-9]|$)' then
    return true;
  end if;
  for m in select (regexp_matches(v, '[0-9][0-9[:space:]().-]*[0-9]', 'g'))[1]
  loop
    v_digits := length(regexp_replace(m, '[^0-9]', '', 'g'));
    if v_digits >= 9 then
      select count(*) into v_singles
      from unnest(regexp_split_to_array(m, '[[:space:]().-]+')) as token
      where length(token) = 1 and token ~ '^[0-9]$';
      if v_singles >= 3 then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;
