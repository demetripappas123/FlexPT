import { supabase } from '@/supabase/supabaseClient'
import { NutritionEntry } from '@/supabase/fetches/fetchnutrition'

function extraFields(entry: Omit<NutritionEntry, 'id' | 'created_at' | 'updated_at'>) {
  const extraCalories = entry.extra_calories ?? entry.calories ?? null
  const extraProtein = entry.extra_protein_grams ?? entry.protein_grams ?? null
  const extraCarbs = entry.extra_carbs_grams ?? entry.carbs_grams ?? null
  const extraFats = entry.extra_fats_grams ?? entry.fats_grams ?? null
  return {
    extra_calories: extraCalories,
    extra_protein_grams: extraProtein,
    extra_carbs_grams: extraCarbs,
    extra_fats_grams: extraFats,
    calories: extraCalories,
    protein_grams: extraProtein,
    carbs_grams: extraCarbs,
    fats_grams: extraFats,
  }
}

function dateKey(value: string | null | undefined): string {
  return (value || '').slice(0, 10)
}

/**
 * Inserts nutrition entries for a client (for new entries).
 */
export async function upsertNutritionEntries(
  entries: Omit<NutritionEntry, 'id' | 'created_at' | 'updated_at'>[]
): Promise<NutritionEntry[] | null> {
  if (!entries.length) return null

  try {
    const formattedEntries = entries.map(entry => ({
      client_id: entry.client_id,
      entry_date: dateKey(entry.entry_date),
      ...extraFields(entry),
    }))

    const { data, error } = await supabase
      .from('nutrition_entries')
      .insert(formattedEntries)
      .select('*')

    if (error) {
      console.error('upsertNutritionEntries error:', error)
      throw error
    }
    return data as NutritionEntry[]
  } catch (err) {
    console.error('upsertNutritionEntries error:', err)
    return null
  }
}

/**
 * Intelligently updates nutrition entries for a client by:
 * 1. Fetching existing entries
 * 2. Updating existing entries that match by entry_date
 * 3. Inserting new entries that don't exist
 * 4. Deleting entries that were removed from the list
 */
export async function updateNutritionEntries(
  clientId: string,
  entries: Omit<NutritionEntry, 'id' | 'created_at' | 'updated_at'>[]
): Promise<NutritionEntry[] | null> {
  try {
    // Fetch all existing entries for this client
    const { data: existingEntries, error: fetchError } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('client_id', clientId)

    if (fetchError) {
      console.error('updateNutritionEntries fetch error:', fetchError)
      throw fetchError
    }

    // Create a map of existing entries by entry_date for quick lookup
    const existingMap = new Map<string, any>()
    existingEntries?.forEach(entry => {
      existingMap.set(dateKey(entry.entry_date), entry)
    })

    const newEntryDates = new Set(entries.map(e => dateKey(e.entry_date)))
    const monthsTouched = new Set([...newEntryDates].map((d) => d.slice(0, 7)))

    const toUpdate: any[] = []
    const toInsert: any[] = []

    entries.forEach(entry => {
      const formatted = {
        client_id: entry.client_id,
        entry_date: dateKey(entry.entry_date),
        ...extraFields(entry),
      }

      const existing = existingMap.get(formatted.entry_date)
      if (existing) {
        toUpdate.push(formatted)
      } else {
        toInsert.push(formatted)
      }
    })

    const toDelete: string[] = []
    existingEntries?.forEach(entry => {
      const d = dateKey(entry.entry_date)
      if (monthsTouched.has(d.slice(0, 7)) && !newEntryDates.has(d)) {
        toDelete.push(d)
      }
    })

    // Perform updates, inserts, and deletes in parallel
    const promises: (Promise<any> | PromiseLike<any>)[] = []

    // Update existing entries one by one
    toUpdate.forEach(entry => {
      promises.push(
        supabase
          .from('nutrition_entries')
          .update({
            extra_calories: entry.extra_calories,
            extra_protein_grams: entry.extra_protein_grams,
            extra_carbs_grams: entry.extra_carbs_grams,
            extra_fats_grams: entry.extra_fats_grams,
            calories: entry.calories,
            protein_grams: entry.protein_grams,
            carbs_grams: entry.carbs_grams,
            fats_grams: entry.fats_grams,
          })
          .eq('client_id', clientId)
          .eq('entry_date', entry.entry_date)
          .select()
          .then(result => {
            if (result.error) throw result.error
            return result
          })
      )
    })

    // Insert new entries
    if (toInsert.length > 0) {
      promises.push(
        supabase
          .from('nutrition_entries')
          .insert(toInsert)
          .select()
          .then(result => {
            if (result.error) throw result.error
            return result
          })
      )
    }

    // Delete removed entries
    if (toDelete.length > 0) {
      promises.push(
        supabase
          .from('nutrition_entries')
          .delete()
          .eq('client_id', clientId)
          .in('entry_date', toDelete)
          .then(result => {
            if (result.error) throw result.error
            return { data: [], error: null }
          })
      )
    }

    const results = await Promise.all(promises)

    // Check for errors
    for (const result of results) {
      if (result?.error) {
        console.error('updateNutritionEntries operation error:', result.error)
        throw result.error
      }
    }

    // Fetch and return the updated entries
    const { data: updatedEntries, error: finalFetchError } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('client_id', clientId)
      .order('entry_date', { ascending: false })

    if (finalFetchError) {
      console.error('updateNutritionEntries final fetch error:', finalFetchError)
      throw finalFetchError
    }

    return updatedEntries as NutritionEntry[]
  } catch (err) {
    console.error('updateNutritionEntries error:', err)
    return null
  }
}

