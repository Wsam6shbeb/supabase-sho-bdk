-- Keep provider search eligibility aligned with the dashboard's maximum commission setting.
-- Providers whose available wallet balance is below commission_max are excluded before AI matching.
DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$where pp.is_available=true and pd.provider_id<>(select requester_id from request_row)
    and not exists$old$;
  v_new text := $new$where pp.is_available=true and pd.provider_id<>(select requester_id from request_row)
    and coalesce((select w.available_balance from public.wallets w where w.user_id=pd.provider_id), 0) >= coalesce((select (value)::text::numeric from public.app_settings where key='commission_max'), 50)
    and not exists$new$;
BEGIN
  SELECT pg_get_functiondef('public.get_provider_candidates(uuid,integer)'::regprocedure)
  INTO v_definition;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not find expected provider eligibility condition; no change made';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END
$migration$;
