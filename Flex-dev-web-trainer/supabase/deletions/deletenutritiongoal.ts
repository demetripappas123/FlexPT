import { supabase } from '@/supabase/supabaseClient'

/**
 * Deletes a nutrition goal by ID.
 */
export async function deleteNutritionGoal(goalId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('client_nutrition_goals')
      .delete()
      .eq('id', goalId)

    if (error) {
      console.error('deleteNutritionGoal error:', error)
      throw error
    }

    return true
  } catch (err) {
    console.error('deleteNutritionGoal error:', err)
    return false
  }
}

/**
 * Deletes a nutrition goal by client_id and goal_month.
 */
export async function deleteNutritionGoalByMonth(
  clientId: string,
  goalMonth: string // format: 'YYYY-MM-01'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('client_nutrition_goals')
      .delete()
      .eq('client_id', clientId)
      .eq('goal_month', goalMonth)

    if (error) {
      console.error('deleteNutritionGoalByMonth error:', error)
      throw error
    }

    return true
  } catch (err) {
    console.error('deleteNutritionGoalByMonth error:', err)
    return false
  }
}













