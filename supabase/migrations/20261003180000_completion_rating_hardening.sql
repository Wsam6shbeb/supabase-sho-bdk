-- ============================================================
-- Phase F: completion + rating on the server, and privilege hardening.
--
-- HARDENING (found during audit): RLS policies were row-level only, with
-- table-wide UPDATE/INSERT grants, so any authenticated user could:
--   * set users.is_admin / users.verification_status on their own row
--   * set provider_profiles.rating_avg / completed_services_count
--   * set service_requests.state (e.g. 'completed') on their own requests
--   * update any column of their conversations (state, locked_reason...)
--   * insert arbitrary ratings for anyone (fake reputation)
--   * insert messages with message_type = 'system' (impersonate the system)
-- Writes that carry business meaning now go through SECURITY DEFINER RPCs,
-- and direct writes are limited to the columns the app legitimately sets.
-- ============================================================

-- ---------- users ----------
REVOKE INSERT, UPDATE ON public.users FROM authenticated;
GRANT INSERT (id, full_name, phone, region, avatar_url, is_provider) ON public.users TO authenticated;
GRANT UPDATE (full_name, phone, region, avatar_url, is_provider) ON public.users TO authenticated;

-- ---------- provider_profiles ----------
REVOKE INSERT, UPDATE ON public.provider_profiles FROM authenticated;
GRANT INSERT (user_id, bio, is_available) ON public.provider_profiles TO authenticated;
GRANT UPDATE (bio, is_available) ON public.provider_profiles TO authenticated;

-- ---------- service_requests ----------
REVOKE UPDATE, DELETE ON public.service_requests FROM authenticated;
GRANT UPDATE (structured_data, ai_confidence, needs_clarification, clarification_question)
  ON public.service_requests TO authenticated;

-- a client can only ever create a request in its initial state
CREATE OR REPLACE FUNCTION public.force_initial_request_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if current_user in ('authenticated', 'anon') then
    new.state := 'submitted';
    new.matched_at := null;
    new.completed_at := null;
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_force_initial_request_state ON public.service_requests;
CREATE TRIGGER trg_force_initial_request_state
  BEFORE INSERT ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.force_initial_request_state();

-- ---------- conversations: only RPCs create/modify them ----------
REVOKE INSERT, UPDATE ON public.conversations FROM authenticated;

-- ---------- ratings: only submit_rating() ----------
REVOKE INSERT ON public.ratings FROM authenticated;
DROP POLICY IF EXISTS ratings_insert ON public.ratings;

-- ---------- messages: clients may set only these columns ----------
REVOKE INSERT ON public.messages FROM authenticated;
GRANT INSERT (conversation_id, sender_id, body, client_dedupe_key) ON public.messages TO authenticated;

-- helper that sees blocks in both directions (blocks RLS only shows your own)
CREATE OR REPLACE FUNCTION public.is_blocked_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;
REVOKE ALL ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated;

-- messages can be sent only while the conversation is writable and nobody blocked the other
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.requester_id = auth.uid() OR c.provider_id = auth.uid())
        AND c.state IN ('negotiating', 'agreement_pending', 'active')
        AND (c.writable_until IS NULL OR c.writable_until > now())
        AND NOT public.is_blocked_between(c.requester_id, c.provider_id)
    )
  );

-- ============================================================
-- complete_request: the requester marks the service as done
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_request(p_request_id uuid)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_ag public.agreements;
  v_days integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_req from service_requests
   where id = p_request_id and requester_id = v_uid
   for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- idempotent
  if v_req.state in ('completion_pending_rating', 'completed') then
    return v_req;
  end if;
  if v_req.state <> 'active' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_ag from agreements
   where request_id = p_request_id and state = 'active'
   order by created_at desc limit 1;
  if not found then
    raise exception 'NO_ACTIVE_AGREEMENT' using errcode = 'P0001';
  end if;

  update service_requests
     set state = 'completion_pending_rating', completed_at = now()
   where id = p_request_id
   returning * into v_req;

  v_days := coalesce(
    (select (value)::text::integer from app_settings where key = 'chat_writable_after_completion_days'), 7);

  update conversations
     set writable_until = now() + make_interval(days => v_days)
   where id = v_ag.conversation_id;

  update conversations
     set state = 'read_only'
   where request_id = p_request_id
     and id <> v_ag.conversation_id
     and state in ('negotiating', 'locked_temp');

  perform public._post_system_message(
    v_ag.conversation_id, v_uid, 'أنهى الزبون الخدمة. بتقدروا تقيّموا بعض.');

  return v_req;
end;
$$;

