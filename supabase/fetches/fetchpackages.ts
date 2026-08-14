import { supabase } from '../supabaseClient'

/**
 * packages — blueprint/template for contracts that can be assigned to clients.
 */
export interface Package {
  id: string
  name: string | null
  description: string | null
  pif: boolean | null
  pif_cost: number | null
  start_date: string | null
  person_id: string | null
  trainer_id: string | null
  renewal_date: string | null
  bill_cycle_length_weeks: number | null
  until_cancelled: boolean | null
  created_at?: string | null
  updated_at?: string | null
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
