-- Check-in form templates for the Library (not client submissions).
-- Assigning a form to a client later should copy into an occurrence/response table.

CREATE TABLE IF NOT EXISTS public.checkin_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkin_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.checkin_forms(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_form_fields_type_chk
    CHECK (field_type IN ('text', 'long_text', 'number', 'scale', 'yes_no'))
);

CREATE INDEX IF NOT EXISTS checkin_forms_trainer_id_idx
  ON public.checkin_forms (trainer_id);

CREATE INDEX IF NOT EXISTS checkin_form_fields_form_id_idx
  ON public.checkin_form_fields (form_id, position);

COMMENT ON TABLE public.checkin_forms IS
  'Library template for progress check-in forms. Not a filled client response.';
COMMENT ON TABLE public.checkin_form_fields IS
  'Questions on a check-in form template. field_type: text, long_text, number, scale (1–10), yes_no.';

GRANT ALL ON TABLE public.checkin_forms TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.checkin_form_fields TO anon, authenticated, service_role;
