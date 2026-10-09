# Workouts vs templates (instances vs library / programs)

Date: September 29, 2026

## Workouts are instances, not catalog items

`workouts` is an **event unit**: a piece of work assigned to a person. It can be:

- attached to a **session** (what happens during a coached booking), or
- assigned to be **completed on their own** (no session).

It is **not** a reusable template. A workout library, program day, or similar catalog **must not** store or list rows from `workouts`. Assigning from a template **creates a new** `workouts` row for that person.

## Template tables (do not mix with `workouts`)

| Role | Tables |
| --- | --- |
| Program blueprint | `programs` → `program_weeks` → `program_days` → `program_exercises` |
| Workout library (exists, UI still stub) | `workout_library` → `workout_library_exercises` |
| Instance | `workouts` → `workout_exercises` → `exercise_sets` |

Copying from a program day or a library item into a client means: insert `workouts` + exercises/sets. The source template rows stay put.

## Sessions overlay a workout

- `sessions.workout_id` is optional. A booked session can exist before a workout is assigned.
- Deleting a workout **unlinks** the session (`ON DELETE SET NULL`). It does **not** delete the booking.
- Unassign in the UI nulls `workout_id` then deletes the workout instance. That is safe either way.

Do not treat `workouts` as owned by `sessions`. The workout is the unit; the session is the coached delivery of (at most) one of them.

## Entitlements: 7 workouts vs 2 sessions

`person_packages` are consumable grants from a payment, keyed by `service_id`.

Example package: 7 programmed workouts per week and 2 coaching sessions. That means **7 `workouts` rows** should be assigned in that cycle, and **2 `sessions`**. Two of those seven may also be the session workouts (coached); the other five are self-completed.

- `SESSION` services are consumed by `sessions.person_package_id` (remaining = granted minus consuming sessions).
- `WORKOUT` services exist on packages (e.g. "Programmed Workout") but **are not yet consumed by `workouts`** (`workouts` has no `person_package_id`). Do not assume remaining workout units decrement when you assign a programmed day.

Calendar scheduling currently only offers remaining **session** entitlements.

## Related billing split (same idea)

Same template-vs-instance pattern as billing:

- `packages` = template
- `contracts` = instance copied from a package, independently editable
- `person_packages` = entitlements created by a **payment**, not by assigning a contract
