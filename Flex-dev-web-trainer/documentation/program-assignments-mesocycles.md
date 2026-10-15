# Program assignments (client mesocycles)

Date: October 15, 2026

## Decision

Do **not** clone `programs` → `program_weeks` → `program_days` → `program_exercises` onto the client.

That tree is the trainer **library**. A client mesocycle is an **enrollment** (`program_assignments`) plus dated **instances** that already exist:

- workouts (`workouts`)
- meals (`meals_occurances`)
- check-in/habit/kickoff forms (`checkin_form_assignments`)
- goals (`program_goals`)

Editing the library later must not rewrite a block that is already assigned. Prescription is frozen on the instance at assign time.

Same pattern as billing (`packages` vs `contracts`) and check-ins (`checkin_forms` vs `checkin_form_assignments`). Nutrition already did this for meals (`meals_templates` / `day_meals` vs `meals_occurances`). Training programs did not, until this change — assigning was one program **day** at a time, with no mesocycle object.

## Hub table: `program_assignments`

One row = one client block (several weeks).

| Column | Role |
| --- | --- |
| `person_id` / `trainer_id` | Who the block belongs to |
| `name` | Copied/overridable label |
| `source_program_id` | Library training program (SET NULL if deleted) |
| `source_nutrition_program_id` | Library nutrition program (optional, same block) |
| `start_date` | Week 1 day 1 for training; nutrition weekdays map from that week's Monday |
| `status` | `planned` \| `active` \| `completed` \| `archived` |
| `kickoff_form_id` / `checkin_form_id` / `habit_form_id` | Templates used when stamping forms |

Require at least one source (training or nutrition). A person can have more than one assignment over time. Do **not** use `people.program_id` as the enrollment (it still gets set to the training template for leftover readers).

## What assign stamps

`assignProgramToPerson` creates the assignment, then copies:

1. **Training** — every `program_days` row → a `workouts` row with `assignment_id`, `week_number`, `day_name`, `day_id` (lineage only, no FK), `workout_date`. Date = `start_date + (week − 1) × 7 + (day_number − 1)`. Exercises/sets copied via `copyProgramDayToWorkout`. Empty days are skipped.
2. **Nutrition** — every `day_meals` on the nutrition program → `meals_occurances` + `meals_foods_instances`, with `program_assignment_id`. Date = Monday of the start week + week offset + weekday (Mon=0 … Sun=6).
3. **Forms** — kickoff once on `start_date`; weekly check-in and/or habit on each week start (`start_date`, +7, +14, …) for `max(training weeks, nutrition weeks, 1)`. Copies go through existing `assignCheckinForm` (field snapshot). `checkin_form_assignments.program_assignment_id` links them. Person-level forms (onboarding, package habits) keep that column null.
4. **Goals** — optional `program_goals` rows on the assignment.

Single-day assign from the Workouts tab still copies a library day into a standalone `workouts` row (no `assignment_id`). Session “Assign from program” does **not** copy a library day. It attaches `sessions.workout_id` to an existing assigned program workout.

## Session vs solo

`program_days.delivery` and `workouts.delivery` are `session` | `solo` (default `solo`).

- **Session** = meant to be coached. Violet on the Program tab / Workouts calendar.
- **Solo** = completed without a booking. Orange/slate.

Assigning a program copies the library day’s delivery onto the stamped workout. Trainers can toggle it on the assigned workout. If remaining `SESSION` entitlements exist, **Schedule session** books a session onto that workout (`createSession` with `workout_id`) instead of cloning another instance. Booking sets `delivery` to `session`. Cancelled sessions do not count as booked.

## Assigned vs completed (same workout, two layers)

Do **not** clone `program_days`. The instance is still one `workouts` row.

| Layer | Where | Example |
| --- | --- | --- |
| Assigned workload | `workout_exercises.prescribed_*` | `465-485, RPE 7, 2×2` (full template ranges, frozen at assign) |
| Completed performance | `exercise_sets.weight/reps/rpe/rir` | `460, RPE 6, 2` then `480, RPE 8, 2` |
| Day done | `workouts.completed` | Assigned until the day is marked done |

