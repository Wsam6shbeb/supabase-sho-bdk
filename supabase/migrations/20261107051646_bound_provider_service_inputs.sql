ALTER TABLE public.provider_services
  ADD CONSTRAINT provider_services_description_length_chk
    CHECK (char_length(description) <= 1000) NOT VALID,
  ADD CONSTRAINT provider_services_structured_data_size_chk
    CHECK (structured_data IS NULL OR octet_length(structured_data::text) <= 32768) NOT VALID;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_structured_data_size_chk
    CHECK (structured_data IS NULL OR octet_length(structured_data::text) <= 32768) NOT VALID;

CREATE OR REPLACE FUNCTION public.enforce_provider_service_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.provider_id IS NOT DISTINCT FROM OLD.provider_id THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.provider_id::text, 0));
  SELECT count(*) INTO v_count FROM public.provider_services WHERE provider_id = NEW.provider_id;
  IF v_count >= 30 THEN
    RAISE EXCEPTION 'PROVIDER_SERVICE_LIMIT_REACHED'
      USING ERRCODE = '23514', DETAIL = 'A provider may have at most 30 services';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_provider_service_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_provider_service_limit ON public.provider_services;
CREATE TRIGGER enforce_provider_service_limit
  BEFORE INSERT OR UPDATE OF provider_id ON public.provider_services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_provider_service_limit();
;
