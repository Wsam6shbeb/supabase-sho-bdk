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
;
