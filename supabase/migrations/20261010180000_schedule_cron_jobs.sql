-- 1) Hourly: auto-finalize requests whose rating window (rating_window_hours, default 48h) has passed,
--    and lock chats whose writable_until has passed. Uses the existing finalize_overdue_requests(),
--    which also bumps completed_services_count and posts the system message.
select cron.schedule(
  'auto-finalize-overdue-requests',
  '0 * * * *',
  $$ select public.finalize_overdue_requests(); $$
);

-- 2) Keep-alive: every 2 days at 00:00 UTC send a real request through the Supabase API gateway
--    (an internal "select 1" is not API traffic). The key is the public publishable key already shipped in the app.
select cron.schedule(
  'keep-alive-ping',
  '0 0 */2 * *',
  $$
    select net.http_get(
      url := 'https://cmflpnweojteblxrpzgq.supabase.co/auth/v1/health',
      headers := jsonb_build_object('apikey', 'sb_publishable_qQmUrRVI_Uf18Nr4ayC2jA_2SSsLBbp')
    );
  $$
);
