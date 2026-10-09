-- Workout is independent of the session booking.
-- Deleting a workout must not delete the session; unlink it instead.

DO $$
DECLARE
  conname text;
BEGIN
  SELECT tc.constraint_name
  INTO conname
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'sessions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'workout_id';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sessions DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_workout_id_fkey
  FOREIGN KEY (workout_id)
  REFERENCES public.workouts(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.sessions.workout_id IS
  'Optional prescribed workout for this booking. Deleting the workout unlinks the session; the session remains.';
