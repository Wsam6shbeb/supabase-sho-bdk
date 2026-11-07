-- Protect the operational error log from repeated client inserts and refund only
-- the daily AI quota when Gemini itself rejects a request with HTTP 429.

CREATE OR REPLACE FUNCTION public.refund_ai_daily_rate_limit(
  p_user_id uuid,
  p_bucket text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
  v_day_window timestamptz := date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF p_user_id IS NULL OR p_bucket IS NULL THEN
    RAISE EXCEPTION 'Invalid rate limit refund arguments';
  END IF;

  UPDATE private.ai_rate_limits
  SET day_count = GREATEST(day_count - 1, 0)
  WHERE user_id = p_user_id
    AND bucket = p_bucket
    AND day_window_start = v_day_window;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_ai_daily_rate_limit(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_daily_rate_limit(uuid, text) TO service_role;

-- A user can store at most one terminal Gemini failure every one hour.
-- Advisory locking makes the check atomic even when inserts arrive concurrently.
CREATE OR REPLACE FUNCTION private.guard_app_error_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'app_error_log user mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.app_error_log AS existing
    WHERE existing.user_id = NEW.user_id
      AND existing.created_at >= clock_timestamp() - interval '1 hour'
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_app_error_log_insert() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS app_error_log_insert_throttle ON public.app_error_log;
CREATE INDEX IF NOT EXISTS app_error_log_user_created_at_idx
  ON public.app_error_log (user_id, created_at DESC);

CREATE TRIGGER app_error_log_insert_throttle
BEFORE INSERT ON public.app_error_log
FOR EACH ROW
EXECUTE FUNCTION private.guard_app_error_log_insert();
