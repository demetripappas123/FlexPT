-- Client instances of library check-in forms, plus answers.
-- Assigning copies the template name/fields so later library edits do not change this occurrence.

CREATE TABLE IF NOT EXISTS public.checkin_form_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  form_id uuid REFERENCES public.checkin_forms(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'assigned',
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_form_assignments_status_chk
    CHECK (status IN ('assigned', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.checkin_form_assignment_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.checkin_form_assignments(id) ON DELETE CASCADE,
  source_field_id uuid REFERENCES public.checkin_form_fields(id) ON DELETE SET NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_form_assignment_fields_type_chk
    CHECK (field_type IN ('text', 'long_text', 'number', 'scale', 'yes_no'))
);

CREATE TABLE IF NOT EXISTS public.checkin_form_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.checkin_form_assignments(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.checkin_form_assignment_fields(id) ON DELETE CASCADE,
  value_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_form_answers_assignment_field_key UNIQUE (assignment_id, field_id)
);

CREATE INDEX IF NOT EXISTS checkin_form_assignments_person_id_idx
  ON public.checkin_form_assignments (person_id, assigned_date DESC);

CREATE INDEX IF NOT EXISTS checkin_form_assignments_trainer_id_idx
  ON public.checkin_form_assignments (trainer_id);

CREATE INDEX IF NOT EXISTS checkin_form_assignment_fields_assignment_id_idx
  ON public.checkin_form_assignment_fields (assignment_id, position);

CREATE INDEX IF NOT EXISTS checkin_form_answers_assignment_id_idx
  ON public.checkin_form_answers (assignment_id);

COMMENT ON TABLE public.checkin_form_assignments IS
  'Assigned check-in form instance for a client. Snapshots name/description from the library template.';
COMMENT ON TABLE public.checkin_form_assignment_fields IS
  'Copied questions on an assigned check-in form. Independent of later library edits.';
COMMENT ON TABLE public.checkin_form_answers IS
  'Filled answers for an assigned check-in form. value_text stores all field types.';

GRANT ALL ON TABLE public.checkin_form_assignments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.checkin_form_assignment_fields TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.checkin_form_answers TO anon, authenticated, service_role;
