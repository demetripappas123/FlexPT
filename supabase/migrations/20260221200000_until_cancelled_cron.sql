-- Cron job for recurring-infinite ("until cancelled") contracts only.
-- Creates exactly one new period per contract per run: new period start = previous period end,
-- new period end = start + obligation_cycle_length_weeks. Run daily (e.g. 01:00 UTC).

-- Ensure pg_cron is available (Supabase often has it in extensions schema)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- For each active "until cancelled" contract: if the latest person_packages row(s)
-- have end_date <= today, create the single next period (one row per package_service).
-- Next period: start_date = that end_date, end_date = start_date + cycle_weeks.
-- Recurring-infinite entries are only created here and on initial assign (first period).
CREATE OR REPLACE FUNCTION public.create_next_person_packages_for_until_cancelled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  last_end date;
  ps RECORD;
  next_start date;
  next_end date;
  cycle_weeks int;
BEGIN
  FOR c IN
    SELECT id, person_id, trainer_id, package_id
    FROM contracts
    WHERE status = 'active'
      AND "until cancelled" = true
      AND package_id IS NOT NULL
  LOOP
    -- Latest end_date across all person_packages for this contract (defines end of current period)
    SELECT MAX(end_date)::date INTO last_end
    FROM person_packages
    WHERE person_id = c.person_id AND package_id = c.package_id;

    IF last_end IS NULL THEN
      CONTINUE; -- no rows yet (shouldn't happen if first period was created on assign)
    END IF;

    -- Create next period only when current period has ended (end_date is today or in the past)
    IF last_end > CURRENT_DATE THEN
      CONTINUE;
    END IF;

    -- One new period: start = previous end, end = start + cycle (per service)
    next_start := last_end;

    FOR ps IN
      SELECT
        ps.service_id,
        COALESCE(ps.unit_cost::numeric, 0) AS unit_cost,
        COALESCE(ps.is_included, true) AS is_included,
        ps.units_per_obligation_cycle,
        GREATEST(ps.obligation_cycle_length_weeks, 1) AS obligation_cycle_length_weeks
      FROM package_services ps
      WHERE ps.package_id = c.package_id
    LOOP
      cycle_weeks := ps.obligation_cycle_length_weeks;
      next_end := next_start + (cycle_weeks * 7);

      -- Skip if this (person, package, service, start_date) already exists (idempotent)
      IF EXISTS (
        SELECT 1 FROM person_packages
        WHERE person_id = c.person_id AND package_id = c.package_id
          AND service_id = ps.service_id AND start_date = next_start
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO person_packages (
        person_id,
        package_id,
        service_id,
        unit_cost,
        is_included,
        units_per_obligation_cycle,
        obligation_cycle_length_weeks,
        trainer_id,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      ) VALUES (
        c.person_id,
        c.package_id,
        ps.service_id,
        ps.unit_cost,
        ps.is_included,
        ps.units_per_obligation_cycle,
        cycle_weeks,
        c.trainer_id,
        next_start,
        next_end,
        'pending',
        now(),
        now()
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Schedule: run daily at 01:00 UTC (adjust as needed)
SELECT extensions.cron.schedule(
  'create-next-person-packages-until-cancelled',
  '0 1 * * *',
  $$SELECT public.create_next_person_packages_for_until_cancelled()$$
);
