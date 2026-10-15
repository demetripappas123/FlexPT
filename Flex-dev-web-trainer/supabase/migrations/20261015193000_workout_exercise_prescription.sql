-- Assigned workload lives on the exercise (frozen template ranges).
-- Logged performance lives on exercise_sets.weight/reps/rpe/rir (null until trained).

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS prescribed_sets numrange;

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS prescribed_reps numrange;

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS prescribed_weight numrange;

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS prescribed_rpe numrange;

ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS prescribed_rir numrange;

COMMENT ON COLUMN public.workout_exercises.prescribed_sets IS
  'Assigned set scheme copied from program_exercises.sets. Not the logged set count.';
COMMENT ON COLUMN public.workout_exercises.prescribed_reps IS
  'Assigned rep range copied from the template. Logging writes exercise_sets.reps.';
COMMENT ON COLUMN public.workout_exercises.prescribed_weight IS
  'Assigned load range (e.g. 465-485). Logging writes exercise_sets.weight.';
COMMENT ON COLUMN public.workout_exercises.prescribed_rpe IS
  'Assigned RPE. Logging writes exercise_sets.rpe.';
COMMENT ON COLUMN public.workout_exercises.prescribed_rir IS
  'Assigned RIR. Logging writes exercise_sets.rir.';
