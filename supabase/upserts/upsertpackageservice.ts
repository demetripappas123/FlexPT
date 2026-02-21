import { supabase } from '../supabaseClient'
import { PackageService } from '../fetches/fetchpackageservices'

export interface PackageServiceFormData {
  id?: string
  package_id: string
  service_id: string
  units_per_obligation_cycle: number
  obligation_cycle_length_weeks: number
  unit_cost?: number | null
  is_included: boolean
}

/**
 * Create or update a package_service relationship
 */
export async function upsertPackageService(
  packageServiceData: PackageServiceFormData
): Promise<PackageService> {
  const data: any = {
    package_id: packageServiceData.package_id,
    service_id: packageServiceData.service_id,
    units_per_obligation_cycle: packageServiceData.units_per_obligation_cycle,
    obligation_cycle_length_weeks: packageServiceData.obligation_cycle_length_weeks,
    unit_cost: packageServiceData.unit_cost ?? null,
    is_included: packageServiceData.is_included,
  }

  if (packageServiceData.id) {
    // Update existing package_service
    const { data: updated, error } = await supabase
      .from('package_services')
      .update(data)
      .eq('id', packageServiceData.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating package_service:', error)
      throw error
    }

    return updated
  } else {
    // Create new package_service
    const { data: created, error } = await supabase
      .from('package_services')
      .insert([data])
      .select()
      .single()

    if (error) {
      console.error('Error creating package_service:', error)
      throw error
    }

    return created
  }
}

/**
 * Delete a package_service by ID
 */
export async function deletePackageService(packageServiceId: string): Promise<void> {
  const { error } = await supabase
    .from('package_services')
    .delete()
    .eq('id', packageServiceId)

  if (error) {
    console.error('Error deleting package_service:', error)
    throw error
  }
}

/**
 * Delete all package_services for a specific package
 */
export async function deletePackageServicesByPackageId(packageId: string): Promise<void> {
  const { error } = await supabase
    .from('package_services')
    .delete()
    .eq('package_id', packageId)

  if (error) {
    console.error('Error deleting package_services by package_id:', error)
    throw error
  }
}

/**
 * Delete all package_services for a specific service
 */
export async function deletePackageServicesByServiceId(serviceId: string): Promise<void> {
  const { error } = await supabase
    .from('package_services')
    .delete()
    .eq('service_id', serviceId)

  if (error) {
    console.error('Error deleting package_services by service_id:', error)
    throw error
  }
}

