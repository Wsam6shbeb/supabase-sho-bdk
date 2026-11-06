-- SECURITY: get_provider_candidates() returned every active service of every candidate provider
-- with the *entire* provider-controlled structured_data merged in (no limit on size, key count or
-- number of services). That payload is shown to requesters and is embedded in the Gemini prompt,
-- so one provider could inflate cost for every search and plant prompt-injection text.
--
-- This migration (1) adds pure helper functions that whitelist and bound a service record and
-- (2) makes get_provider_candidates() return at most 5 bounded services per provider.
-- Returned columns, signature, grants and ranking logic are unchanged. The `services` elements
-- keep every key the app reads: service, skills, service_area, region, location,
-- additional_info and delivery_mode.

CREATE OR REPLACE FUNCTION public.bound_text_array(
  p_value jsonb,
  p_max_items integer,
  p_max_len integer
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(left(t.v, p_max_len)) ORDER BY t.ord), '[]'::jsonb)
  FROM (
    SELECT e.value #>> '{}' AS v, e.ord
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_value) = 'array' THEN p_value ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS e(value, ord)
    WHERE jsonb_typeof(e.value) = 'string'
    ORDER BY e.ord
    LIMIT greatest(p_max_items, 0)
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.bound_provider_service_json(
  p_structured_data jsonb,
  p_description text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'service', left(coalesce(nullif(s.d->>'service', ''), p_description, ''), 200),
    'category', nullif(left(coalesce(s.d->>'category', ''), 80), ''),
    'skills', public.bound_text_array(s.d->'skills', 20, 80),
    'synonyms', public.bound_text_array(s.d->'synonyms', 30, 60),
    'region', nullif(left(coalesce(s.d->>'region', ''), 120), ''),
    'city', nullif(left(coalesce(s.d->>'city', ''), 120), ''),
    'area', nullif(left(coalesce(s.d->>'area', ''), 120), ''),
    'location', nullif(left(coalesce(s.d->>'location', ''), 200), ''),
    'service_area', CASE jsonb_typeof(s.d->'service_area')
      WHEN 'string' THEN to_jsonb(left(s.d->>'service_area', 200))
      WHEN 'object' THEN jsonb_build_object(
        'type', nullif(left(coalesce(s.d->'service_area'->>'type', ''), 40), ''),
        'city', nullif(left(coalesce(s.d->'service_area'->>'city', ''), 120), ''),
        'raw', nullif(left(coalesce(s.d->'service_area'->>'raw', ''), 200), ''),
        'areas', public.bound_text_array(s.d->'service_area'->'areas', 30, 60)
      )
      ELSE NULL
    END,
    'delivery_mode', nullif(left(coalesce(s.d->>'delivery_mode', ''), 120), ''),
    'additional_info', nullif(left(coalesce(s.d->>'additional_info', ''), 1000), '')
  ))
  FROM (
    SELECT CASE WHEN jsonb_typeof(p_structured_data) = 'object' THEN p_structured_data ELSE '{}'::jsonb END AS d
  ) s;
$$;

REVOKE ALL ON FUNCTION public.bound_text_array(jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bound_provider_service_json(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bound_text_array(jsonb, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bound_provider_service_json(jsonb, text) TO service_role;

DO $migration$
DECLARE
  v_def text;
  v_pattern text;
  v_matches integer;
  v_old text := $old$coalesce((
    select jsonb_agg(
      jsonb_build_object('service',ps2.description,'skills','[]'::jsonb,'synonyms','[]'::jsonb)
        || coalesce(ps2.structured_data,'{}'::jsonb)
        || jsonb_build_object('service',coalesce(nullif(ps2.structured_data->>'service',''),ps2.description))
      order by ps2.created_at desc
    )
    from public.provider_services ps2
    where ps2.provider_id=c.provider_id and ps2.is_active=true
  ),'[]'::jsonb) services,$old$;
  v_new text := $new$coalesce((
    select jsonb_agg(
      public.bound_provider_service_json(ps2.structured_data, ps2.description)
      order by ps2.created_at desc
    )
    from (
      select ps3.structured_data, ps3.description, ps3.created_at
      from public.provider_services ps3
      where ps3.provider_id=c.provider_id and ps3.is_active=true
      order by ps3.created_at desc
      limit 5
    ) ps2
  ),'[]'::jsonb) services,$new$;
BEGIN
  v_def := pg_get_functiondef('public.get_provider_candidates(uuid,integer)'::regprocedure);

  IF position('bound_provider_service_json' IN v_def) > 0 THEN
    RAISE NOTICE 'get_provider_candidates already uses bound_provider_service_json; nothing to do';
    RETURN;
  END IF;

  -- Match the expected block token by token so differences in indentation or line endings
  -- between environments cannot break the patch.
  SELECT string_agg(regexp_replace(tok, '([][(){}.*+?^$|\\])', '\\\1', 'g'), '\s+')
    INTO v_pattern
  FROM regexp_split_to_table(btrim(v_old), '\s+') AS tok;

  SELECT count(*) INTO v_matches FROM regexp_matches(v_def, v_pattern, 'g');
  IF v_matches <> 1 THEN
    RAISE EXCEPTION 'get_provider_candidates: expected services block found % times (need exactly 1); the function changed since this migration was written. Review it manually.', v_matches;
  END IF;

  EXECUTE regexp_replace(v_def, v_pattern, replace(v_new, E'\\', E'\\\\'));

  IF position('bound_provider_service_json' IN pg_get_functiondef('public.get_provider_candidates(uuid,integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'get_provider_candidates: patch was not applied';
  END IF;
END
$migration$;
