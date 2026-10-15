-- Client onboarding status on people.
-- Null = prospect. not_started / in_progress until onboarding is done.

DO $$ BEGIN
  CREATE TYPE public.person_onboarding_status AS ENUM ('not_started', 'in_progress', 'complete');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS onboarding_status public.person_onboarding_status;

COMMENT ON COLUMN public.people.onboarding_status IS
  'Null for prospects. not_started/in_progress while onboarding; complete after checklist is done.';

UPDATE public.people
SET onboarding_status = CASE
  WHEN converted_at IS NULL THEN NULL
  WHEN converted_at >= (now() - interval '21 days') THEN 'in_progress'::public.person_onboarding_status
  ELSE 'complete'::public.person_onboarding_status
END
WHERE onboarding_status IS NULL;

-- Form purpose on library templates, snapshotted onto assigned instances
-- (same pattern as programs → workouts: later template edits do not change past assignments).

DO $$ BEGIN
  CREATE TYPE public.checkin_form_purpose AS ENUM ('intake', 'checkin', 'habit', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.checkin_forms
  ADD COLUMN IF NOT EXISTS purpose public.checkin_form_purpose NOT NULL DEFAULT 'checkin';

ALTER TABLE public.checkin_form_assignments
  ADD COLUMN IF NOT EXISTS purpose public.checkin_form_purpose NOT NULL DEFAULT 'checkin';

COMMENT ON COLUMN public.checkin_forms.purpose IS
  'Library template purpose. Copied onto checkin_form_assignments at assign time.';
COMMENT ON COLUMN public.checkin_form_assignments.purpose IS
  'Snapshotted from the library template so later edits do not change this occurrence.';
