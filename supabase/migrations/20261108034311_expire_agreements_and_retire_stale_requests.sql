-- ===============================================================
-- 1) انتهاء مهلة الاتفاقات المعلّقة تلقائياً (كل دقيقة).
--    قبل هذه الهجرة كان الانتهاء "كسولاً": لا يحصل إلا عندما يفتح أحد الطرفين المحادثة،
--    فتبقى المحادثة والطلب عالقَين (والزبون بلا زر "تم الاتفاق") حتى يفتحها أحد.
--    المنطق مطابق لما في get_conversation_agreement، والإشعارات تصدر من
--    الـtrigger الموجود notify_on_agreement_change.
-- 2) عند إنشاء الزبون طلباً جديداً نغلق طلباته السابقة غير المنجزة (قبل الاتفاق)،
--    لأن التطبيق يعمل بطلب حالي واحد للزبون، وبقاء الطلبات القديمة مفتوحة كان
--    يترك محادثات يتيمة بلا زر "تم الاتفاق".
--    لا نلمس أي طلب لديه اتفاق معلّق أو فعّال أو في مرحلة التقييم.
-- ===============================================================

-- ---------------------------------------------------------------
-- 1) انتهاء المهلة
-- ---------------------------------------------------------------
create or replace function public.expire_pending_agreements()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select a.id, a.request_id, a.conversation_id, a.requester_id
      from public.agreements a
     where a.state = 'pending'
       and a.expires_at < now()
     order by a.expires_at
     limit 200
     for update of a skip locked
  loop
    update public.agreements
       set state = 'expired', responded_at = now()
     where id = r.id and state = 'pending';

    if found then
      update public.service_requests
         set state = 'negotiating'
       where id = r.request_id and state = 'agreement_pending_provider';

      update public.conversations
         set state = 'negotiating', locked_reason = null
       where request_id = r.request_id
         and state in ('locked_temp', 'agreement_pending');

      perform public._post_system_message(
        r.conversation_id, r.requester_id, 'انتهت مهلة الموافقة على الاتفاق.'
      );
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$$;

revoke all on function public.expire_pending_agreements() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'expire-pending-agreements') then
      perform cron.unschedule('expire-pending-agreements');
    end if;
    perform cron.schedule('expire-pending-agreements', '* * * * *', 'select public.expire_pending_agreements();');
  end if;
end
$$;

-- ---------------------------------------------------------------
-- 2) إغلاق الطلبات السابقة غير المنجزة عند إنشاء طلب جديد
-- ---------------------------------------------------------------
create schema if not exists private;

create or replace function private.retire_stale_requests_on_new_request()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  c record;
begin
  -- أي خطأ هنا يجب ألا يمنع الزبون من إنشاء طلبه: نسجّل تحذيراً ونكمل.
  begin
    for r in
      select sr.id
        from public.service_requests sr
       where sr.requester_id = new.requester_id
         and sr.state in ('draft', 'submitted', 'clarification', 'matching', 'candidates_ready', 'negotiating')
         and not exists (
           select 1 from public.agreements a
            where a.request_id = sr.id and a.state in ('pending', 'active')
         )
       for update of sr skip locked
    loop
      update public.service_requests
         set state = 'cancelled', cancelled_at = now()
       where id = r.id;

      for c in
        select cv.id, cv.requester_id
          from public.conversations cv
         where cv.request_id = r.id
           and cv.state in ('negotiating', 'locked_temp')
      loop
        update public.conversations
           set state = 'read_only', locked_reason = null
         where id = c.id;

        perform public._post_system_message(
          c.id, c.requester_id, 'تم إغلاق هذه المحادثة لأن الزبون بدأ طلباً جديداً.'
        );
      end loop;
    end loop;
  exception when others then
    raise warning 'retire_stale_requests_on_new_request failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function private.retire_stale_requests_on_new_request() from public, anon, authenticated;

drop trigger if exists trg_retire_stale_requests on public.service_requests;
create trigger trg_retire_stale_requests
  before insert on public.service_requests
  for each row execute function private.retire_stale_requests_on_new_request();
;
