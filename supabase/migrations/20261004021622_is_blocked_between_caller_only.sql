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
$$;;
