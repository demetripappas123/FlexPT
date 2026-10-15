-- How a leftover pending session was resolved.
-- suggested = past start + grace, trainer has not confirmed
-- missed    = trainer marked a no-show
-- cancelled = trainer cancelled (not a no-show)
-- Charge vs no-charge still lives on sessions.status.

DO $$ BEGIN
  CREATE TYPE public.session_missed AS ENUM ('suggested', 'missed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS missed public.session_missed;

COMMENT ON COLUMN public.sessions.missed IS
  'suggested = auto nudge after start+grace; missed = confirmed no-show; cancelled = explicit cancel.';
