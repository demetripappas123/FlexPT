'use client'

import React from 'react'
import { AssignedMeal } from '@/supabase/fetches/fetchassignedmeals'
import { upsertAssignedMeal } from '@/supabase/upserts/upsertassignedmeal'
import { fetchAssignedMeals } from '@/supabase/fetches/fetchassignedmeals'
import { Check } from 'lucide-react'

type MealListProps = {
  assignedMeals: AssignedMeal[]
  personId: string
  onMealUpdate: (meals: AssignedMeal[]) => void
}

export default function MealList({ assignedMeals, personId, onMealUpdate }: MealListProps) {
  const handleCompleteMeal = async (meal: AssignedMeal) => {
    try {
      await upsertAssignedMeal({
        id: meal.id,
        person_id: meal.person_id,
        meal_id: meal.meal_id,
        assigned_date: meal.assigned_date,
        status: 'completed',
      })
      const meals = await fetchAssignedMeals(personId)
      onMealUpdate(meals)
    } catch (err) {
      console.error('Error completing meal:', err)
      alert('Error completing meal. Please try again.')
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
                    {meal.meal_name || 'Meal'}
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
                  {new Date(meal.assigned_date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {meal.status === 'pending' && (
                  <button
                    onClick={() => handleCompleteMeal(meal)}
                    className="p-2 text-green-500 hover:text-green-600 cursor-pointer"
                    title="Mark as completed"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {meal.foods && meal.foods.length > 0 ? (
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-medium text-foreground">Foods:</h4>
                {meal.foods.map((food, idx) => (
                  <div
                    key={food.id || idx}
                    className="bg-muted rounded-md p-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {food.food_name || 'Unknown Food'}
                      </span>
                      {food.amount && food.unit && (
                        <span className="text-muted-foreground">
                          {food.amount} {food.unit}
                        </span>
                      )}
                    </div>
                  </div>
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

