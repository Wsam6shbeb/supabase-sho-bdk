ALTER FUNCTION public.open_conversation(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.share_my_phone(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_my_phone(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_my_account() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_user_is_active() SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_messages_read(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_messages_delivered(uuid) SET search_path = public, pg_temp;;
