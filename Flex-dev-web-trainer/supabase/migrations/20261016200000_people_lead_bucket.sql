-- Manual hot/cold placement. Null means the prospect list still follows session activity.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS lead_bucket text;

ALTER TABLE public.people
  DROP CONSTRAINT IF EXISTS people_lead_bucket_check;

ALTER TABLE public.people
  ADD CONSTRAINT people_lead_bucket_check
  CHECK (lead_bucket IS NULL OR lead_bucket IN ('hot', 'cold'));

COMMENT ON COLUMN public.people.lead_bucket IS
  'Trainer override for the prospect list. Null keeps the automatic hot/cold placement.';
