-- "My jobs" for providers: every agreement where the caller is the provider, with the
-- customer's display name (users RLS hides it), request state and ratings.
CREATE OR REPLACE FUNCTION public.get_my_provider_jobs()
RETURNS TABLE(
  agreement_id uuid,
  request_id uuid,
  conversation_id uuid,
  agreement_state text,
  request_state text,
  requester_id uuid,
  requester_name text,
  request_text text,
  region text,
  price numeric,
  commission_amount numeric,
  created_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  rating_received integer,
  rating_given integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    a.id,
    a.request_id,
    a.conversation_id,
    a.state::text,
    sr.state::text,
    a.requester_id,
    coalesce(nullif(u.full_name, ''), 'زبون'),
    sr.raw_text,
    sr.region,
    a.price,
    a.commission_amount,
    a.created_at,
    a.expires_at,
    sr.completed_at,
    rr.score::int,
    rg.score::int
  from public.agreements a
  join public.service_requests sr on sr.id = a.request_id
  join public.users u on u.id = a.requester_id
  left join public.ratings rr
         on rr.request_id = a.request_id and rr.from_user_id = a.requester_id and rr.to_user_id = a.provider_id
  left join public.ratings rg
         on rg.request_id = a.request_id and rg.from_user_id = a.provider_id
  where a.provider_id = auth.uid()
  order by a.created_at desc
  limit 100;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_jobs() TO authenticated;
