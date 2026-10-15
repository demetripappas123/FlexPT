-- Assigned meal foods freeze at assign time. Logging writes amount/unit/food_id (eaten).

ALTER TABLE public.meals_foods_instances
  ADD COLUMN IF NOT EXISTS prescribed_food_id uuid;

ALTER TABLE public.meals_foods_instances
  ADD COLUMN IF NOT EXISTS prescribed_food_name text;

ALTER TABLE public.meals_foods_instances
  ADD COLUMN IF NOT EXISTS prescribed_amount integer;

ALTER TABLE public.meals_foods_instances
  ADD COLUMN IF NOT EXISTS prescribed_unit text;

COMMENT ON COLUMN public.meals_foods_instances.prescribed_amount IS
  'Assigned portion. Logging writes amount, not this.';
COMMENT ON COLUMN public.meals_foods_instances.prescribed_unit IS
  'Assigned unit. Logging writes unit, not this.';
COMMENT ON COLUMN public.meals_foods_instances.prescribed_food_id IS
  'Assigned food. Substitutions change food_id, not this.';
COMMENT ON COLUMN public.meals_foods_instances.prescribed_food_name IS
  'Assigned food name snapshot.';

-- Existing rows were a single mixed layer. Snapshot current values as the prescription.
UPDATE public.meals_foods_instances
SET
  prescribed_food_id = COALESCE(prescribed_food_id, food_id),
  prescribed_food_name = COALESCE(prescribed_food_name, food_name),
  prescribed_amount = COALESCE(prescribed_amount, amount),
  prescribed_unit = COALESCE(prescribed_unit, unit)
WHERE prescribed_food_id IS NULL
   OR prescribed_food_name IS NULL
   OR prescribed_amount IS NULL
   OR prescribed_unit IS NULL;
