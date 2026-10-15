-- Session vs solo intent on program days (library) and assigned workouts (instances).
-- A booked session still overlays via sessions.workout_id; this column is the plan.

ALTER TABLE public.program_days
  ADD COLUMN IF NOT EXISTS delivery text NOT NULL DEFAULT 'solo';

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS delivery text NOT NULL DEFAULT 'solo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_days_delivery_check'
  ) THEN
    ALTER TABLE public.program_days
      ADD CONSTRAINT program_days_delivery_check
      CHECK (delivery IN ('session', 'solo'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_delivery_check'
  ) THEN
    ALTER TABLE public.workouts
      ADD CONSTRAINT workouts_delivery_check
      CHECK (delivery IN ('session', 'solo'));
  END IF;
END $$;

COMMENT ON COLUMN public.program_days.delivery IS
  'Library intent: session = coached booking, solo = completed without a session.';
COMMENT ON COLUMN public.workouts.delivery IS
  'Assigned intent: session = meant to be coached, solo = completed alone. Booking still uses sessions.workout_id.';

-- Workouts already linked to a consuming session are coached.
UPDATE public.workouts w
SET delivery = 'session'
WHERE w.delivery = 'solo'
  AND EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.workout_id = w.id
      AND s.status IS DISTINCT FROM 'canceled_no_charge'
  );
