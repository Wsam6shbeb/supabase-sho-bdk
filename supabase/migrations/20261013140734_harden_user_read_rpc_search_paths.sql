ALTER FUNCTION public.get_conversation_agreement(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_conversation_rating_status(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_conversation_write_status(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_blocked_users() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_conversations() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_order_history_v2() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_provider_jobs() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_phone_share_status(uuid) SET search_path = public, pg_temp;;
