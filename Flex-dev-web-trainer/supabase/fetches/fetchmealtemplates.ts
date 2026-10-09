'use client'

import { supabase } from '@/supabase/supabaseClient'
import { fetchMealsTemplatesFoods, MealsTemplatesFood } from './fetchmealstemplatesfoods'

export type MealTemplate = {
  id: string // uuid
  name: string | null
  trainer_id: string | null
  created_at: string
  updated_at: string
  foods: MealsTemplatesFood[] // Foods from meals_templates_foods
}

/**
 * Fetch meal templates for the current trainer
 * Meal templates are stored in the meals_templates table
 */
export async function fetchMealTemplates(trainerId: string | null): Promise<MealTemplate[]> {
  try {
    if (!trainerId) return []

    // Fetch meal templates from the meals_templates table
    const { data, error } = await supabase
      .from('meals_templates')
      .select('*')
      .eq('trainer_id', trainerId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching meal templates:', error)
      return []
    }

    if (!data || data.length === 0) return []

    // Fetch foods for all templates (from meals_templates_foods)
    const mealIds = data.map(meal => meal.id)
    const mealFoods = await fetchMealsTemplatesFoods(mealIds)
    const foodsByMealId = new Map<string, MealsTemplatesFood[]>()
    mealFoods.forEach(food => {
      if (!foodsByMealId.has(food.meal_id)) {
        foodsByMealId.set(food.meal_id, [])
      }
      foodsByMealId.get(food.meal_id)!.push(food)
    })

    // Map to MealTemplate format
    return data.map(meal => ({
      id: meal.id,
      name: meal.name,
      trainer_id: trainerId,
      created_at: meal.created_at,
      updated_at: meal.updated_at,
      foods: foodsByMealId.get(meal.id) || [],
    })) as MealTemplate[]
  } catch (err) {
    console.error('Error fetching meal templates:', err)
    return []
  }
}

