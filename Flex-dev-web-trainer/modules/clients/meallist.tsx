'use client'

import React, { useState } from 'react'
import { AssignedMeal, AssignedMealStatus } from '@/supabase/fetches/fetchassignedmeals'
import { upsertAssignedMeal } from '@/supabase/upserts/upsertassignedmeal'
import { fetchAssignedMeals } from '@/supabase/fetches/fetchassignedmeals'
import { upsertMealsOccurancesFood } from '@/supabase/upserts/upsertmealsoccurancesfood'
import { Check, Undo2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

type MealListProps = {
  assignedMeals: AssignedMeal[]
  personId: string
  onMealUpdate: (meals: AssignedMeal[]) => void
}

export default function MealList({ assignedMeals, personId, onMealUpdate }: MealListProps) {
  const [savingFoodId, setSavingFoodId] = useState<string | null>(null)

  const refresh = async () => {
    const meals = await fetchAssignedMeals(personId)
    onMealUpdate(meals)
  }

  const setStatus = async (meal: AssignedMeal, status: AssignedMealStatus) => {
    try {
      await upsertAssignedMeal({
        id: meal.id,
        person_id: meal.person_id,
        meal_id: meal.meal_id,
        assigned_date: meal.assigned_date?.slice(0, 10),
        name: meal.name || meal.meal_name || 'Meal',
        status,
      })
      await refresh()
    } catch (err) {
      console.error('Error updating meal status:', err)
      alert('Error updating meal. Please try again.')
    }
  }

  const savePortion = async (
    meal: AssignedMeal,
    foodId: string,
    amount: number | null,
    unit: string | null,
    foodName: string | null,
    foodPk: number | null
  ) => {
    setSavingFoodId(foodId)
    try {
      await upsertMealsOccurancesFood({
        id: foodId,
        meal_id: meal.id,
        food_id: foodPk,
        food_name: foodName,
        amount,
        unit,
      })
      await refresh()
    } catch (err) {
      console.error('Error updating portion:', err)
      alert('Error updating portion. Please try again.')
    } finally {
      setSavingFoodId(null)
    }
  }

  if (assignedMeals.length === 0) {
    return <p className="text-muted-foreground">No meals assigned.</p>
  }

  return (
    <div className="space-y-4">
      {assignedMeals
        .sort((a, b) => {
          const dateA = new Date(a.assigned_date).getTime()
          const dateB = new Date(b.assigned_date).getTime()
          return dateB - dateA
        })
        .map((meal) => (
          <div
            key={meal.id}
            className={`bg-background border rounded-lg p-4 ${
              meal.status === 'completed'
                ? 'border-green-500/50 bg-green-500/5'
                : meal.status === 'skipped'
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-orange-500/50 bg-orange-500/5'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {meal.meal_name || meal.name || 'Meal'}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded border ${
                      meal.status === 'completed'
                        ? 'bg-green-600/20 text-green-400 border-green-600/50'
                        : meal.status === 'skipped'
                        ? 'bg-red-600/20 text-red-400 border-red-600/50'
                        : 'bg-orange-600/20 text-orange-400 border-orange-600/50'
                    }`}
                  >
                    {meal.status.charAt(0).toUpperCase() + meal.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Date:</span>{' '}
                  {meal.assigned_date?.slice(0, 10) || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {meal.status === 'pending' && (
                  <>
                    <button
                      onClick={() => setStatus(meal, 'completed')}
                      className="p-2 text-green-500 hover:text-green-600 cursor-pointer"
                      title="Mark as eaten — adds macros to that day"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setStatus(meal, 'skipped')}
                      className="p-2 text-red-500 hover:text-red-600 cursor-pointer"
                      title="Skip — does not add macros"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                )}
                {meal.status !== 'pending' && (
                  <button
                    onClick={() => setStatus(meal, 'pending')}
                    className="p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move back to pending — removes meal macros from the day"
                  >
                    <Undo2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {meal.foods && meal.foods.length > 0 ? (
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-medium text-foreground">Foods / portions</h4>
                {meal.foods.map((food, idx) => (
                  <MealFoodRow
                    key={food.id || idx}
                    amount={food.amount}
                    unit={food.unit}
                    name={food.food_name}
                    saving={savingFoodId === food.id}
                    onSave={(amount, unit) =>
                      savePortion(
                        meal,
                        food.id,
                        amount,
                        unit,
                        food.food_name,
                        food.food_id
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm mt-4">
                No foods recorded for this meal.
              </p>
            )}
          </div>
        ))}
    </div>
  )
}

function MealFoodRow({
  amount,
  unit,
  name,
  saving,
  onSave,
}: {
  amount: number | null
  unit: string | null
  name: string | null
  saving: boolean
  onSave: (amount: number | null, unit: string | null) => void
}) {
  const [localAmount, setLocalAmount] = useState(amount != null ? String(amount) : '')
  const [localUnit, setLocalUnit] = useState(unit || 'g')

  return (
    <div className="bg-muted rounded-md p-2 text-sm flex flex-wrap items-center gap-2">
      <span className="font-medium text-foreground flex-1 min-w-[120px]">
        {name || 'Unknown Food'}
      </span>
      <Input
        type="number"
        min="0"
        step="1"
        value={localAmount}
        onChange={(e) => setLocalAmount(e.target.value)}
        className="bg-input text-foreground border-border w-20 h-8"
      />
      <Input
        value={localUnit}
        onChange={(e) => setLocalUnit(e.target.value)}
        className="bg-input text-foreground border-border w-20 h-8"
      />
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          onSave(localAmount === '' ? null : Number(localAmount), localUnit || null)
        }
        className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
