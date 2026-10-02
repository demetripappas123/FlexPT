-- Suggested in-person session cadence for PIF contracts (1, 2, or 3 times per week).

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS suggested_sessions_per_week integer;

COMMENT ON COLUMN public.contracts.suggested_sessions_per_week IS
  'PIF suggested session frequency per week (typically 1–3). Null for recurring contracts.';
