ALTER FUNCTION public.get_provider_candidates(uuid, integer)
  SECURITY DEFINER
  SET search_path = public;

REVOKE ALL ON FUNCTION public.get_provider_candidates(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_candidates(uuid, integer) TO authenticated;;
