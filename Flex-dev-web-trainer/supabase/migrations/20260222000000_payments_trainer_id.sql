-- payments schema reference (already applied in production):
-- id, contract_id → contracts, trainer_id → trainers, amount, currency, status,
-- payment_type, billing_period_start/end, external_payment_id, processed_at,
-- generated_obligations, created_at, updated_at, failure_reason
--
-- Trigger: payments.trainer_id must match contracts.trainer_id for contract_id.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES trainers(id);

CREATE INDEX IF NOT EXISTS payments_trainer_id_idx ON payments(trainer_id);
CREATE INDEX IF NOT EXISTS payments_contract_id_idx ON payments(contract_id);
