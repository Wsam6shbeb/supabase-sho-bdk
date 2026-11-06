-- ROLLBACK for the four 20261105* migrations. Lives outside supabase/migrations on purpose so it is
-- never applied automatically. Run it manually (e.g. in the SQL editor) only if you must revert;
-- reverting re-opens the vulnerabilities described in APPLY.md.
-- Order is the reverse of the migrations. Run inside one transaction (BEGIN; ... COMMIT;).

-- 4) phone guard: back to the previous trigger arguments
DROP TRIGGER IF EXISTS reject_phone_numbers_provider_services ON public.provider_services;
CREATE TRIGGER reject_phone_numbers_provider_services
  BEFORE INSERT OR UPDATE ON public.provider_services
  FOR EACH ROW EXECUTE FUNCTION public.reject_phone_numbers_in_text_columns('description', 'structured_data.additional_info');

DROP TRIGGER IF EXISTS reject_phone_numbers_service_requests ON public.service_requests;
CREATE TRIGGER reject_phone_numbers_service_requests
  BEFORE INSERT OR UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.reject_phone_numbers_in_text_columns('raw_text', 'additional_info', 'service_area', 'region');

-- 3) input limits
DROP TRIGGER IF EXISTS enforce_provider_service_limit ON public.provider_services;
DROP FUNCTION IF EXISTS public.enforce_provider_service_limit();
ALTER TABLE public.provider_services DROP CONSTRAINT IF EXISTS provider_services_description_length_chk;
ALTER TABLE public.provider_services DROP CONSTRAINT IF EXISTS provider_services_structured_data_size_chk;
ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_structured_data_size_chk;

-- 2) get_provider_candidates: restore the original (unbounded) services block, then drop the helpers
DO $rollback$
DECLARE
  v_def text;
  v_pattern text;
  v_matches integer;
  v_bounded text := $b$coalesce((
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
  ),'[]'::jsonb) services,$b$;
  v_original text := $o$coalesce((
    select jsonb_agg(
      jsonb_build_object('service',ps2.description,'skills','[]'::jsonb,'synonyms','[]'::jsonb)
        || coalesce(ps2.structured_data,'{}'::jsonb)
        || jsonb_build_object('service',coalesce(nullif(ps2.structured_data->>'service',''),ps2.description))
      order by ps2.created_at desc
    )
    from public.provider_services ps2
    where ps2.provider_id=c.provider_id and ps2.is_active=true
  ),'[]'::jsonb) services,$o$;
BEGIN
  v_def := pg_get_functiondef('public.get_provider_candidates(uuid,integer)'::regprocedure);
  IF position('bound_provider_service_json' IN v_def) > 0 THEN
    SELECT string_agg(regexp_replace(tok, '([][(){}.*+?^$|\\])', '\\\1', 'g'), '\s+')
      INTO v_pattern
    FROM regexp_split_to_table(btrim(v_bounded), '\s+') AS tok;
    SELECT count(*) INTO v_matches FROM regexp_matches(v_def, v_pattern, 'g');
    IF v_matches <> 1 THEN
      RAISE EXCEPTION 'bounded services block found % times (need 1); restore get_provider_candidates manually', v_matches;
    END IF;
    EXECUTE regexp_replace(v_def, v_pattern, replace(v_original, E'\\', E'\\\\'));
  END IF;
END
$rollback$;
DROP FUNCTION IF EXISTS public.bound_provider_service_json(jsonb, text);
DROP FUNCTION IF EXISTS public.bound_text_array(jsonb, integer, integer);

-- 1) candidates: re-open client writes (this restores the vulnerability)
CREATE POLICY candidates_requester_insert ON public.candidates
  FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = candidates.request_id AND r.requester_id = auth.uid()));
CREATE POLICY candidates_requester_update ON public.candidates
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = candidates.request_id AND r.requester_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = candidates.request_id AND r.requester_id = auth.uid()));
GRANT INSERT, UPDATE ON TABLE public.candidates TO authenticated;
