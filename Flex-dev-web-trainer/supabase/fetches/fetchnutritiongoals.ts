import { supabase } from '@/supabase/supabaseClient'

export interface NutritionGoal {
  id: string
  client_id: string
  goal_month: string // date as string (first day of month)
  calorie_goal: number | null
  protein_goal: number | null
  carbs_goal: number | null
  fats_goal: number | null
  created_at: string
  updated_at: string
}

/**
 * Fetches all nutrition goals for a specific client.
 * Optionally filter by trainer_id
 */
export async function fetchClientNutritionGoals(clientId: string, trainerId?: string | null): Promise<NutritionGoal[]> {
  let query = supabase
    .from('client_nutrition_goals')
    .select('*')
    .eq('client_id', clientId)
    .order('goal_month', { ascending: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching client nutrition goals:', error)
    throw error
  }

  return data || []
}

/**
 * Fetches nutrition goals for a specific client and month.
 */
export async function fetchClientNutritionGoalByMonth(
  clientId: string,
  goalMonth: string // format: 'YYYY-MM-01' (first day of month)
): Promise<NutritionGoal | null> {
  const { data, error } = await supabase
    .from('client_nutrition_goals')
    .select('*')
    .eq('client_id', clientId)
    .eq('goal_month', goalMonth)
    .maybeSingle()

  if (error) {
    console.error('Error fetching client nutrition goal by month:', error)
    throw error
  }

  return data || null
}








