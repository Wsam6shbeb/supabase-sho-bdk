-- The blocked list needs the blocked users' display names (users RLS only shows your own row).
CREATE OR REPLACE FUNCTION public.get_my_blocked_users()
RETURNS TABLE(user_id uuid, full_name text, region text, blocked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select b.blocked_id, coalesce(nullif(u.full_name, ''), 'مستخدم'), u.region, b.created_at
  from public.blocks b
  join public.users u on u.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

REVOKE ALL ON FUNCTION public.get_my_blocked_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_blocked_users() TO authenticated;
