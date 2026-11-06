-- SECURITY: candidate rows must only be written by the match-service-providers Edge Function
-- (service_role). Until now any requester could INSERT/UPDATE candidates for their own request
-- with an arbitrary provider_id / rank / match_score, which made open_conversation() reach any
-- user and bypassed provider eligibility (balance gate, availability, rating hiding) and the
-- AI matching rate limits.
--
-- Readers keep working: candidates_read (SELECT) and the RESTRICTIVE active_account_required
-- policy are not touched. No SECURITY DEFINER function in public writes to candidates, and the
-- current client no longer writes to it (it sends request_id to the Edge Function).
--
-- NOTE: app builds older than the "Send request ID to server-side matching" change wrote
-- candidates directly; those writes stop working by design.

DROP POLICY IF EXISTS candidates_requester_insert ON public.candidates;
DROP POLICY IF EXISTS candidates_requester_update ON public.candidates;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.candidates FROM PUBLIC, anon, authenticated;

-- The Edge Function upserts with the service role.
GRANT SELECT, INSERT, UPDATE ON TABLE public.candidates TO service_role;
