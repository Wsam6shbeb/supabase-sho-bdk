-- The app may create a request, but lifecycle state and timestamps are database-controlled.
REVOKE INSERT ON TABLE public.service_requests FROM authenticated;

GRANT INSERT (
  requester_id,
  raw_text,
  service_area,
  additional_info,
  urgency,
  region,
  structured_data,
  ai_confidence,
  needs_clarification,
  clarification_question
) ON TABLE public.service_requests TO authenticated;
