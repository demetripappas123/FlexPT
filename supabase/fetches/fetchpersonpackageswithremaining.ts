import { fetchPersonPackagesByPersonId, PersonPackage } from './fetchpersonpackages'

export interface PersonPackageWithRemaining extends PersonPackage {
  remaining_units: number
}

/**
 * Fetch person_packages for a person that are active and have remaining sessions (used_units < total_units)
 * Optionally filter by trainer_id
 * DISABLED: person_packages table has been removed for architecture rework
 */
export async function fetchPersonPackagesWithRemaining(personId: string, trainerId?: string | null): Promise<PersonPackageWithRemaining[]> {
  // DISABLED: person_packages table removed - returning empty array
  console.warn('fetchPersonPackagesWithRemaining is disabled - person_packages table has been removed for architecture rework')
  return []
  
  /* ORIGINAL CODE - KEPT FOR REFERENCE
  // Fetch all person_packages for this specific person
  // Note: fetchPersonPackagesByPersonId doesn't filter by trainer_id, 
  // so we filter client-side if trainerId is provided
  const personPackages = await fetchPersonPackagesByPersonId(personId)
  
  // Filter by trainer_id if provided
  const filteredPackages = trainerId 
    ? personPackages.filter(pp => (pp as any).trainer_id === trainerId)
    : personPackages
  
  // Filter to only include packages that are:
  // 1. Active status
  // 2. Have remaining sessions (used_units < total_units)
  const activeWithRemaining = filteredPackages.filter(pp => {
    const isActive = pp.status === 'active'
    const hasRemaining = pp.used_units < pp.total_units
    return isActive && hasRemaining
  })
  
  // Calculate remaining units for each package
  return activeWithRemaining.map(pp => ({
    ...pp,
    remaining_units: pp.total_units - pp.used_units,
  }))
  */
}

