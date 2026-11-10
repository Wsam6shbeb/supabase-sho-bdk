-- Older installed app builds still include state in the INSERT payload.
-- The existing trigger always overwrites it with 'submitted' for client roles.
GRANT INSERT (state) ON TABLE public.service_requests TO authenticated;;
