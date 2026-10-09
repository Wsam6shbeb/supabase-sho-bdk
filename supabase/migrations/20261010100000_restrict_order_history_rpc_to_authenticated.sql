-- Restrict the SECURITY DEFINER order-history RPC to signed-in users.
REVOKE EXECUTE ON FUNCTION public.get_my_order_history_v2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_order_history_v2() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_order_history_v2() TO authenticated;
