-- Why a prospect, intro, or follow-up session did not convert.
-- Lives on the session, not the person, so a later booking can start clean.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.sessions.rejection_reason IS
  'Trainer note for a lead session that was cancelled, missed, or did not close. Null for client sessions and successful consults.';
