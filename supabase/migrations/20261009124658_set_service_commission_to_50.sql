update public.app_settings set value = '50'::jsonb where key in ('commission_min','commission_max','commission_default');;
