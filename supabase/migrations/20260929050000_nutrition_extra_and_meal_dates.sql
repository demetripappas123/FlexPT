-- Client daily macros: extra (typed) vs completed meals (derived at read time).
-- Occurrence foods live on meals_foods_instances; occurrences need a date to join a day.

ALTER TABLE public.meals_occurances
  ADD COLUMN IF NOT EXISTS assigned_date date,
  ADD COLUMN IF NOT EXISTS meal_id uuid;

UPDATE public.meals_occurances
SET assigned_date = (created_at AT TIME ZONE 'UTC')::date
WHERE assigned_date IS NULL;

ALTER TABLE public.nutrition_entries
  ADD COLUMN IF NOT EXISTS extra_calories integer,
  ADD COLUMN IF NOT EXISTS extra_protein_grams integer,
  ADD COLUMN IF NOT EXISTS extra_carbs_grams integer,
  ADD COLUMN IF NOT EXISTS extra_fats_grams integer;

UPDATE public.nutrition_entries
SET
  extra_calories = COALESCE(extra_calories, calories),
  extra_protein_grams = COALESCE(extra_protein_grams, protein_grams),
  extra_carbs_grams = COALESCE(extra_carbs_grams, carbs_grams),
  extra_fats_grams = COALESCE(extra_fats_grams, fats_grams);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_entries_client_id_entry_date_uidx
  ON public.nutrition_entries (client_id, entry_date);

COMMENT ON COLUMN public.nutrition_entries.extra_calories IS
  'Manual/extra calories for the day (not from completed meals). Display total = extra + completed meal macros.';
COMMENT ON COLUMN public.nutrition_entries.calories IS
  'Legacy extra calories. Prefer extra_calories. Charts should add completed meal macros at read time.';
COMMENT ON COLUMN public.meals_occurances.assigned_date IS
  'Calendar date this occurrence counts toward. Completed status includes its foods in that day''s meal-macro layer.';
COMMENT ON COLUMN public.meals_occurances.meal_id IS
  'Optional source template/program meal. On-the-spot occurrences leave this null.';
