-- foods.id (and food_id FKs / food_servings.id) become uuid.
-- foods.fdc_id stays the USDA integer and may be null on custom foods.

ALTER TABLE public.foods
  ADD COLUMN id_uuid uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.food_servings
  ADD COLUMN id_uuid uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.food_nutrients
  ADD COLUMN food_id_uuid uuid;

ALTER TABLE public.food_servings
  ADD COLUMN food_id_uuid uuid;

ALTER TABLE public.meal_foods_programmed
  ADD COLUMN food_id_uuid uuid;

ALTER TABLE public.meals_foods_templates
  ADD COLUMN food_id_uuid uuid;

ALTER TABLE public.meals_foods_instances
  ADD COLUMN food_id_uuid uuid;

ALTER TABLE public.foods
  ADD COLUMN default_serving_id_uuid uuid;

UPDATE public.food_nutrients fn
SET food_id_uuid = f.id_uuid
FROM public.foods f
WHERE fn.food_id = f.id;

UPDATE public.food_servings fs
SET food_id_uuid = f.id_uuid
FROM public.foods f
WHERE fs.food_id = f.id;

UPDATE public.meal_foods_programmed p
SET food_id_uuid = f.id_uuid
FROM public.foods f
WHERE p.food_id = f.id;

UPDATE public.meals_foods_templates t
SET food_id_uuid = f.id_uuid
FROM public.foods f
WHERE t.food_id = f.id;

UPDATE public.meals_foods_instances i
SET food_id_uuid = f.id_uuid
FROM public.foods f
WHERE i.food_id = f.id;

UPDATE public.foods f
SET default_serving_id_uuid = s.id_uuid
FROM public.food_servings s
WHERE f.default_serving_id = s.id;

ALTER TABLE public.food_nutrients
  ALTER COLUMN food_id_uuid SET NOT NULL;

ALTER TABLE public.food_nutrients DROP CONSTRAINT food_nutrients_food_id_fkey;
ALTER TABLE public.food_nutrients DROP CONSTRAINT food_nutrients_pkey;
ALTER TABLE public.food_servings DROP CONSTRAINT food_servings_food_id_fkey;
ALTER TABLE public.meal_foods_programmed DROP CONSTRAINT day_meal_foods_food_id_fkey;
ALTER TABLE public.meals_foods_instances DROP CONSTRAINT meals_foods_instances_food_id_fkey;
ALTER TABLE public.meals_foods_templates DROP CONSTRAINT meals_foods_templates_food_id_fkey;
ALTER TABLE public.foods DROP CONSTRAINT foods_pkey;
ALTER TABLE public.food_servings DROP CONSTRAINT food_servings_pkey;

ALTER TABLE public.foods DROP COLUMN id;
ALTER TABLE public.foods RENAME COLUMN id_uuid TO id;
ALTER TABLE public.foods ADD CONSTRAINT foods_pkey PRIMARY KEY (id);

ALTER TABLE public.food_nutrients DROP COLUMN food_id;
ALTER TABLE public.food_nutrients RENAME COLUMN food_id_uuid TO food_id;

ALTER TABLE public.food_servings DROP COLUMN food_id;
ALTER TABLE public.food_servings RENAME COLUMN food_id_uuid TO food_id;

ALTER TABLE public.food_servings DROP COLUMN id;
ALTER TABLE public.food_servings RENAME COLUMN id_uuid TO id;
ALTER TABLE public.food_servings ADD CONSTRAINT food_servings_pkey PRIMARY KEY (id);

ALTER TABLE public.foods DROP COLUMN default_serving_id;
ALTER TABLE public.foods RENAME COLUMN default_serving_id_uuid TO default_serving_id;

ALTER TABLE public.meal_foods_programmed DROP COLUMN food_id;
ALTER TABLE public.meal_foods_programmed RENAME COLUMN food_id_uuid TO food_id;

ALTER TABLE public.meals_foods_templates DROP COLUMN food_id;
ALTER TABLE public.meals_foods_templates RENAME COLUMN food_id_uuid TO food_id;

ALTER TABLE public.meals_foods_instances DROP COLUMN food_id;
ALTER TABLE public.meals_foods_instances RENAME COLUMN food_id_uuid TO food_id;

ALTER TABLE public.food_nutrients
  ADD CONSTRAINT food_nutrients_pkey PRIMARY KEY (food_id, nutrient_id);

ALTER TABLE public.food_nutrients
  ADD CONSTRAINT food_nutrients_food_id_fkey
  FOREIGN KEY (food_id) REFERENCES public.foods(id) ON DELETE CASCADE;

ALTER TABLE public.food_servings
  ADD CONSTRAINT food_servings_food_id_fkey
  FOREIGN KEY (food_id) REFERENCES public.foods(id) ON DELETE CASCADE;

ALTER TABLE public.meal_foods_programmed
  ADD CONSTRAINT day_meal_foods_food_id_fkey
  FOREIGN KEY (food_id) REFERENCES public.foods(id);

ALTER TABLE public.meals_foods_instances
  ADD CONSTRAINT meals_foods_instances_food_id_fkey
  FOREIGN KEY (food_id) REFERENCES public.foods(id);

ALTER TABLE public.meals_foods_templates
  ADD CONSTRAINT meals_foods_templates_food_id_fkey
  FOREIGN KEY (food_id) REFERENCES public.foods(id);

DROP SEQUENCE IF EXISTS public.foods_id_seq;
DROP SEQUENCE IF EXISTS public.food_servings_id_seq;

ALTER TABLE public.foods
  ALTER COLUMN fdc_id DROP NOT NULL;

COMMENT ON COLUMN public.foods.id IS
  'App primary key (uuid).';
COMMENT ON COLUMN public.foods.fdc_id IS
  'USDA FDC identifier. Null for custom trainer foods. Not used as a foreign key.';
COMMENT ON COLUMN public.meal_foods_programmed.food_id IS
  'References foods.id (uuid), not foods.fdc_id.';
COMMENT ON COLUMN public.meals_foods_templates.food_id IS
  'References foods.id (uuid), not foods.fdc_id.';
COMMENT ON COLUMN public.meals_foods_instances.food_id IS
  'References foods.id (uuid), not foods.fdc_id.';
