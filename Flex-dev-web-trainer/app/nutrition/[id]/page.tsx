'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/supabase/supabaseClient'
import { fetchNutritionWeeks, NutritionWeek } from '@/supabase/fetches/fetchnutritionweeks'
import { upsertNutritionWeek } from '@/supabase/upserts/upsertnutritionweek'
import { upsertNutritionDay, deleteNutritionDay } from '@/supabase/upserts/upsertnutritionday'
import { upsertDayMeal, deleteDayMeal, getNextMealNumber } from '@/supabase/upserts/upsertdaymeal'
import { upsertDayMealFood, deleteDayMealFood } from '@/supabase/upserts/upsertdaymealfood'
import { fetchNutritionPrograms, NutritionProgram } from '@/supabase/fetches/fetchnutritionprograms'
import { fetchFoods, Food } from '@/supabase/fetches/fetchfoods'
import { fetchUserFoods } from '@/supabase/fetches/fetchuserfoods'
import { fetchCommunityFoods } from '@/supabase/fetches/fetchcommunityfoods'
import { fetchFoodUnits, FoodUnit } from '@/supabase/fetches/fetchfoodunits'
import { Plus, Trash2, Edit } from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import AddNutritionDayDialog from '@/modules/nutrition/addnutritiondaydialog'
import DeleteNutritionWeekDialog from '@/modules/nutrition/deletenutritionweek'
import DeleteNutritionDayDialog from '@/modules/nutrition/deletenutritionday'

