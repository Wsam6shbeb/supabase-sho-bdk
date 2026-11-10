ALTER FUNCTION public.get_request_candidates(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.submit_rating(uuid, integer, text, text[]) SET search_path = public, pg_temp;;