Assign copies `program_exercises` ranges onto the exercise **as ranges** (not flattened to the lower bound). It still creates empty set slots (count from prescribed sets) with **null actuals**. Logging writes only the set columns. The Program tab shows Assigned and Completed as two lines per exercise.

`exercise_sets.prescribed_*` still exists from an earlier pass; new copies do not fill it. Prefer the exercise-level prescription.

Deleting an assignment **SET NULL**s `workouts.assignment_id`, `meals_occurances.program_assignment_id`, and `checkin_form_assignments.program_assignment_id` so logged history is not destroyed. `program_goals` cascade with the assignment.

## Assigned vs eaten (same meal, two layers)

Same decision as workouts. Do **not** clone `nutrition_weeks` / `nutrition_days`. The instance is one `meals_occurances` row.

| Layer | Where | Example |
| --- | --- | --- |
| Assigned | `meals_foods_instances.prescribed_*` | Chicken 6 oz |
| Eaten | `amount` / `unit` / `food_id` | Chicken 4 oz, or turkey as a substitution |
| Meal done | `status` pending / completed / skipped | Completing with empty eaten copies prescribed → eaten |

Day totals (`fetchCompletedMealMacrosByDate`) sum **eaten** on completed occurrences. Migration `20261015194500_meal_food_prescription.sql`.

## Goals vs forms vs nutrition goals

| Thing | Table | Job |
| --- | --- | --- |
| Mesocycle north star | `program_goals` | “+5 lb muscle”, squat target, qualitative hope. `kind`: qualitative / bodyweight / body_comp / lift / other. |
| How they felt / habits | `checkin_form_assignments` + answers | Time series during the block. Reuse form `purpose`: intake (kickoff), checkin, habit. |
| Monthly macros | `client_nutrition_goals` | Unchanged. Not this block. |
| Trainer business KPIs | `trainer_goals` | Unchanged. |

Do not invent a second questionnaire system. Do not store “+5 lb” only as a text answer if it needs a chart — that belongs on `program_goals`.

Package `checkin` / `habit` units and `tasks` stay **billing** (paid deliverable). The assignment is **which forms and which weeks**. They can coexist.

## Client page

New **Program** tab (`ClientProgramView`): pick an assignment, then Workouts / Meals / Check-ins / Goals.

- Workouts grouped by `week_number`. Color-coded by `delivery` (violet session / orange solo). Day status is `workouts.completed`. Each exercise shows Assigned (`prescribed_*`) vs Completed (logged sets). Schedule session when remaining session units exist.
- Meals and check-ins filtered by the assignment FK.
- **Assign program** opens `AssignProgramDialog` (training and/or nutrition, start date, optional forms and goals).

Existing Workouts / Nutrition / Progress tabs still list ungrouped instances (including ones not on a block).

## Code map

| Piece | Path |
| --- | --- |
| Migration | `supabase/migrations/20261015190000_program_assignments.sql`, `20261015193000_workout_exercise_prescription.sql`, `20261015194500_meal_food_prescription.sql`, `20261015200000_workout_delivery.sql` |
| Stamp block | `supabase/utils/assignProgramToPerson.ts` |
| Copy one day | `supabase/utils/copyProgramDayToWorkout.ts` |
| Dates | `supabase/utils/programDates.ts` |
| Assigned/completed text | `supabase/utils/formatWorkload.ts` |
| Fetch / upsert | `supabase/fetches/fetchprogramassignments.ts`, `supabase/upserts/upsertprogramassignment.ts` |
| UI | `modules/clients/assignprogramdialog.tsx`, `modules/clients/clientprogramview.tsx` |

## What this is not

- Not a cloned week/day table tree (`person_program_weeks`, etc.). The calendar unit is still `workouts`.
- Not subscriptions / auto-charge (Stripe is separate).
- Not client-app UI yet (trainer web client page only).
- Workout package units still do not decrement on assign (`workouts` has no `person_package_id`). Same as `workouts-instances-vs-templates.md`.
