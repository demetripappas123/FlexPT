import { supabase } from '@/src/api/supabase'
import { AssignedMeal, AssignedMealStatus } from '@/src/api/fetches/fetchassignedmeals'

export type AssignedMealInput = {
  id?: string
  person_id: string
  meal_id?: string | null
  assigned_date?: string
  status?: AssignedMealStatus
  name?: string | null
  trainer_id?: string | null
}

export async function upsertAssignedMeal(assignedMeal: AssignedMealInput): Promise<AssignedMeal | null> {
  try {
    const name = assignedMeal.name?.trim()
    if (!assignedMeal.id && !name) {
      console.error('Error: name is required for meals_occurances')
      return null
    }

    const mealData: Record<string, unknown> = {
      person_id: assignedMeal.person_id,
      status: assignedMeal.status || 'pending',
      updated_at: new Date().toISOString(),
    }

    if (assignedMeal.assigned_date) {
      mealData.assigned_date = assignedMeal.assigned_date
    }

    if (name) mealData.name = name
    if (assignedMeal.meal_id !== undefined) {
      mealData.meal_id = assignedMeal.meal_id || null
    }
    if (assignedMeal.trainer_id !== undefined) {
      mealData.trainer_id = assignedMeal.trainer_id
    }

    if (assignedMeal.id) {
      const { data, error } = await supabase
        .from('meals_occurances')
        .update(mealData)
        .eq('id', assignedMeal.id)
        .select()
        .single()

      if (error) throw error
      return data as AssignedMeal
    }

    const { data, error } = await supabase
      .from('meals_occurances')
      .insert([{ ...mealData, name: name || 'Meal' }])
      .select()
      .single()

    if (error) throw error
    return data as AssignedMeal
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
