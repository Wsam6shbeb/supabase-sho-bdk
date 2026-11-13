-- ===============================================================
-- فرص العمل: تحديد معدل get_job_contact + تحصين job_ad_event
--
-- 1) get_job_contact: حد للدقيقة وحد لليوم لكل حساب (صاحب الوظيفة معفى عند قراءة وسيلة تواصله).
--    صارت VOLATILE لأنها تكتب العدّاد؛ دالة STABLE عبر PostgREST تعمل في معاملة للقراءة فقط.
--    الحدود قابلة للتعديل من app_settings بدون migration جديد:
--      jobs_contact_per_minute (الافتراضي 10)   jobs_contact_per_day (الافتراضي 100)
--
-- 2) job_ad_event: لا يُحسب الحدث إلا إذا كان الإعلان فعّالاً الآن، ومرة واحدة فقط لكل
--    (مستخدم، إعلان، نوع حدث) كل 24 ساعة، فوق حد عام على عدد الاستدعاءات.
--    الجدول المساعد محدود الحجم: صف واحد لكل (مستخدم، إعلان، نوع) ولا يكبر مع الزمن.
-- ===============================================================

-- ---------- جدول تتبع أحداث الإعلانات ----------
create table if not exists private.job_ad_event_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  ad_id uuid not null references public.job_ads (id) on delete cascade,
  event text not null check (event in ('impression', 'click')),
  last_counted_at timestamptz not null default now(),
  primary key (user_id, ad_id, event)
);
alter table private.job_ad_event_log enable row level security;

-- ---------- 1) get_job_contact ----------
create or replace function public.get_job_contact(p_job_id uuid)
returns table(contact_type text, contact_value text)
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_owner uuid;
  v_limit record;
begin
  if auth.uid() is null or not public.current_user_is_active() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- نفس شرط الرؤية السابق: وظيفة فعّالة غير منتهية، أو وظيفة المستخدم نفسه
  select j.user_id into v_owner
    from public.job_posts j
   where j.id = p_job_id
     and ((j.status = 'active' and j.expires_at > now()) or j.user_id = auth.uid());
  if not found then
    return;
  end if;

  -- صاحب الوظيفة يقرأ وسيلة تواصله هو: لا خصوصية معرّضة ولا حد
  if v_owner is distinct from auth.uid() then
    select * into v_limit
      from public.consume_ai_rate_limit(
        auth.uid(),
        'job_contact',
        public._job_setting_int('jobs_contact_per_minute', 10),
        public._job_setting_int('jobs_contact_per_day', 100));
    if not v_limit.allowed then
      -- الاستثناء يتراجع عن زيادة العدّاد، فيبقى العدّاد عند الحد ولا تتراكم محاولات المحجوب
      raise exception 'RATE_LIMITED' using errcode = 'P0001', hint = v_limit.retry_after_seconds::text;
    end if;
  end if;

  return query
    select j.contact_type, j.contact_value
      from public.job_posts j
     where j.id = p_job_id;
end;
$function$;

-- ---------- 2) job_ad_event ----------
create or replace function public.job_ad_event(p_ad_id uuid, p_event text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_limit record;
  v_counted boolean;
begin
  if v_uid is null or not public.current_user_is_active() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_event is null or p_event not in ('impression', 'click') then
    raise exception 'INVALID_EVENT' using errcode = 'P0001';
  end if;

  -- حد عام على الاستدعاءات. عند تجاوزه نتجاهل الحدث بصمت (العميل لا ينتظر ولا يعرض خطأ)
  select * into v_limit
    from public.consume_ai_rate_limit(v_uid, 'job_ad_event', 60, 2000);
  if not v_limit.allowed then
    return;
  end if;

  -- الإعلان يجب أن يكون فعّالاً الآن (نفس تعريف is_live في admin_list_job_ads)
  if not exists (
    select 1 from public.job_ads a
     where a.id = p_ad_id
       and a.is_active
       and (a.starts_at is null or a.starts_at <= now())
       and (a.ends_at is null or a.ends_at > now())
  ) then
    return;
  end if;

  -- حدث واحد محسوب لكل (مستخدم، إعلان، نوع) كل 24 ساعة
  insert into private.job_ad_event_log as l (user_id, ad_id, event, last_counted_at)
  values (v_uid, p_ad_id, p_event, now())
  on conflict (user_id, ad_id, event) do update
    set last_counted_at = now()
    where l.last_counted_at <= now() - interval '1 day'
  returning true into v_counted;

  if v_counted is not true then
    return;
  end if;

  if p_event = 'impression' then
    update public.job_ads set impressions = impressions + 1 where id = p_ad_id;
  else
    update public.job_ads set clicks = clicks + 1 where id = p_ad_id;
  end if;
end;
$function$;
