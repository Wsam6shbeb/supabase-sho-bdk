-- adds other_verification_status so the app can rebuild provider cards from the inbox
DROP FUNCTION IF EXISTS public.get_my_conversations();

CREATE FUNCTION public.get_my_conversations()
RETURNS TABLE(
  conversation_id uuid,
  request_id uuid,
  state text,
  my_role text,
  other_user_id uuid,
  other_name text,
  other_avatar_url text,
  other_region text,
  other_verification_status text,
  request_text text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender uuid,
  unread_count integer,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    c.id,
    c.request_id,
    c.state::text,
    case when c.requester_id = auth.uid() then 'requester' else 'provider' end,
    o.id,
    o.full_name,
    o.avatar_url,
    o.region,
    o.verification_status::text,
    sr.raw_text,
    lm.body,
    lm.created_at,
    lm.sender_id,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.read_at is null),
    c.updated_at
  from public.conversations c
  join public.users o
    on o.id = case when c.requester_id = auth.uid() then c.provider_id else c.requester_id end
  join public.service_requests sr on sr.id = c.request_id
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where c.requester_id = auth.uid() or c.provider_id = auth.uid()
  order by coalesce(lm.created_at, c.updated_at) desc;
$$;

REVOKE ALL ON FUNCTION public.get_my_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_conversations() TO authenticated;
