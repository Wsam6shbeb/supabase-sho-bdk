-- ============================================================
-- Chat system on Supabase (phase 1)
-- - one conversation per (request, provider)
-- - open_conversation RPC (idempotent, validates ownership/blocks/limit)
-- - get_my_conversations RPC (inbox for both requester and provider;
--   bypasses users RLS safely to return the other party's display data)
-- - realtime for messages/conversations
-- - conversations.updated_at bumped on every new message
-- ============================================================

-- 1) one conversation per request/provider pair
CREATE UNIQUE INDEX IF NOT EXISTS conversations_request_provider_uidx
  ON public.conversations (request_id, provider_id);

-- 2) dedupe client retries of the same message
CREATE UNIQUE INDEX IF NOT EXISTS messages_dedupe_uidx
  ON public.messages (conversation_id, sender_id, client_dedupe_key)
  WHERE client_dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at);

-- 3) (the 'max 3 open conversations per request' trigger trg_conversation_limit already exists)

-- 4) bump conversations.updated_at when a message arrives
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS messages_touch_conversation_trg ON public.messages;
CREATE TRIGGER messages_touch_conversation_trg
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();

-- 5) realtime (RLS still applies to what each client receives)
DO $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- 6) open (or fetch) the conversation between the caller (requester) and a provider
CREATE OR REPLACE FUNCTION public.open_conversation(p_request_id uuid, p_provider_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_conv uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if not exists (select 1 from service_requests where id = p_request_id and requester_id = v_uid) then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_provider_id = v_uid then
    raise exception 'CANNOT_CHAT_WITH_SELF' using errcode = 'P0001';
  end if;

  -- the provider must be a candidate of this request, or a provider the caller already talked to
  -- before (the "request again" flow creates a fresh request without a candidates row)
  if not exists (select 1 from candidates where request_id = p_request_id and provider_id = p_provider_id)
     and not exists (select 1 from conversations where requester_id = v_uid and provider_id = p_provider_id) then
    raise exception 'NOT_A_CANDIDATE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from blocks
    where (blocker_id = v_uid and blocked_id = p_provider_id)
       or (blocker_id = p_provider_id and blocked_id = v_uid)
  ) then
    raise exception 'BLOCKED' using errcode = 'P0001';
  end if;

  select id into v_conv from conversations
   where request_id = p_request_id and provider_id = p_provider_id;

  if v_conv is not null then
    return v_conv;
  end if;

  insert into conversations (request_id, requester_id, provider_id)
  values (p_request_id, v_uid, p_provider_id)
  returning id into v_conv;

  return v_conv;
end;
$$;

REVOKE ALL ON FUNCTION public.open_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid, uuid) TO authenticated;

-- 7) inbox: every conversation the caller takes part in, with the other party + last message
CREATE OR REPLACE FUNCTION public.get_my_conversations()
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
