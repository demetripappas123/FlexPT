import { supabase } from '../supabaseClient'

/**
 * person_packages: consumable service entitlements tied to a payment / timeframe.
 * Columns: id, package_id, service_id, unit_cost, created_at, updated_at,
 * is_included, units_per_obligation_cycle, obligation_cycle_length_weeks,
 * person_id, trainer_id, payment_date, status, payment_id, next_payment_date, contract_id.
 */
export interface PersonPackage {
  id: string
  package_id: string
  service_id: string
  unit_cost: number | null
  is_included: boolean | null
  units_per_obligation_cycle: number | null
  obligation_cycle_length_weeks: number | null
  person_id: string | null
  trainer_id: string | null
  payment_date: string | null
  status: string | null
  payment_id: string | null
  next_payment_date: string | null
  contract_id: string | null
  created_at?: string | null
  updated_at?: string | null
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