export default function NutritionProgramPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()

  const [program, setProgram] = useState<NutritionProgram | null>(null)
  const [weeks, setWeeks] = useState<NutritionWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [foodLibrary, setFoodLibrary] = useState<Food[]>([])
  const [foodUnits, setFoodUnits] = useState<FoodUnit[]>([])

  // For controlling the AddDayDialog per week
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null)
  // For controlling edit mode - stores the day being edited
  const [editingDayId, setEditingDayId] = useState<number | null>(null)
  // For editing meals
  const [editingMealId, setEditingMealId] = useState<number | null>(null)

  const refreshWeeks = async () => {
    const programId = params.id
    if (!programId || typeof programId !== 'string') return

    try {
      const weeksData = await fetchNutritionWeeks(programId)
      setWeeks(weeksData)
    } catch (err) {
      console.error('Failed to fetch weeks:', err)
    }
  }

  useEffect(() => {
    const loadProgram = async () => {
      const programId = params.id
      if (!programId || typeof programId !== 'string') return setLoading(false)

      setLoading(true)
      try {
        // Fetch program
        const programs = await fetchNutritionPrograms(user?.id)
        const programData = programs.find(p => p.id === programId)

        if (!programData) {
          setProgram(null)
        } else {
          setProgram(programData)
        }

        // Load food library and food units
        const [baseFoods, userFoods, communityFoods, units] = await Promise.all([
          fetchFoods(),
          fetchUserFoods(user?.id),
          fetchCommunityFoods(),
          fetchFoodUnits()
        ])
        const allFoods = [...baseFoods, ...userFoods, ...communityFoods]
        setFoodLibrary(allFoods)
        setFoodUnits(units)

        await refreshWeeks()
      } catch (err) {
        console.error('Unexpected error loading program:', err)
        setProgram(null)
        setWeeks([])
      } finally {
        setLoading(false)
      }
    }

    loadProgram()
  }, [params.id, user])

  const handleAddWeek = async () => {
    if (!program) return

    try {
      const nextWeekNumber = weeks.length > 0 
        ? Math.max(...weeks.map(w => w.week_number)) + 1 
        : 1

      const savedWeek = await upsertNutritionWeek({
        program_id: program.id,
        week_number: nextWeekNumber,
      })
      
      if (savedWeek) {
        await refreshWeeks()
      }
    } catch (err) {
      console.error('Failed to add week:', err)
    }
  }

  const handleAddDaySubmit = async (payload: { 
    dayTitle: string
    dayOfWeek: string
    date: string | null
    meals: Array<{
      meal_time: string | null
      name: string | null
      foods: Array<{
        food_id: string | null // Food id from foods table (string)
        food_name: string | null
        amount: number | null
        unit: string | null // food_unit id
      }>
      notes: string | null
    }>
    dayId?: string
  }) => {
    const isEditMode = !!payload.dayId

    try {
      let dayId: string

      if (isEditMode) {
        // EDIT MODE: Update existing day
        if (!payload.dayId) {
          console.error('No day ID provided for edit mode')
          return
        }

        const week = weeks.find(w => w.days.some(d => d.id === payload.dayId))
        if (!week) {
          console.error('Week not found for day ID:', payload.dayId)
          return
        }

        // STEP 1: Update the nutrition_day entry
        const updatedDay = await upsertNutritionDay({
          id: payload.dayId,
          nutrition_week_id: week.id,
          day_of_week: payload.dayOfWeek,
        })
        
        if (!updatedDay) {
          throw new Error('Failed to update nutrition day')
        }
        dayId = updatedDay.id

        // Delete existing meals and their foods, then recreate
        const day = week.days.find(d => d.id === dayId)
        if (day) {
          for (const meal of day.meals) {
            // Delete all foods for this meal first
            for (const food of meal.foods) {
              await deleteDayMealFood(food.id)
            }
            // Then delete the meal
            await deleteDayMeal(meal.id)
          }
        }
      } else {
        // ADD MODE: Create new day
        if (!activeWeekId) {
          console.error('No active week ID')
          return
        }

        // STEP 1: Create the nutrition_day entry (references nutrition_weeks.id)
        console.log('Creating nutrition day for week:', activeWeekId)
        const newDay = await upsertNutritionDay({
          nutrition_week_id: activeWeekId,
          day_of_week: payload.dayOfWeek,
        })
        
        if (!newDay) {
          throw new Error('Failed to create nutrition day')
        }
        dayId = newDay.id
        console.log('Created nutrition day with ID:', dayId)
      }

      // STEP 2: Create all meals (day_meals entries that reference nutrition_days.id)
      console.log('Creating meals for day:', dayId)
      for (let i = 0; i < payload.meals.length; i++) {
        const meal = payload.meals[i]
        
        // Create the meal entry in day_meals
        const createdMeal = await upsertDayMeal({
          nutrition_day: dayId,
          name: meal.name || `Meal ${i + 1}`, // Don't use meal_time as fallback - it's a time value, not a name
          description: meal.notes || null,
          meal_time: meal.meal_time || null, // This should be a valid time string (HH:MM:SS) or null
          meal_number: i + 1,
          meal_template_id: null,
        })
        
        if (!createdMeal) {
          console.error(`Failed to create meal ${i + 1}`)
          continue
        }
        console.log(`Created meal ${i + 1} with ID:`, createdMeal.id)

        // STEP 3: Create all food entries for this meal (meal_foods_programmed entries that reference day_meals.id)
        if (meal.foods && meal.foods.length > 0) {
          console.log(`Creating ${meal.foods.length} foods for meal ${i + 1}`)
          for (const food of meal.foods) {
            if (food.food_id || food.food_name) {
              // Find the food in library to get fdc_id
              const foodFromLibrary = food.food_id ? foodLibrary.find(f => f.id === food.food_id) : null
              
              const foodResult = await upsertDayMealFood({
                meal_id: createdMeal.id, // Reference to day_meals.id
                food_id: foodFromLibrary?.id || null, // Use foods.id (UUID string), not fdc_id
                food_name: food.food_name || foodFromLibrary?.description || null,
                amount: food.amount !== null && food.amount !== undefined ? Number(food.amount) : null, // Ensure it's a number (int4)
                unit: food.unit, // food_unit id as string
              })
              
              if (!foodResult) {
                console.error(`Failed to create food for meal ${i + 1}:`, {
                  food_name: food.food_name || food.food_id,
                  food_id: foodFromLibrary?.fdc_id,
                  amount: food.amount,
                  unit: food.unit,
                  meal_id: createdMeal.id
                })
              } else {
                console.log(`Created food for meal ${i + 1}:`, food.food_name || food.food_id)
              }
            }
          }
        } else {
          console.log(`No foods to add for meal ${i + 1}`)
        }
      }

      console.log('Successfully completed add day workflow')

      // Refresh weeks to show the updated/new day
      await refreshWeeks()
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'add'} day:`, err)
    } finally {
      setActiveWeekId(null)
      setEditingDayId(null)
    }
  }

  const handleDeleteWeek = async (weekId: number) => {
    try {
      await refreshWeeks()
    } catch (err) {
      console.error('Failed to refresh after delete:', err)
    }
  }

  const handleDeleteDay = async (dayId: string) => {
    try {
      await refreshWeeks()
    } catch (err) {
      console.error('Failed to refresh after delete:', err)
    }
  }

  if (loading) return <p className="text-muted-foreground p-6">Loading nutrition program...</p>
  if (!program) return <p className="text-muted-foreground p-6">Nutrition program not found.</p>

  return (
    <div className="p-6 bg-background min-h-screen text-foreground">
      {/* Header Section */}
      <div className="space-y-4 mb-6">
        <button
          onClick={() => router.back()}
          className="px-3 py-1 bg-muted rounded-md hover:bg-muted/80 text-foreground"
        >
          ← Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{program.name}</h1>
            {program.description && (
              <p className="text-muted-foreground">{program.description}</p>
            )}
          </div>
          
          <div className="flex justify-start">
            <button
              onClick={handleAddWeek}
              className="flex items-center gap-2 px-4 py-2 bg-primary rounded-md hover:bg-primary/90 cursor-pointer text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              <span>Add Week</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {weeks.length === 0 && (
          <p className="text-muted-foreground">No weeks yet. Add one!</p>
        )}

        {weeks.map(week => (
          <div
            key={week.id}
            className="flex items-start justify-between p-4 bg-card border border-border rounded-md"
          >
            <div className="flex-1">
              <p className="text-foreground font-semibold mb-2">
                Week {week.week_number}
              </p>

              <div className="flex gap-2 flex-wrap items-start justify-between">
                <div className="flex gap-2 flex-wrap items-start">
                  {week.days
                    .sort((a, b) => {
                      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                      return dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week)
                    })
                    .map(day => (
                    <div
                      key={day.id}
                      className="p-3 border border-border rounded-md bg-background min-w-[250px] relative"
                    >
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          onClick={() => setEditingDayId(day.id)}
                          className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                          title="Edit day"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <DeleteNutritionDayDialog
                          dayId={day.id}
                          dayTitle={day.day_of_week}
                          onDeleted={handleDeleteDay}
                        />
                      </div>

                      <h3 className="text-foreground font-medium mb-2">
                        {day.day_of_week}
                      </h3>

                      {/* Meals */}
                      <div className="space-y-2">
                        {day.meals.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No meals</p>
                        ) : (
                          day.meals.map(meal => {
                            return (
                              <div key={meal.id} className="text-xs border-l-2 pl-2 border-border">
                                <div className="font-medium text-foreground">
                                  {meal.name || (meal.meal_time 
                                    ? new Date(`2000-01-01T${meal.meal_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : meal.meal_number 
                                      ? `Meal ${meal.meal_number}`
                                      : 'Meal')}
                                </div>
                                {meal.description && (
                                  <div className="text-muted-foreground italic text-xs mb-1">{meal.description}</div>
                                )}
                                {meal.foods && meal.foods.length > 0 && meal.foods.map((foodItem: any, idx: number) => {
                                  const food = foodLibrary.find(f => f.id === foodItem.food_id)
                                  const foodName = food?.description || foodItem.food_name || 'Unknown food'
                                  const unit = foodUnits.find(u => u.id === foodItem.unit)
                                  const unitName = unit?.name || (foodItem.unit ? `unit ${foodItem.unit}` : '')
                                  return (
                                    <div key={idx} className="text-muted-foreground">
                                      {foodName}
                                      {foodItem.amount && (
                                        <span> - {foodItem.amount} {unitName}</span>
                                      )}
                                    </div>
                                  )
                                })}
                                {(!meal.foods || meal.foods.length === 0) && (
                                  <div className="text-muted-foreground italic">No foods</div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setActiveWeekId(week.id)}
                  className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-md text-foreground cursor-pointer flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Day
                </button>
              </div>
            </div>

            <div className="ml-4">
              <DeleteNutritionWeekDialog
                weekId={week.id}
                weekNumber={week.week_number}
                onDeleted={handleDeleteWeek}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Day Dialog */}
      {activeWeekId && (
        <AddNutritionDayDialog
          open={!!activeWeekId}
          onOpenChange={(open) => !open && setActiveWeekId(null)}
          weekId={activeWeekId}
          foodLibrary={foodLibrary}
          onSubmit={handleAddDaySubmit}
        />
      )}

      {editingDayId && (() => {
        const day = weeks.flatMap(w => w.days).find(d => d.id === editingDayId)
        const week = weeks.find(w => w.days.some(d => d.id === editingDayId))
        if (!day || !week) return null
        
        return (
          <AddNutritionDayDialog
            open={!!editingDayId}
            onOpenChange={(open) => !open && setEditingDayId(null)}
            weekId={week.id}
            dayId={editingDayId}
            foodLibrary={foodLibrary}
            onSubmit={handleAddDaySubmit}
            initialDayData={day}
          />
        )
      })()}
    </div>
  )
}

