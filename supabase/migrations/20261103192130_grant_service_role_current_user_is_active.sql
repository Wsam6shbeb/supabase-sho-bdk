-- The reject_suspended_user_writes trigger (SECURITY INVOKER) references current_user_is_active().
-- PostgreSQL checks EXECUTE privilege when the expression is initialised, even if auth.uid() IS NULL
-- short-circuits it, so service_role writes (e.g. match-service-providers saving candidates) failed
-- with "permission denied for function current_user_is_active".
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO service_role;;
