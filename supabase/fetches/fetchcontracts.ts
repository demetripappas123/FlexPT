import { supabase } from '../supabaseClient'

export type ContractStatus = 'active' | 'frozen' | 'cancelled'

/**
 * contracts — instance of a package assigned to a person (billing metadata).
 */
export interface Contract {
  id: string
  name: string
  description: string | null
  bill_cycle_length_weeks: number | null
  cost_per_bill_cycle: number | null
  pif: boolean | null
  pif_cost: number | null
  until_cancelled: boolean | null
  start_date: string | null
  person_id: string | null
  trainer_id: string | null
  status: ContractStatus | null
  package_id: string | null
  renewal_date: string | null
  created_at?: string | null
  updated_at?: string | null
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
