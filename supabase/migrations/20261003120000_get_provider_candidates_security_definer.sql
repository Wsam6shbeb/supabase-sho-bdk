-- get_provider_candidates joins public.users, whose RLS (users_select_own) only
-- lets a user read their own row, so every provider was filtered out (0 results).
-- Run the function as SECURITY DEFINER; it already restricts itself to the
-- caller's own request via sr.requester_id = auth.uid().
ALTER FUNCTION public.get_provider_candidates(uuid, integer)
  SECURITY DEFINER
  SET search_path = public;

REVOKE ALL ON FUNCTION public.get_provider_candidates(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_candidates(uuid, integer) TO authenticated;
