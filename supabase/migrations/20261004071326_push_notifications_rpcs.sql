CREATE OR REPLACE FUNCTION public.get_push_targets(p_notification_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select jsonb_build_object(
    'notification_id', n.id,
    'user_id', n.user_id,
    'type', n.type,
    'payload', n.payload,
    'tokens', coalesce((select jsonb_agg(t.token) from push_tokens t where t.user_id = n.user_id), '[]'::jsonb)
  )
  from notifications n
  where n.id = p_notification_id;
$$;

CREATE OR REPLACE FUNCTION public.remove_push_tokens(p_tokens text[])
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  with deleted as (delete from push_tokens where token = any(p_tokens) returning 1)
  select count(*)::int from deleted;
$$;

REVOKE ALL ON FUNCTION public.get_push_targets(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_push_tokens(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_targets(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_push_tokens(text[]) TO service_role;;
