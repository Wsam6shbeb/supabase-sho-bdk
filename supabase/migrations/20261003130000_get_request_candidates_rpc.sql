-- candidates.tsx used to read candidates -> provider_profiles -> users directly.
-- RLS on users (users_select_own) hid every provider other than the caller.
-- This RPC returns the candidates of the caller's own request with the provider
-- display data, bypassing users RLS safely (ownership checked via auth.uid()).
CREATE OR REPLACE FUNCTION public.get_request_candidates(p_request_id uuid)
RETURNS TABLE(
  provider_id uuid,
  rank integer,
  match_score numeric,
  rating_avg numeric,
  completed_services_count integer,
  full_name text,
  avatar_url text,
  region text,
  verification_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    c.provider_id,
    c.rank,
    c.match_score,
    pp.rating_avg,
    pp.completed_services_count,
    u.full_name,
    u.avatar_url,
    u.region,
    u.verification_status::text
  from public.candidates c
  join public.service_requests sr on sr.id = c.request_id
  join public.provider_profiles pp on pp.user_id = c.provider_id
  join public.users u on u.id = c.provider_id
  where c.request_id = p_request_id
    and sr.requester_id = auth.uid()
  order by c.rank asc;
$$;

REVOKE ALL ON FUNCTION public.get_request_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_request_candidates(uuid) TO authenticated;
