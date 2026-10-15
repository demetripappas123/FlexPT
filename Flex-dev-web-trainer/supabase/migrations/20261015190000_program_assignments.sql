-- Client mesocycle (program assignment): enrollment hub for dated workouts, meals, check-ins, and goals.
-- Templates stay on programs / nutrition_programs. Assigned copies hang off this row.

CREATE TABLE IF NOT EXISTS public.program_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  name text NOT NULL,
  source_program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  source_nutrition_program_id uuid REFERENCES public.nutrition_programs(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  kickoff_form_id uuid REFERENCES public.checkin_forms(id) ON DELETE SET NULL,
  checkin_form_id uuid REFERENCES public.checkin_forms(id) ON DELETE SET NULL,
  habit_form_id uuid REFERENCES public.checkin_forms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_assignments_status_chk
    CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  CONSTRAINT program_assignments_has_source_chk
    CHECK (source_program_id IS NOT NULL OR source_nutrition_program_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS program_assignments_person_id_idx
  ON public.program_assignments (person_id, start_date DESC);

CREATE INDEX IF NOT EXISTS program_assignments_trainer_id_idx
  ON public.program_assignments (trainer_id);

COMMENT ON TABLE public.program_assignments IS
  'Client mesocycle enrollment. Workouts/meals/check-ins/goals hang off this row; templates stay in the library.';

CREATE TABLE IF NOT EXISTS public.program_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.program_assignments(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'qualitative',
  label text NOT NULL,
  notes text,
  baseline_value numeric,
  target_value numeric,
  current_value numeric,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_goals_kind_chk
    CHECK (kind IN ('qualitative', 'bodyweight', 'body_comp', 'lift', 'other'))
);

CREATE INDEX IF NOT EXISTS program_goals_assignment_id_idx
  ON public.program_goals (assignment_id);

COMMENT ON TABLE public.program_goals IS
  'North-star goals for a mesocycle. Check-in answers are the time series; these are the targets.';

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.program_assignments(id) ON DELETE SET NULL;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS week_number integer;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS day_name text;

CREATE INDEX IF NOT EXISTS workouts_assignment_id_idx
  ON public.workouts (assignment_id);

ALTER TABLE public.meals_occurances
  ADD COLUMN IF NOT EXISTS program_assignment_id uuid REFERENCES public.program_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS meals_occurances_program_assignment_id_idx
  ON public.meals_occurances (program_assignment_id);

ALTER TABLE public.checkin_form_assignments
  ADD COLUMN IF NOT EXISTS program_assignment_id uuid REFERENCES public.program_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS checkin_form_assignments_program_assignment_id_idx
  ON public.checkin_form_assignments (program_assignment_id);

ALTER TABLE public.exercise_sets
  ADD COLUMN IF NOT EXISTS prescribed_weight numrange;

ALTER TABLE public.exercise_sets
  ADD COLUMN IF NOT EXISTS prescribed_reps numrange;

ALTER TABLE public.exercise_sets
  ADD COLUMN IF NOT EXISTS prescribed_rir numrange;

ALTER TABLE public.exercise_sets
  ADD COLUMN IF NOT EXISTS prescribed_rpe numrange;

COMMENT ON COLUMN public.exercise_sets.prescribed_weight IS
  'Frozen prescription at assign time. Logging writes weight, not this.';
COMMENT ON COLUMN public.exercise_sets.prescribed_reps IS
  'Frozen prescription at assign time. Logging writes reps, not this.';
COMMENT ON COLUMN public.exercise_sets.prescribed_rir IS
  'Frozen prescription at assign time. Logging writes rir, not this.';
COMMENT ON COLUMN public.exercise_sets.prescribed_rpe IS
  'Frozen prescription at assign time. Logging writes rpe, not this.';

GRANT ALL ON TABLE public.program_assignments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.program_goals TO anon, authenticated, service_role;
