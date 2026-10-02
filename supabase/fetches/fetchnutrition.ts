import { supabase } from '@/supabase/supabaseClient'
import { fetchCompletedMealMacrosByDate } from './fetchcompletedmealmacros'
import { mergeNutritionDayTotals } from '../utils/nutritionDayTotals'

export interface NutritionEntry {
  id: string
  client_id: string
  entry_date: string
  calories: number | null
  protein_grams: number | null
  carbs_grams: number | null
  fats_grams: number | null
  extra_calories?: number | null
  extra_protein_grams?: number | null
  extra_carbs_grams?: number | null
  extra_fats_grams?: number | null
  from_meals?: {
    calories: number
    protein_grams: number
    carbs_grams: number
    fats_grams: number
  }
  created_at: string
  updated_at: string
}

/**
 * Fetches all nutrition entries from the "nutrition_entries" table.
 * Optionally filter by trainer_id
 */
export async function fetchNutritionEntries(trainerId?: string | null): Promise<NutritionEntry[]> {
  let query = supabase
    .from('nutrition_entries')
    .select('*')
    .order('entry_date', { ascending: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching nutrition entries:', error)
    throw error
  }

  return data || []
}

/**
 * Fetches nutrition entries for a specific client.
 * Optionally filter by trainer_id
 */
export async function fetchClientNutritionEntries(clientId: string, trainerId?: string | null): Promise<NutritionEntry[]> {
  let query = supabase
    .from('nutrition_entries')
    .select('*')
    .eq('client_id', clientId)
    .order('entry_date', { ascending: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching client nutrition entries:', error)
    throw error
  }

  return data || []
}

/**
 * Daily display totals: extra (typed) + macros from completed meal occurrences.
 */
export async function fetchClientNutritionDayTotals(
  clientId: string,
  trainerId?: string | null
): Promise<NutritionEntry[]> {
  const [extras, mealMacros] = await Promise.all([
    fetchClientNutritionEntries(clientId, trainerId),
    fetchCompletedMealMacrosByDate(clientId),
  ])
  return mergeNutritionDayTotals(extras, mealMacros, clientId)
}

