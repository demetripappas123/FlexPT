-- Stripe customer lives on the person. Charge ids live on payments.external_payment_id.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

COMMENT ON COLUMN public.people.stripe_customer_id IS
  'Stripe Customer id (cus_...). Null until the first FlexPT Checkout for this person.';

CREATE UNIQUE INDEX IF NOT EXISTS people_stripe_customer_id_key
  ON public.people (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_external_payment_id_key
  ON public.payments (external_payment_id)
  WHERE external_payment_id IS NOT NULL;
