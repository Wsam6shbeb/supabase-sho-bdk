-- ===============================================================
-- شريط الرئيسية: "ما المطلوب الآن وما المتوفر" — بدون أي اسم أو معرّف.
-- الدالة وحدها تقرأ الجداول (SECURITY DEFINER)، ولا نفتح قراءتها للمستخدمين.
-- ما تعيده: صفوف (kind, body)، الأحدث أولاً، حتى 20:
--   kind = 'request' : نص طلب أحدهم بلغته العادية (آخر 30 يوماً).
--   kind = 'offer'   : اسم خدمة متاحة عند مقدم خدمة (يظهر فور إضافتها).
-- الخدمة "متاحة" بنفس شروط المطابقة في get_provider_candidates:
--   مقدم الخدمة فعّال وغير محذوف، خدمته مفعّلة، ومتاح (is_available)،
--   ورصيده يكفي العمولة القصوى، وغير مخفي بسبب التقييم المنخفض.
-- تنظيف مسبق على الخادم بحيث لا يغادر القاعدة نص خطِر (النصوص يكتبها المستخدمون):
--   * للطلب: نأخذ نص "توضيح المستخدم" إن وُجد، وإلا النص الأصلي.
--   * للخدمة: اسمها المنظم (structured_data.service) فقط، لا الوصف الحر.
--   * نستبعد ما فيه أرقام هاتف (7 أرقام فأكثر)، أو روابط، أو بريد، أو أسماء تطبيقات تواصل.
--   * نقصّ النص: 120 حرفاً للطلب، 80 للخدمة.
--   * الطلب المكرر من الشخص نفسه مرة واحدة وبحد أقصى 3 لكل شخص؛
--     والخدمة المتطابقة النص تظهر مرة واحدة، وبحد أقصى 3 لكل مقدم خدمة.
--   * من غير المحظورين بين الطرفين، ولا شيء يُعاد لمستخدم غير فعّال.
-- ===============================================================

create or replace function public.get_home_feed(p_limit integer default 20)
returns table(kind text, body text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with settings as (
    select
      coalesce((select (value)::text::numeric from public.app_settings where key = 'commission_max'), 50) as commission_max,
      coalesce((select (value)::text::integer from public.app_settings where key = 'hide_provider_min_ratings'), 5) as hide_min_ratings,
      coalesce((select (value)::text::numeric from public.app_settings where key = 'hide_provider_below_rating'), 3) as hide_below_rating
  ),
  request_candidates as (
    select r.requester_id as owner_id,
           r.created_at,
           btrim(left(btrim(regexp_replace(
             case
               when r.raw_text like '%توضيح المستخدم:%'
                 then coalesce(
                        nullif(btrim(substring(r.raw_text from '.*توضيح المستخدم:(.*)$')), ''),
                        split_part(r.raw_text, E'\n', 1)
                      )
               else r.raw_text
             end,
             '\s+', ' ', 'g')), 120)) as txt
      from public.service_requests r
      join public.users u
        on u.id = r.requester_id and u.status = 'active' and u.deleted_at is null
     where public.current_user_is_active()
       and r.raw_text is not null
       and r.state <> 'draft'
       and r.created_at > now() - interval '30 days'
       and not exists (
         select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = r.requester_id)
             or (b.blocker_id = r.requester_id and b.blocked_id = auth.uid())
       )
  ),
  request_safe as (
    select * from request_candidates
     where char_length(txt) >= 2
       and txt !~* '(https?:|www\.|@)'
       and txt !~* '(واتس|وتساب|whats|تيليجرام|تلغرام|تليجرام|telegram|فايبر|viber|انستغرام|انستقرام|instagram|فيسبوك|فيس بوك|facebook)'
       and char_length(regexp_replace(txt, '[^0-9٠-٩۰-۹]', '', 'g')) < 7
  ),
  request_dedup as (
    select distinct on (owner_id, lower(txt)) owner_id, created_at, txt
      from request_safe
     order by owner_id, lower(txt), created_at desc
  ),
  request_capped as (
    select txt, created_at,
           row_number() over (partition by owner_id order by created_at desc) as rn
      from request_dedup
  ),
  offer_candidates as (
    select ps.provider_id as owner_id,
           ps.created_at,
           btrim(left(btrim(regexp_replace(coalesce(ps.structured_data->>'service', ''), '\s+', ' ', 'g')), 80)) as txt
      from public.provider_services ps
      join public.users u
        on u.id = ps.provider_id and u.status = 'active' and u.deleted_at is null
      join public.provider_profiles pp
        on pp.user_id = ps.provider_id and pp.is_available = true
      cross join settings s
     where public.current_user_is_active()
       and ps.is_active = true
       and coalesce((select w.available_balance from public.wallets w where w.user_id = ps.provider_id), 0) >= s.commission_max
       and not (u.rating_count >= s.hide_min_ratings and u.rating_avg < s.hide_below_rating)
       and not exists (
         select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = ps.provider_id)
             or (b.blocker_id = ps.provider_id and b.blocked_id = auth.uid())
       )
  ),
  offer_safe as (
    select * from offer_candidates
     where char_length(txt) >= 2
       and txt !~* '(https?:|www\.|@)'
       and txt !~* '(واتس|وتساب|whats|تيليجرام|تلغرام|تليجرام|telegram|فايبر|viber|انستغرام|انستقرام|instagram|فيسبوك|فيس بوك|facebook)'
       and char_length(regexp_replace(txt, '[^0-9٠-٩۰-۹]', '', 'g')) < 7
  ),
  offer_dedup as (
    select distinct on (lower(txt)) owner_id, created_at, txt
      from offer_safe
     order by lower(txt), created_at desc
  ),
  offer_capped as (
    select txt, created_at,
           row_number() over (partition by owner_id order by created_at desc) as rn
      from offer_dedup
  ),
  merged as (
    select 'request'::text as kind, txt, created_at from request_capped where rn <= 3
    union all
    select 'offer'::text as kind, txt, created_at from offer_capped where rn <= 3
  )
  select m.kind, m.txt
    from merged m
   order by m.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 20));
$$;

revoke all on function public.get_home_feed(integer) from public, anon;
grant execute on function public.get_home_feed(integer) to authenticated;
