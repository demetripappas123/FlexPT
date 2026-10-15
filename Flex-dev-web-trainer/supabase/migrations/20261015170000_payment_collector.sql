-- Who collects money for this agreement.
-- flex         = FlexPT (Stripe later, or record cash/Venmo in-app)
-- organization = gym/company POS; trainer still records a payment in FlexPT to grant units
--
-- Default on packages, copied onto contracts at assign. Contract is the source of truth.

DO $$ BEGIN
  CREATE TYPE public.payment_collector AS ENUM ('flex', 'organization');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS payment_collector public.payment_collector NOT NULL DEFAULT 'flex';

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS payment_collector public.payment_collector NOT NULL DEFAULT 'flex';

COMMENT ON COLUMN public.packages.payment_collector IS
  'Default collector copied onto contracts at assign time.';
COMMENT ON COLUMN public.contracts.payment_collector IS
  'Who collects money for this contract. Organization-billed still uses payments rows to grant obligations.';
