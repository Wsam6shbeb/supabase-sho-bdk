ALTER FUNCTION public._credit_wallet(uuid, numeric, public.ledger_entry_type, text, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_agreement(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.claim_welcome_bonus() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_wallet_for_new_user() SET search_path = public, pg_temp;;