-- ============================================================
-- submit_rating: either party of an active agreement rates the other (once)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_rating(
  p_request_id uuid,
  p_score integer,
  p_comment text DEFAULT NULL,
  p_tags text[] DEFAULT NULL
)
RETURNS public.ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_ag public.agreements;
  v_to uuid;
  v_rating public.ratings;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'INVALID_SCORE' using errcode = 'P0001';
  end if;

  select * into v_req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_ag from agreements
   where request_id = p_request_id and state = 'active'
   order by created_at desc limit 1;
  if not found then
    raise exception 'NO_ACTIVE_AGREEMENT' using errcode = 'P0001';
  end if;

  if v_uid = v_ag.requester_id then
    v_to := v_ag.provider_id;
  elsif v_uid = v_ag.provider_id then
    v_to := v_ag.requester_id;
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_req.state not in ('completion_pending_rating', 'completed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  if exists (select 1 from ratings where request_id = p_request_id and from_user_id = v_uid) then
    raise exception 'ALREADY_RATED' using errcode = 'P0001';
  end if;

  insert into ratings (request_id, from_user_id, to_user_id, score, comment, tags)
  values (p_request_id, v_uid, v_to, p_score, nullif(trim(p_comment), ''), p_tags)
  returning * into v_rating;

  -- the requester's rating closes the order
  if v_uid = v_ag.requester_id and v_req.state = 'completion_pending_rating' then
    update service_requests set state = 'completed' where id = p_request_id;
    update provider_profiles
       set completed_services_count = completed_services_count + 1
     where user_id = v_to;
  end if;

  -- provider reputation = average of scores given to them as a provider
  if v_uid = v_ag.requester_id then
    update provider_profiles
       set rating_avg = coalesce((
             select round(avg(r.score)::numeric, 2)
               from ratings r
              where r.to_user_id = v_to
                and exists (select 1 from agreements a
                             where a.request_id = r.request_id
                               and a.provider_id = r.to_user_id
                               and a.state = 'active')
           ), 0)
     where user_id = v_to;
  end if;

  return v_rating;
end;
$$;

-- ============================================================
-- finalize_overdue_requests: auto-complete unrated orders after the window,
-- and make old finished conversations read-only. Idempotent; safe for anyone to call.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_overdue_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_hours integer;
  v_n integer := 0;
  r record;
begin
  v_hours := coalesce(
    (select (value)::text::integer from app_settings where key = 'rating_window_hours'), 48);

  for r in
    select sr.id, a.provider_id, a.requester_id, a.conversation_id
      from service_requests sr
      join agreements a on a.request_id = sr.id and a.state = 'active'
     where sr.state = 'completion_pending_rating'
       and sr.completed_at < now() - make_interval(hours => v_hours)
     for update of sr skip locked
  loop
    update service_requests set state = 'completed'
     where id = r.id and state = 'completion_pending_rating';
    if found then
      update provider_profiles
         set completed_services_count = completed_services_count + 1
       where user_id = r.provider_id;
      perform public._post_system_message(
        r.conversation_id, r.requester_id, 'تم اعتماد الطلب تلقائياً لانتهاء مهلة التقييم.');
      v_n := v_n + 1;
    end if;
  end loop;

  update conversations set state = 'read_only'
   where state = 'active' and writable_until is not null and writable_until < now();

  return v_n;
end;
$$;

-- ============================================================
-- get_my_order_history: the requester's finished orders with provider + my rating
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_order_history()
RETURNS TABLE(
  request_id uuid,
  description text,
  state text,
  region text,
  is_urgent boolean,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  rating_deadline timestamptz,
  provider_id uuid,
  provider_name text,
  agreed_price numeric,
  commission_amount numeric,
  my_rating integer,
  my_comment text,
  my_tags text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    sr.id,
    sr.raw_text,
    sr.state::text,
    sr.region,
    sr.urgency::text = 'urgent',
    sr.created_at,
    sr.updated_at,
    sr.completed_at,
    case when sr.state = 'completion_pending_rating'
         then sr.completed_at + make_interval(hours => coalesce(
              (select (value)::text::integer from app_settings where key = 'rating_window_hours'), 48))
    end,
    a.provider_id,
    u.full_name,
    a.price,
    a.commission_amount,
    r.score::int,
    r.comment,
    r.tags
  from public.service_requests sr
  left join lateral (
    select * from public.agreements ag
     where ag.request_id = sr.id and ag.state = 'active'
     order by ag.created_at desc limit 1
  ) a on true
  left join public.users u on u.id = a.provider_id
  left join public.ratings r on r.request_id = sr.id and r.from_user_id = auth.uid()
  where sr.requester_id = auth.uid()
    and sr.state in ('completion_pending_rating', 'completed', 'cancelled', 'expired')
  order by coalesce(sr.completed_at, sr.updated_at) desc;
$$;

REVOKE ALL ON FUNCTION public.complete_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_rating(uuid, integer, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_overdue_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_order_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rating(uuid, integer, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_overdue_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_order_history() TO authenticated;
