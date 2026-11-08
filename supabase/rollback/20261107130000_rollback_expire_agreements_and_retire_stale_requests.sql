-- يتراجع عن هجرة 20261107130000 (لا يعيد الطلبات التي أُغلقت تلقائياً).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'expire-pending-agreements') then
    perform cron.unschedule('expire-pending-agreements');
  end if;
end
$$;
drop trigger if exists trg_retire_stale_requests on public.service_requests;
drop function if exists private.retire_stale_requests_on_new_request();
drop function if exists public.expire_pending_agreements();
