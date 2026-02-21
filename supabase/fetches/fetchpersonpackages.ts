import { supabase } from '../supabaseClient'

/**
 * person_packages: one row per (person, package, service) per obligation cycle.
 * Columns: id, package_id, service_id, unit_cost, created_at, updated_at,
 * is_included, units_per_obligation_cycle, obligation_cycle_length_weeks,
 * person_id, trainer_id, start_date, end_date, status (enum, default 'pending').
 */
export interface PersonPackage {
  id: string
  person_id: string
  package_id: string
  service_id: string
  unit_cost: number | null
  is_included: boolean
  units_per_obligation_cycle: number
  obligation_cycle_length_weeks: number
  trainer_id: string | null
  start_date: string
  end_date: string
  status: string
  created_at?: string
  updated_at?: string
}

/**
 * Fetch all person_packages.
 * Pass trainerId only if your person_packages table has a trainer_id column.
 */
export async function fetchPersonPackages(trainerId?: string | null): Promise<PersonPackage[]> {
  let query = supabase
    .from('person_packages')
    .select('*')
    .order('created_at', { ascending: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching person_packages:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch person_packages for a specific person
 */
export async function fetchPersonPackagesByPersonId(personId: string): Promise<PersonPackage[]> {
  const { data, error } = await supabase
    .from('person_packages')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching person_packages by person:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch a single person_package by ID
 */
export async function fetchPersonPackageById(personPackageId: string): Promise<PersonPackage | null> {
  const { data, error } = await supabase
    .from('person_packages')
    .select('*')
    .eq('id', personPackageId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching person_package:', error)
    throw error
  }

  return data
}





