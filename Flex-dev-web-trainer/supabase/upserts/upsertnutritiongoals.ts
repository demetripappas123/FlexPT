import { supabase } from '@/supabase/supabaseClient'
import { NutritionGoal } from '@/supabase/fetches/fetchnutritiongoals'

export type NutritionGoalInput = {
  client_id: string
  goal_month: string // format: 'YYYY-MM-01' (first day of month)
  calorie_goal?: number | null
  protein_goal?: number | null
  carbs_goal?: number | null
  fats_goal?: number | null
}

/**
 * Upserts a nutrition goal for a client (creates if doesn't exist, updates if it does).
 * Uses client_id and goal_month to find existing goals.
 */
export async function upsertNutritionGoal(
  goal: NutritionGoalInput
): Promise<NutritionGoal | null> {
  try {
    // First, check if a goal exists for this client and month
    const { data: existing, error: fetchError } = await supabase
      .from('client_nutrition_goals')
      .select('*')
      .eq('client_id', goal.client_id)
      .eq('goal_month', goal.goal_month)
      .maybeSingle()

    if (fetchError) {
      console.error('upsertNutritionGoal fetch error:', fetchError)
      throw fetchError
    }

    const goalData = {
      client_id: goal.client_id,
      goal_month: goal.goal_month,
      calorie_goal: goal.calorie_goal ?? null,
      protein_goal: goal.protein_goal ?? null,
      carbs_goal: goal.carbs_goal ?? null,
      fats_goal: goal.fats_goal ?? null,
      updated_at: new Date().toISOString(),
    }

    let result
    if (existing) {
      // Update existing goal
      const { data, error } = await supabase
        .from('client_nutrition_goals')
        .update(goalData)
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error) {
        console.error('upsertNutritionGoal update error:', error)
        throw error
      }
      result = data
    } else {
      // Insert new goal
      const { data, error } = await supabase
        .from('client_nutrition_goals')
        .insert(goalData)
        .select('*')
        .single()

      if (error) {
        console.error('upsertNutritionGoal insert error:', error)
        throw error
      }
      result = data
    }

    return result as NutritionGoal
  } catch (err) {
    console.error('upsertNutritionGoal error:', err)
    return null
  }
}

/**
 * Updates an existing nutrition goal by ID.
 */
export async function updateNutritionGoal(
  goalId: string,
  updates: Partial<Omit<NutritionGoalInput, 'client_id' | 'goal_month'>>
): Promise<NutritionGoal | null> {
  try {
    const { data, error } = await supabase
      .from('client_nutrition_goals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .select('*')
      .single()

    if (error) {
      console.error('updateNutritionGoal error:', error)
      throw error
    }

    return data as NutritionGoal
  } catch (err) {
    console.error('updateNutritionGoal error:', err)
    return null
  }
}

