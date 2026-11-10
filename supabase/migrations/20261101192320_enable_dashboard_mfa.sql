update public.app_settings
set value = 'true'::jsonb
where key = 'dashboard_require_mfa';

do $$
begin
  if not exists (
    select 1 from public.app_settings
    where key = 'dashboard_require_mfa' and value = 'true'::jsonb
  ) then
    raise exception 'Dashboard MFA setting was not enabled';
  end if;
end
$$;;
