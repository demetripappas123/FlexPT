Date: October 2, 2026

Work from ~Sep 29 through Oct 2. Most of this is still uncommitted locally.
Deeper notes: `workouts-instances-vs-templates.md`, `nutrition-meals-and-day-totals.md`.

---

## Billing: template vs instance vs entitlement

Settled the split and wired the app to it:

- `packages` = billing template
- `contracts` = instance copied onto a client (editable)
- `person_packages` = paid entitlements, created by a **payment**, not by assigning a contract

Assigning a contract no longer inserts entitlement rows. Recording a payment does: one `person_packages` row per service, N cycles if the amount is a multiple of the cycle price. Remaining units = granted minus consuming fulfillments (sessions today). Tasks should not be treated as “all done” from checkboxes.

Contracts live on the client page (add/edit/delete). Standalone `/contracts` and the sidebar Contracts item are gone. Client Packages tab is entitlements grouped by payment/contract.

PIF contracts got a suggested session cadence (once / twice / 3× a week), defaulted from the package’s session `package_services` weekly units, stored on `contracts.suggested_sessions_per_week`.

Migrations: packages template billing fields; `contracts.suggested_sessions_per_week`.

## Sessions, workouts, remaining

Scheduling a client session must consume a remaining session entitlement (`sessions.person_package_id`). Do not set `end_time` just because you booked — that looked like a completed workout.

Workouts are **person instances**, not library/program templates. Assign from a program (or design on the fly) by creating a new `workouts` row. Library/programs stay on their own tables.

`sessions.workout_id` and `sessions.person_package_id`: deleting a workout **unlinks** the session (`ON DELETE SET NULL`). The booking stays. Same idea for person_package unlink. RLS still off.

Progress charts (volume, RPE/RIR, weight) read completed `workouts` with `workout_date` and sets — not sessions as the source of truth, not templates. Live data is still thin: lots of completed workout stubs with no sets.

## Tasks and dashboard

Added a `tasks` table and a dashboard feed that clicks through to the client. Tasks come from remaining entitlements; they auto-complete when you actually deliver (e.g. schedule), not from the checkbox as the source of remaining.

Dashboard layout: KPI row, then revenue (wider) beside thinner Tasks | Sessions, then lead sources and rate cards. One main scroller (killed the duplicate scrollbar). Ditched orange; brand is the landing violet-blue (`#5b21b6` / `#7c3aed`). Purple on chart highlights (revenue sparkline, lead bars, client toggles), not on the big revenue numbers.

## Clients page

Replaced card/SQL-ish views with one ops table: Client, Status, Coach, Sessions, Activity, Check-in, Billing, Renewal, placeholder Compliance ring at the end, ⋯. Active clients first. Check-in is from tasks for now (later: client forms). Compliance is invented display data until logging exists.

## Nutrition vs meals

Nutrition goals/entries = calories + macros only. Meals can carry macros and micros from the food library and are **not always assigned**.

Completed meal occurrences add to that day’s macro total without owning it:

- extra = what trainer/client types (`nutrition_entries.extra_*`)
- from meals = sum of completed `meals_occurances` on `assigned_date`
- displayed total = extra + from meals

Edit portions / uncheck / skip recalculates the meal layer; extra stays. Overview editor shows totals and saves extra as displayed − meals.

Occurrence foods write to `meals_foods_instances` (`foods.id`, not `fdc_id`). Added `meals_occurances.assigned_date` and `meal_id`.

## Other

Created a second trainer login for testing (email `poweru@flexpt.local`; sign-in is email, not username).

Schema applied this stretch (in order): packages template billing; sessions.person_package_id; sessions.workout_id SET NULL; tasks; contracts.suggested_sessions_per_week; nutrition extra + meal dates.
