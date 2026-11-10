CREATE OR REPLACE FUNCTION public.reject_suspended_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER reject_suspended_user_writes_trg
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.reject_suspended_user_writes();;
