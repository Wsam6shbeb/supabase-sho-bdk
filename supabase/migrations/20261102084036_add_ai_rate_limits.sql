-- Generic per-user, per-bucket rate limit for AI-backed edge functions.
CREATE TABLE IF NOT EXISTS private.ai_rate_limits (
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  minute_window_start timestamptz NOT NULL,
  minute_count integer NOT NULL DEFAULT 0,
  day_window_start timestamptz NOT NULL,
  day_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE private.ai_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.ai_rate_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_per_minute integer,
  p_per_day integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer, minute_count integer, day_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_minute_window timestamptz := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / 60) * 60);
  v_day_window timestamptz := date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_minute_count integer;
  v_day_count integer;
  v_retry integer;
BEGIN
  IF p_user_id IS NULL OR p_bucket IS NULL OR p_per_minute < 1 OR p_per_day < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit arguments';
  END IF;

  INSERT INTO private.ai_rate_limits AS l (user_id, bucket, minute_window_start, minute_count, day_window_start, day_count)
  VALUES (p_user_id, p_bucket, v_minute_window, 1, v_day_window, 1)
  ON CONFLICT (user_id, bucket) DO UPDATE SET
    minute_count = CASE WHEN l.minute_window_start = EXCLUDED.minute_window_start THEN l.minute_count + 1 ELSE 1 END,
    minute_window_start = EXCLUDED.minute_window_start,
    day_count = CASE WHEN l.day_window_start = EXCLUDED.day_window_start THEN l.day_count + 1 ELSE 1 END,
    day_window_start = EXCLUDED.day_window_start
  RETURNING l.minute_count, l.day_count INTO v_minute_count, v_day_count;

  v_retry := GREATEST(
    CASE WHEN v_minute_count > p_per_minute
         THEN ceil(extract(epoch FROM (v_minute_window + interval '1 minute' - v_now))::numeric)::integer ELSE 0 END,
    CASE WHEN v_day_count > p_per_day
         THEN ceil(extract(epoch FROM (v_day_window + interval '1 day' - v_now))::numeric)::integer ELSE 0 END
  );

  RETURN QUERY SELECT (v_minute_count <= p_per_minute AND v_day_count <= p_per_day), v_retry, v_minute_count, v_day_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(uuid, text, integer, integer) TO service_role;;
