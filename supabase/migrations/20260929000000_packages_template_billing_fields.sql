-- Package templates: same billing fields as contracts (defaults).
-- Contracts remain the editable instance copied from a package.
--
-- Run this in Supabase Dashboard → SQL Editor if you cannot apply migrations
-- from the CLI (this repo has no database connection string for DDL).

-- Template sticker price and term
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS cost_per_bill_cycle numeric;

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS package_length_weeks integer;

-- Instance-only fields do not belong on a template
ALTER TABLE packages
  DROP CONSTRAINT IF EXISTS packages_person_id_fkey;

ALTER TABLE packages
  DROP COLUMN IF EXISTS person_id;

ALTER TABLE packages
  DROP COLUMN IF EXISTS start_date;

ALTER TABLE packages
  DROP COLUMN IF EXISTS renewal_date;

COMMENT ON TABLE packages IS 'Billing template. Copied onto contracts at assign time; contracts are independently editable.';
COMMENT ON COLUMN packages.cost_per_bill_cycle IS 'Default recurring price copied to contracts.cost_per_bill_cycle.';
COMMENT ON COLUMN packages.package_length_weeks IS 'Default fixed term in weeks. Null when until_cancelled.';
COMMENT ON COLUMN packages.pif_cost IS 'Default pay-in-full price copied to contracts.pif_cost.';
COMMENT ON COLUMN packages.bill_cycle_length_weeks IS 'Default billing cycle length copied to contracts.';
