-- Lead sessions that were part of a package conversion.
-- The latest checked session is the close. Earlier ones are touches.
--
-- If you are not using `supabase db push`, paste this whole file into the
-- Supabase SQL Editor and run it.

CREATE TABLE IF NOT EXISTS public.conversion_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  session_type text NOT NULL,
  role text NOT NULL CHECK (role IN ('touch', 'close')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, session_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS conversion_sessions_one_close
  ON public.conversion_sessions (contract_id)
  WHERE role = 'close';

CREATE INDEX IF NOT EXISTS conversion_sessions_person_idx
  ON public.conversion_sessions (person_id);

CREATE INDEX IF NOT EXISTS conversion_sessions_session_idx
  ON public.conversion_sessions (session_id);

COMMENT ON TABLE public.conversion_sessions IS
  'Prospect, intro, and follow-up sessions credited to the contract that converted the client.';

ALTER TABLE public.conversion_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversion_sessions_trainer_all ON public.conversion_sessions;
CREATE POLICY conversion_sessions_trainer_all ON public.conversion_sessions
  FOR ALL
  TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());
