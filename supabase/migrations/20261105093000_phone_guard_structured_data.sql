-- SECURITY: the phone-number guard only covered description and structured_data.additional_info
-- on provider_services, and nothing inside service_requests.structured_data. Fields such as
-- service, skills, synonyms, location or service_area are shown to the other party and accepted
-- a phone number, which bypasses the commission model. Extend the same trigger function to
-- the remaining free-text paths (same SQLSTATE 23514 / PHONE_NUMBER_NOT_ALLOWED as today).
--
-- Triggers only check values that CHANGE, so existing rows are not affected.
-- Verified against current production data: 0 of 5 provider services and 0 of 19 requests
-- would have been rejected by the new paths.

DROP TRIGGER IF EXISTS reject_phone_numbers_provider_services ON public.provider_services;
CREATE TRIGGER reject_phone_numbers_provider_services
  BEFORE INSERT OR UPDATE ON public.provider_services
  FOR EACH ROW EXECUTE FUNCTION public.reject_phone_numbers_in_text_columns(
    'description',
    'structured_data.additional_info',
    'structured_data.service',
    'structured_data.category',
    'structured_data.skills',
    'structured_data.synonyms',
    'structured_data.location',
    'structured_data.region',
    'structured_data.city',
    'structured_data.area',
    'structured_data.service_area',
    'structured_data.delivery_mode'
  );

DROP TRIGGER IF EXISTS reject_phone_numbers_service_requests ON public.service_requests;
CREATE TRIGGER reject_phone_numbers_service_requests
  BEFORE INSERT OR UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.reject_phone_numbers_in_text_columns(
    'raw_text',
    'additional_info',
    'service_area',
    'region',
    'structured_data.additional_info',
    'structured_data.service',
    'structured_data.category',
    'structured_data.skills',
    'structured_data.synonyms',
    'structured_data.location',
    'structured_data.region',
    'structured_data.city',
    'structured_data.area',
    'structured_data.service_area',
    'structured_data.delivery_mode'
  );
