-- Stop notifying either party when a rating is submitted.
-- Ratings remain stored and continue to affect provider reputation as before.
DROP TRIGGER IF EXISTS ratings_notify_trg ON public.ratings;
DROP FUNCTION IF EXISTS public.notify_on_rating();
