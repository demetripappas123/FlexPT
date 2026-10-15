-- Live set logging: a checkmark on a set persists here, not only on Finish.
ALTER TABLE public.exercise_sets
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exercise_sets.completed IS
  'True once the set was checked off during an in-progress session.';
