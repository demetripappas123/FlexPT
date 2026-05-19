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

/**
 * Fetch all packages assigned to a client (packages that have at least one person_package row for this person).
 * Use this for the client payments page so the user can select from assigned packages when creating a payment.
 */
export async function fetchPackagesAssignedToClient(personId: string): Promise<Package[]> {
  const { data: ppRows, error: ppError } = await supabase
    .from('person_packages')
    .select('package_id')
    .eq('person_id', personId)

  if (ppError) {
    console.error('Error fetching person_packages for assigned packages:', ppError)
    throw ppError
  }

  const packageIds = [...new Set((ppRows ?? []).map((r) => r.package_id).filter(Boolean))]
  if (packageIds.length === 0) return []

  const { data: packagesData, error: pkgError } = await supabase
    .from('packages')
    .select('*')
    .in('id', packageIds)
    .order('name', { ascending: true })

  if (pkgError) {
    console.error('Error fetching packages by ids:', pkgError)
    throw pkgError
  }

  return packagesData ?? []
}

/** @deprecated Use fetchPackagesAssignedToClient */
export const fetchAvailablePackagesForPerson = fetchPackagesAssignedToClient

