-- Keep the service commission at 50 Syrian lira (new denomination) per agreement.
-- The approval flow checks the provider wallet against this amount.
update public.app_settings
set value = '50'::jsonb
where key in ('commission_min', 'commission_max', 'commission_default');
