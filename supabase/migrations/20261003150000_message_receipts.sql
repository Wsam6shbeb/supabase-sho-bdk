-- ============================================================
-- Message receipts: delivered_at / read_at + unread counter
-- Clients cannot UPDATE messages directly (no UPDATE policy);
-- receipts are written only through these SECURITY DEFINER RPCs.
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (conversation_id)
  WHERE read_at IS NULL;

-- mark messages sent by the other party in one conversation as delivered
CREATE OR REPLACE FUNCTION public.mark_messages_delivered(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then return 0; end if;
  if not exists (
    select 1 from conversations c
    where c.id = p_conversation_id and (c.requester_id = v_uid or c.provider_id = v_uid)
  ) then
    return 0;
  end if;

  update messages
     set delivered_at = now()
   where conversation_id = p_conversation_id
     and sender_id <> v_uid
     and delivered_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- mark messages from the other party as read (also delivered)
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then return 0; end if;
  if not exists (
    select 1 from conversations c
    where c.id = p_conversation_id and (c.requester_id = v_uid or c.provider_id = v_uid)
  ) then
    return 0;
  end if;

  update messages
     set read_at = now(),
         delivered_at = coalesce(delivered_at, now())
   where conversation_id = p_conversation_id
     and sender_id <> v_uid
     and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- on app start: everything waiting for me counts as delivered
CREATE OR REPLACE FUNCTION public.mark_all_my_messages_delivered()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then return 0; end if;

  update messages m
     set delivered_at = now()
    from conversations c
   where c.id = m.conversation_id
     and (c.requester_id = v_uid or c.provider_id = v_uid)
     and m.sender_id <> v_uid
     and m.delivered_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_delivered(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_my_messages_delivered() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_my_messages_delivered() TO authenticated;

-- inbox with unread counter (return type changed => drop first)
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
