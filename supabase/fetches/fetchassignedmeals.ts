'use client'

import { supabase } from '@/supabase/supabaseClient'
import { fetchMealsOccurancesFoods, MealsOccurancesFood } from './fetchmealsoccurancesfoods'

export type AssignedMealStatus = 'pending' | 'completed' | 'skipped'

export type AssignedMealFood = MealsOccurancesFood

export type AssignedMeal = {
  id: string // uuid
  person_id: string // uuid, references people.id
  meal_id: string | null // uuid, references day_meals.id or meals_templates.id (nullable for on-the-spot meals)
  assigned_date: string // date
  status: AssignedMealStatus
  created_at: string
  updated_at: string
  name: string // NOT NULL - meal name (from source or on-the-spot)
  trainer_id: string | null // uuid
  meal_name?: string | null // Computed: name from source meal if meal_id exists, otherwise use name field
  foods?: AssignedMealFood[] // Foods from meals_occurances_foods
}

export async function fetchAssignedMeals(personId: string): Promise<AssignedMeal[]> {
  try {
    const { data, error } = await supabase
      .from('meals_occurances')
      .select('*')
      .eq('person_id', personId)
      .order('assigned_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching assigned meals:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return []
    }

    if (!data || data.length === 0) return []

    // Fetch meal names from source tables (day_meals and meals_templates)
    const mealIds = [...new Set(data.map(am => am.meal_id))]
    const mealNamesMap = new Map<string, string | null>()
    
    // Try to fetch from day_meals first
    const { data: dayMealsData } = await supabase
      .from('day_meals')
      .select('id, name')
      .in('id', mealIds)
    
    if (dayMealsData) {
      dayMealsData.forEach(meal => {
        mealNamesMap.set(meal.id, meal.name)
      })
    }
    
    // Fetch remaining meal IDs from meals_templates
    const remainingIds = mealIds.filter(id => !mealNamesMap.has(id))
    if (remainingIds.length > 0) {
      const { data: templateMealsData } = await supabase
        .from('meals_templates')
        .select('id, name')
        .in('id', remainingIds)
      
      if (templateMealsData) {
        templateMealsData.forEach(meal => {
          mealNamesMap.set(meal.id, meal.name)
        })
      }
    }

    // Fetch foods for all meal occurrences (using meals_occurances.id, not meal_id)
    const occurrenceIds = data.map(am => am.id)
    const occurrenceFoods = await fetchMealsOccurancesFoods(occurrenceIds)
    const foodsByOccurrenceId = new Map<string, AssignedMealFood[]>()
    occurrenceFoods.forEach(food => {
      if (!foodsByOccurrenceId.has(food.meal_id)) {
        foodsByOccurrenceId.set(food.meal_id, [])
      }
      foodsByOccurrenceId.get(food.meal_id)!.push(food)
    })

    // Combine assigned meals with their foods and meal names
    return data.map(am => ({
      ...am,
      meal_name: am.meal_id ? (mealNamesMap.get(am.meal_id) || null) : am.name, // Use name field if no meal_id
      foods: foodsByOccurrenceId.get(am.id) || [],
    })) as AssignedMeal[]
  } catch (err) {
    console.error('Error fetching assigned meals:', err)
    return []
  }
}

