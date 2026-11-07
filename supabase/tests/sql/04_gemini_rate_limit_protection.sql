-- Verifies Gemini 429 refunds only the daily counter and terminal log inserts are throttled.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_user uuid := '11111111-1111-4111-8111-111111111111';
  v_day timestamptz := date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_minute timestamptz := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / 60) * 60);
BEGIN
  INSERT INTO private.ai_rate_limits (user_id, bucket, minute_window_start, minute_count, day_window_start, day_count)
  VALUES (v_user, 'test-gemini-refund', v_minute, 4, v_day, 3)
  ON CONFLICT (user_id, bucket) DO UPDATE
    SET minute_window_start = EXCLUDED.minute_window_start,
        minute_count = EXCLUDED.minute_count,
        day_window_start = EXCLUDED.day_window_start,
        day_count = EXCLUDED.day_count;

  IF NOT has_function_privilege('anon', 'public.refund_ai_daily_rate_limit(uuid,text)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.refund_ai_daily_rate_limit(uuid,text)', 'EXECUTE')
     AND has_function_privilege('service_role', 'public.refund_ai_daily_rate_limit(uuid,text)', 'EXECUTE') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'quota refund function grants are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'app_error_log_insert_throttle'
      AND tgrelid = 'public.app_error_log'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'app_error_log throttle trigger is missing';
  END IF;
END;
$$;

SET LOCAL ROLE service_role;
SELECT public.refund_ai_daily_rate_limit('11111111-1111-4111-8111-111111111111', 'test-gemini-refund');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT day_count FROM private.ai_rate_limits
      WHERE user_id = '11111111-1111-4111-8111-111111111111'
        AND bucket = 'test-gemini-refund') <> 2 THEN
    RAISE EXCEPTION 'daily quota was not refunded exactly once';
  END IF;
  IF (SELECT minute_count FROM private.ai_rate_limits
      WHERE user_id = '11111111-1111-4111-8111-111111111111'
        AND bucket = 'test-gemini-refund') <> 4 THEN
    RAISE EXCEPTION 'per-minute protection must remain unchanged';
  END IF;
END;
$$;

-- Simulate two authenticated terminal log inserts by the same user.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
INSERT INTO public.app_error_log (operation, error_code, http_status, attempt_count, platform)
VALUES ('analyze_service_request', 'GEMINI_RATE_LIMITED', 429, 4, 'web');
INSERT INTO public.app_error_log (operation, error_code, http_status, attempt_count, platform)
VALUES ('analyze_service_request', 'GEMINI_RATE_LIMITED', 429, 4, 'web');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.app_error_log
      WHERE user_id = '22222222-2222-4222-8222-222222222222'
        AND created_at >= clock_timestamp() - interval '1 hour') <> 1 THEN
    RAISE EXCEPTION 'error log throttle did not keep exactly one row';
  END IF;
END;
$$;

ROLLBACK;
\echo 'PASS 04_gemini_rate_limit_protection'
