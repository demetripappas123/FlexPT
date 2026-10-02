-- Trainer ops queue: one open task per remaining paid entitlement unit.
-- Remaining is still derived from fulfillment (sessions, later workouts/meals).
-- A task may only be done when a fulfillment id is set (e.g. scheduled session).

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('open', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_kind AS ENUM ('session', 'workout', 'meal', 'checkin', 'habit', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  person_package_id uuid NOT NULL REFERENCES public.person_packages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  kind task_kind NOT NULL,
  status task_status NOT NULL DEFAULT 'open',
  fulfillment_id uuid,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_done_requires_fulfillment;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_done_requires_fulfillment
  CHECK (status <> 'done' OR fulfillment_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS tasks_trainer_open_idx
  ON public.tasks (trainer_id, status, due_date)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS tasks_person_package_status_idx
  ON public.tasks (person_package_id, status);

CREATE INDEX IF NOT EXISTS tasks_person_id_idx
  ON public.tasks (person_id);

COMMENT ON TABLE public.tasks IS
  'Trainer deliverable queue. Open count tracks remaining paid units. Done only with a fulfillment (session/workout/etc).';

CREATE OR REPLACE FUNCTION public.task_kind_from_service_type(t text)
RETURNS task_kind
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN t = 'SESSION' THEN 'session'::task_kind
    WHEN t = 'WORKOUT' THEN 'workout'::task_kind
    WHEN t = 'NUTRITION' THEN 'meal'::task_kind
    WHEN t = 'CHECK_FORM' THEN 'checkin'::task_kind
    WHEN t = 'HABIT_FORM' THEN 'habit'::task_kind
    ELSE 'other'::task_kind
  END;
$$;

CREATE OR REPLACE FUNCTION public.person_package_units_used(pp_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  st text;
  used integer;
BEGIN
  SELECT s.service_type INTO st
  FROM public.person_packages pp
  JOIN public.services s ON s.id = pp.service_id
  WHERE pp.id = pp_id;

  IF st IS NULL THEN
    RETURN 0;
  END IF;

  IF st = 'SESSION' THEN
    SELECT count(*)::integer INTO used
    FROM public.sessions
    WHERE person_package_id = pp_id
      AND (status IS DISTINCT FROM 'canceled_no_charge');
    RETURN COALESCE(used, 0);
  END IF;

  -- WORKOUT / NUTRITION / forms: fulfillment FKs land in a later pass.
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_open_tasks_for_person_package(pp_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pp public.person_packages%ROWTYPE;
  st text;
  kind task_kind;
  granted integer;
  needed integer;
  open_count integer;
BEGIN
  SELECT * INTO pp FROM public.person_packages WHERE id = pp_id;
  IF NOT FOUND OR pp.person_id IS NULL THEN
    RETURN;
  END IF;

  IF pp.status IS DISTINCT FROM 'paid' THEN
    UPDATE public.tasks
    SET status = 'cancelled', updated_at = now()
    WHERE person_package_id = pp_id AND status = 'open';
    RETURN;
  END IF;

  SELECT s.service_type INTO st FROM public.services s WHERE s.id = pp.service_id;
  kind := public.task_kind_from_service_type(st);
  granted := COALESCE(pp.units_per_obligation_cycle, 0);
  needed := GREATEST(granted - public.person_package_units_used(pp_id), 0);

  SELECT count(*)::integer INTO open_count
  FROM public.tasks
  WHERE person_package_id = pp_id AND status = 'open';

  WHILE open_count < needed LOOP
    INSERT INTO public.tasks (
      person_id, trainer_id, person_package_id, service_id, kind, status, due_date
    ) VALUES (
      pp.person_id,
      pp.trainer_id,
      pp.id,
      pp.service_id,
      kind,
      'open',
      COALESCE(pp.next_payment_date, pp.payment_date)
    );
    open_count := open_count + 1;
  END LOOP;

  IF open_count > needed THEN
    DELETE FROM public.tasks
    WHERE id IN (
      SELECT id FROM public.tasks
      WHERE person_package_id = pp_id
        AND status = 'open'
        AND fulfillment_id IS NULL
      ORDER BY created_at DESC
      LIMIT (open_count - needed)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_next_open_task(pp_id uuid, fulfillment uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.tasks
  SET
    status = 'done',
    fulfillment_id = fulfillment,
    completed_at = now(),
    updated_at = now()
  WHERE id = (
    SELECT id FROM public.tasks
    WHERE person_package_id = pp_id AND status = 'open'
    ORDER BY created_at
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tasks_on_session_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.person_package_id IS NOT NULL THEN
    PERFORM public.complete_next_open_task(NEW.person_package_id, NEW.id);
    PERFORM public.sync_open_tasks_for_person_package(NEW.person_package_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_complete_on_session ON public.sessions;
CREATE TRIGGER tasks_complete_on_session
  AFTER INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE PROCEDURE public.tasks_on_session_insert();

-- Backfill open tasks from current remaining paid units
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id FROM public.person_packages WHERE status = 'paid' AND person_id IS NOT NULL
  LOOP
    PERFORM public.sync_open_tasks_for_person_package(rec.id);
  END LOOP;
END $$;

GRANT ALL ON TABLE public.tasks TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_open_tasks_for_person_package(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_next_open_task(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.person_package_units_used(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.task_kind_from_service_type(text) TO anon, authenticated, service_role;
