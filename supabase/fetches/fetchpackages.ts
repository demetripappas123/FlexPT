import { supabase } from '../supabaseClient'

export interface Package {
  id: string // uuid
  name: string
  description: string | null
  cycle_length_weeks: number | null
  package_length_weeks: number
  default_cost_per_cycle: number | null
  is_active: boolean
  notes: string | null
  'until cancelled': boolean
  pif: boolean
  pif_cost: number | null
  created_at?: string
  updated_at?: string
}

/**
 * Fetch all packages
 */
export async function fetchPackages(): Promise<Package[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching packages:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch a single package by ID
 */
export async function fetchPackageById(packageId: string): Promise<Package | null> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching package:', error)
    throw error
  }

  return data
}

