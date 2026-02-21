import { supabase } from '../supabaseClient'

/**
 * contracts table: package-like columns + person_id, trainer_id, start_date.
 * Columns: id, name, description, cycle_length_weeks, package_length_weeks,
 * default_cost_per_cycle, is_active, notes, pif, pif_cost, until cancelled,
 * start_date, person_id, trainer_id, created_at, updated_at.
 */
export interface Contract {
  id: string
  person_id: string
  trainer_id: string | null
  start_date: string | null
  name: string
  description: string | null
  cycle_length_weeks: number | null
  package_length_weeks: number
  default_cost_per_cycle: number | null
  is_active: boolean
  notes: string | null
  pif: boolean
  pif_cost: number | null
  'until cancelled': boolean
  created_at?: string
  updated_at?: string
}

/**
 * Fetch all contracts, optionally filter by trainer_id
 */
export async function fetchContracts(trainerId?: string | null): Promise<Contract[]> {
  let query = supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false })

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching contracts:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch a single contract by ID
 */
export async function fetchContractById(contractId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching contract:', error)
    throw error
  }

  return data
}

/**
 * Fetch contracts for a specific person
 */
export async function fetchContractsByPersonId(personId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contracts by person ID:', error)
    throw error
  }

  return data ?? []
}

