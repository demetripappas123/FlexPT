# Nutrition extras vs completed meals

Date: September 29, 2026

## Split

Client daily calories/macros are **two layers**:

1. **Extra** — what the trainer or client types on Overview (`nutrition_entries.extra_*`).
2. **From meals** — sum of **completed** `meals_occurances` on that date, from occurrence foods.

**Displayed day total = extra + from meals.** Goals still compare to that total.

Completed meals are not a lock on the day. Changing portions, foods, or status recalculates the meal layer. Extra is left alone. Uncheck / skip / delete a completed meal drops it from the meal layer (reverse is free).

Pending and skipped meals contribute **nothing**. Assigned meals are optional.

Micros stay on foods (`food_nutrients`). Only Energy (kcal), Protein, Carbohydrate by difference, and Total lipid feed the day total.

## Tables

| Table | Role |
| --- | --- |
| `nutrition_entries` | Extra calories/macros per client per date. Legacy `calories` / `protein_grams` / `carbs_grams` / `fats_grams` are kept in sync with extra for older readers. |
| `client_nutrition_goals` | Monthly calorie/macro targets. Unchanged. |
| `meals_occurances` | Assigned meal instance. `assigned_date` is the calendar day. `status` is pending / completed / skipped. `meal_id` is an optional program/template source. |
| `meals_foods_instances` | Foods and portions on an occurrence (`amount` + `unit`). |
| `food_nutrients` + `nutrients` | Per-100g nutrients. Macros use nutrient ids Energy kcal `1093`, Protein `1045`, Carb `1092`, Fat `1091`. |
| `food_servings` / `food_units` | Portion scaling (g, oz, serving, etc.). |

There is no separate client `macros` table.

## App behavior

- Overview chart and editor show **totals**. Saving converts typed totals back to extra: `extra = displayed − from meals`.
- Checking off a meal only sets `status = completed`. Totals are merged at read time (`fetchClientNutritionDayTotals`).
- Saving a new portion on a completed occurrence changes the meal layer on the next load.
- Occurrence food writes go to `meals_foods_instances` (`food_id` is `foods.id`, not `fdc_id`).
