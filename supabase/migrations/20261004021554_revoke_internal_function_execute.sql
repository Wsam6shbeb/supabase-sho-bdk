REVOKE ALL ON FUNCTION public.notify_on_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_agreement_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_request_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_conversation_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_wallet_for_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.force_initial_request_state() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_candidate_for_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_candidate_for_request(uuid) TO authenticated;

ALTER FUNCTION public.enforce_conversation_limit() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;;
