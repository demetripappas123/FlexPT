-- Trigram search for exercise/food catalogs. Called from searchcatalog.ts
-- (AI pipeline and UI typeahead). Scope: base ∪ trainer-private ∪ community.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS exercises_name_trgm_idx
  ON public.exercises USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS exercises_movement_pattern_trgm_idx
  ON public.exercises USING gin (movement_pattern gin_trgm_ops)
  WHERE movement_pattern IS NOT NULL;

CREATE INDEX IF NOT EXISTS foods_description_trgm_idx
  ON public.foods USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS foods_brand_name_trgm_idx
  ON public.foods USING gin (brand_name gin_trgm_ops)
  WHERE brand_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS foods_category_trgm_idx
  ON public.foods USING gin (category gin_trgm_ops)
  WHERE category IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_exercises(
  p_query text DEFAULT '',
  p_trainer_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_extra_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  id uuid,
  name text,
  source text,
  trainer_id uuid,
  is_private boolean,
  variations text[],
  movement_pattern text,
  rank real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT btrim(COALESCE(p_query, '')) AS query
  ),
  tokens AS (
    SELECT t
    FROM q,
         unnest(regexp_split_to_array(lower(q.query), '[^[:alnum:]]+')) AS t
    WHERE length(t) >= 3
      AND t NOT IN (
        'the','and','for','are','but','not','you','all','can','had','her','was',
        'one','our','out','has','add','day','set','sets','rep','reps','week',
        'new','with','from','that','this','have','your','plus','just','make',
        'them','they','swap','into','want','need','also','please','would',
        'could','should','about','program','workout','exercise','exercises'
      )
  )
  SELECT
    e.id,
    e.name,
    CASE
      WHEN e.trainer_id IS NULL THEN 'base'
      WHEN p_trainer_id IS NOT NULL AND e.trainer_id = p_trainer_id AND e.is_private THEN 'mine'
      ELSE 'community'
    END AS source,
    e.trainer_id,
    e.is_private,
    e.variations,
    e.movement_pattern,
    GREATEST(
      similarity(e.name, q.query),
      word_similarity(e.name, q.query),
      word_similarity(q.query, e.name),
      CASE
        WHEN q.query <> '' AND e.name ILIKE '%' || q.query || '%' THEN 0.9
        ELSE 0
      END
    )::real AS rank
  FROM public.exercises e
  CROSS JOIN q
  WHERE
    (
      e.trainer_id IS NULL
      OR (p_trainer_id IS NOT NULL AND e.trainer_id = p_trainer_id AND e.is_private)
      OR e.is_private = false
    )
    AND (
      e.id = ANY (COALESCE(p_extra_ids, '{}'::uuid[]))
      OR (
        q.query <> ''
        AND (
          e.name ILIKE '%' || q.query || '%'
          OR e.name % q.query
          OR word_similarity(e.name, q.query) > 0.25
          OR word_similarity(q.query, e.name) > 0.25
          OR (e.movement_pattern IS NOT NULL AND e.movement_pattern ILIKE '%' || q.query || '%')
          OR EXISTS (
            SELECT 1
            FROM unnest(COALESCE(e.variations, ARRAY[]::text[])) v
            WHERE v ILIKE '%' || q.query || '%'
               OR word_similarity(v, q.query) > 0.25
          )
          OR EXISTS (
            SELECT 1 FROM tokens t
            WHERE e.name ILIKE '%' || t || '%'
               OR (e.movement_pattern IS NOT NULL AND e.movement_pattern ILIKE '%' || t || '%')
          )
        )
      )
    )
  ORDER BY
    (e.id = ANY (COALESCE(p_extra_ids, '{}'::uuid[]))) DESC,
    rank DESC,
    e.name ASC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

CREATE OR REPLACE FUNCTION public.search_foods(
  p_query text DEFAULT '',
  p_trainer_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_extra_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  id uuid,
  description text,
  fdc_id integer,
  brand_name text,
  category text,
  source text,
  trainer_id uuid,
  is_private boolean,
  rank real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT btrim(COALESCE(p_query, '')) AS query
  ),
  tokens AS (
    SELECT t
    FROM q,
         unnest(regexp_split_to_array(lower(q.query), '[^[:alnum:]]+')) AS t
    WHERE length(t) >= 3
      AND t NOT IN (
        'the','and','for','are','but','not','you','all','can','had','her','was',
        'one','our','out','has','add','day','new','with','from','that','this',
        'have','your','plus','just','make','them','they','want','need','also',
        'please','food','foods','meal','meals','gram','grams'
      )
  )
  SELECT
    f.id,
    f.description,
    f.fdc_id,
    f.brand_name,
    f.category,
    CASE
      WHEN f.trainer_id IS NULL THEN 'base'
      WHEN p_trainer_id IS NOT NULL AND f.trainer_id = p_trainer_id AND f.is_private THEN 'mine'
      ELSE 'community'
    END AS source,
    f.trainer_id,
    f.is_private,
    GREATEST(
      similarity(f.description, q.query),
      word_similarity(f.description, q.query),
      word_similarity(q.query, f.description),
      CASE
        WHEN q.query <> '' AND (
          f.description ILIKE '%' || q.query || '%'
          OR COALESCE(f.brand_name, '') ILIKE '%' || q.query || '%'
        ) THEN 0.9
        ELSE 0
      END
    )::real AS rank
  FROM public.foods f
  CROSS JOIN q
  WHERE
    (
      f.trainer_id IS NULL
      OR (p_trainer_id IS NOT NULL AND f.trainer_id = p_trainer_id AND f.is_private)
      OR f.is_private = false
    )
    AND (
      f.id = ANY (COALESCE(p_extra_ids, '{}'::uuid[]))
      OR (
        q.query <> ''
        AND (
          f.description ILIKE '%' || q.query || '%'
          OR f.description % q.query
          OR word_similarity(f.description, q.query) > 0.25
          OR word_similarity(q.query, f.description) > 0.25
          OR COALESCE(f.brand_name, '') ILIKE '%' || q.query || '%'
          OR COALESCE(f.category, '') ILIKE '%' || q.query || '%'
          OR EXISTS (
            SELECT 1 FROM tokens t
            WHERE f.description ILIKE '%' || t || '%'
               OR COALESCE(f.brand_name, '') ILIKE '%' || t || '%'
               OR COALESCE(f.category, '') ILIKE '%' || t || '%'
          )
        )
      )
    )
  ORDER BY
    (f.id = ANY (COALESCE(p_extra_ids, '{}'::uuid[]))) DESC,
    rank DESC,
    f.description ASC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

GRANT EXECUTE ON FUNCTION public.search_exercises(text, uuid, integer, uuid[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_foods(text, uuid, integer, uuid[]) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_exercises(text, uuid, integer, uuid[]) IS
  'Trigram/ILIKE catalog search over exercises. extra_ids are always included (in-program pins).';
COMMENT ON FUNCTION public.search_foods(text, uuid, integer, uuid[]) IS
  'Trigram/ILIKE catalog search over foods. extra_ids are always included (in-meal pins).';
