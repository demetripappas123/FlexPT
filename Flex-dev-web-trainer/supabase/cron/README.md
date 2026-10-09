# Cron jobs (pg_cron)

Cron jobs are defined in SQL migrations and run inside Postgres via the `pg_cron` extension.

## Until-cancelled (recurring infinite) contracts

**Job name:** `create-next-person-packages-until-cancelled`  
**Schedule:** `0 1 * * *` (daily at 01:00 UTC)  
**Migration:** `supabase/migrations/20260221200000_until_cancelled_cron.sql`

**Rule:** For recurring-infinite packages, new `person_packages` rows are created **only** (1) when you assign the contract (first period only) and (2) by this cron, **one new period per run**, based on start/end dates.

**What the cron does:** For each active contract where `"until cancelled"` is true:

1. Finds the latest period for that contract: max `end_date` in `person_packages` for that `person_id` + `package_id`.
2. If that `end_date` is **today or in the past**, creates **exactly one** new period:
   - `start_date` = that `end_date` (previous period end)
   - `end_date` = `start_date` + that service’s `obligation_cycle_length_weeks`
   - One row per package service, `status` = `'pending'`
3. If the current period hasn’t ended yet (`end_date` > today), it does nothing for that contract.

So each run adds at most one new period per contract, only when the previous period’s end date has been reached.

## Changing the schedule

Run in the SQL editor or a new migration:

```sql
-- Unschedule
SELECT extensions.cron.unschedule('create-next-person-packages-until-cancelled');

-- Reschedule (e.g. every day at 02:00 UTC)
SELECT extensions.cron.schedule(
  'create-next-person-packages-until-cancelled',
  '0 2 * * *',
  $$SELECT public.create_next_person_packages_for_until_cancelled()$$
);
```

Cron expression: minute hour day-of-month month day-of-week (e.g. `0 1 * * *` = 01:00 daily).

## Manual run

To run the function once (e.g. for testing):

```sql
SELECT public.create_next_person_packages_for_until_cancelled();
```
