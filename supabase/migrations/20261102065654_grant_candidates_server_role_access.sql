-- Allow the trusted Edge Function service role to persist verified match results.
-- Authenticated users retain their existing write permissions during app rollout.
GRANT SELECT, INSERT, UPDATE ON TABLE public.candidates TO service_role;
