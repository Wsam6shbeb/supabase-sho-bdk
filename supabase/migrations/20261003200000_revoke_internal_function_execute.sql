-- Trigger / internal functions must not be callable through the API.
-- (PostgreSQL does not check EXECUTE when a trigger fires, so triggers keep working.)
REVOKE ALL ON FUNCTION public.notify_on_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_agreement_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_request_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_conversation_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_wallet_for_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.force_initial_request_state() FROM PUBLIC, anon, authenticated;

-- used inside RLS policies: signed-in users only
REVOKE ALL ON FUNCTION public.is_candidate_for_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_candidate_for_request(uuid) TO authenticated;

-- pin search_path on the remaining mutable functions
ALTER FUNCTION public.enforce_conversation_limit() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- the API never needs these table privileges (TRUNCATE is not subject to RLS)
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- is_blocked_between is callable by signed-in users (it is used inside the messages RLS policy):
-- only report blocks that involve the caller, so it cannot be used to probe other people's blocks.
CREATE OR REPLACE FUNCTION public.is_blocked_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select auth.uid() is not null
     and auth.uid() in (p_a, p_b)
     and exists (
       select 1 from blocks
       where (blocker_id = p_a and blocked_id = p_b)
          or (blocker_id = p_b and blocked_id = p_a)
     );
$$;
