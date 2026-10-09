'use client'

import React from 'react'
import { AssignedMeal, fetchAssignedMeals } from '@/supabase/fetches/fetchassignedmeals'
import MealCalendar from '@/modules/clients/mealcalendar'
import MealList from '@/modules/clients/meallist'
import ViewToggle from '@/modules/clients/viewtoggle'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

type MealsManagementProps = {
  assignedMeals: AssignedMeal[] | null
  personId: string
  mealView: 'list' | 'calendar'
  onMealViewChange: (view: 'list' | 'calendar') => void
  onAssignMealClick: () => void
  onDateClick?: (date: Date) => void
  onMealUpdate: (meals: AssignedMeal[]) => void
}

export default function MealsManagement({
  assignedMeals,
  personId,
  mealView,
  onMealViewChange,
  onAssignMealClick,
  onDateClick,
  onMealUpdate,
}: MealsManagementProps) {
  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Assigned Meals {assignedMeals && assignedMeals.length > 0 && `(${assignedMeals.length} meals)`}
        </h2>
        <div className="flex items-center gap-2">
          <ViewToggle view={mealView} onViewChange={onMealViewChange} />
          <Button
            onClick={onAssignMealClick}
            variant="outline"
            className="bg-card hover:bg-muted text-foreground border-border cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Assign Meal
          </Button>
        </div>
      </div>

      {/* View Content */}
      {mealView === 'calendar' ? (
        <MealCalendar
          assignedMeals={assignedMeals || []}
          onMealUpdate={async () => {
            // Fetch updated meals and pass to parent
            const meals = await fetchAssignedMeals(personId)
            onMealUpdate(meals)
          }}
          onMealClick={(meal) => {
            console.log('Meal clicked:', meal)
          }}
          onDateClick={onDateClick}
        />
      ) : (
        <MealList
          assignedMeals={assignedMeals || []}
          personId={personId}
          onMealUpdate={onMealUpdate}
        />
      )}
    </div>
  )
}

