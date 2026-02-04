import { supabase } from '@/supabase/supabaseClient'
import { AssignedMeal, AssignedMealStatus } from '@/supabase/fetches/fetchassignedmeals'

export type AssignedMealInput = {
  id?: string // uuid
  person_id: string // uuid, references people.id
  meal_id?: string | null // uuid, references day_meals.id or meals_templates.id (nullable for on-the-spot meals)
  assigned_date: string // date
  status?: AssignedMealStatus // defaults to 'pending'
  name?: string | null // Name for on-the-spot meals (NOT NULL in schema)
  trainer_id?: string | null // uuid, for on-the-spot meals
}

export async function upsertAssignedMeal(assignedMeal: AssignedMealInput): Promise<AssignedMeal | null> {
  try {
    // name is NOT NULL in schema - must always be provided
    if (!assignedMeal.name && !assignedMeal.meal_id) {
      console.error('Error: name is required for meals_occurances (NOT NULL constraint)')
      return null
    }

    const mealData: Record<string, any> = {
      person_id: assignedMeal.person_id,
      assigned_date: assignedMeal.assigned_date,
      status: assignedMeal.status || 'pending',
      name: assignedMeal.name || 'Meal', // NOT NULL - provide fallback if not set
      updated_at: new Date().toISOString(),
    }
    
    // Add optional fields
    if (assignedMeal.meal_id !== undefined) {
      mealData.meal_id = assignedMeal.meal_id
    }
    if (assignedMeal.trainer_id !== undefined) {
      mealData.trainer_id = assignedMeal.trainer_id
    }

    if (assignedMeal.id) {
      // Update existing assigned meal
      const { data, error } = await supabase
        .from('meals_occurances')
        .update(mealData)
        .eq('id', assignedMeal.id)
        .select()
        .single()

      if (error) throw error
      return data as AssignedMeal
    } else {
      // Insert new assigned meal
      const { data, error } = await supabase
        .from('meals_occurances')
        .insert([mealData])
        .select()
        .single()

      if (error) throw error
      return data as AssignedMeal
    }
  } catch (err) {
    console.error('Error upserting assigned meal:', err)
    return null
  }
}

export async function deleteAssignedMeal(assignedMealId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('meals_occurances')
      .delete()
      .eq('id', assignedMealId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting assigned meal:', err)
    return false
  }
}

