-- Central rate limit for Gemini matching requests.
-- Limits: 5 requests per minute and 30 requests per UTC day.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private
FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE private.match_service_provider_rate_limits (
  user_id uuid PRIMARY KEY,
  minute_window_start timestamptz NOT NULL,
  minute_count integer NOT NULL DEFAULT 0,
  day_window_start timestamptz NOT NULL,
  day_count integer NOT NULL DEFAULT 0
);

REVOKE ALL ON TABLE private.match_service_provider_rate_limits
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_match_rate_limit(
  p_user_id uuid
)
RETURNS TABLE (
  allowed boolean,
  retry_after_seconds integer,
  minute_count integer,
  day_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_minute_window timestamptz;
  v_day_window timestamptz;
  v_minute_count integer;
  v_day_count integer;
  v_retry integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  v_minute_window :=
    to_timestamp(floor(extract(epoch FROM v_now) / 60) * 60);

  v_day_window :=
    date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  INSERT INTO private.match_service_provider_rate_limits AS limits (
    user_id,
    minute_window_start,
    minute_count,
    day_window_start,
    day_count
  )
  VALUES (
    p_user_id,
    v_minute_window,
    1,
    v_day_window,
    1
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    minute_count = CASE
      WHEN limits.minute_window_start = EXCLUDED.minute_window_start
      THEN limits.minute_count + 1
      ELSE 1
    END,
    minute_window_start = EXCLUDED.minute_window_start,
    day_count = CASE
      WHEN limits.day_window_start = EXCLUDED.day_window_start
      THEN limits.day_count + 1
      ELSE 1
    END,
    day_window_start = EXCLUDED.day_window_start
  RETURNING
    limits.minute_count,
    limits.day_count
  INTO
    v_minute_count,
    v_day_count;

  v_retry := GREATEST(
    CASE
      WHEN v_minute_count > 5
      THEN ceil(extract(epoch FROM (v_minute_window + interval '1 minute' - v_now))::numeric)::integer
      ELSE 0
    END,
    CASE
      WHEN v_day_count > 30
      THEN ceil(extract(epoch FROM (v_day_window + interval '1 day' - v_now))::numeric)::integer
      ELSE 0
    END
  );

  RETURN QUERY
  SELECT
    (v_minute_count <= 5 AND v_day_count <= 30),
    v_retry,
    v_minute_count,
    v_day_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_match_rate_limit(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_match_rate_limit(uuid)
TO service_role;
