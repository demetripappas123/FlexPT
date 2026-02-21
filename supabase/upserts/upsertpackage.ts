import { supabase } from '../supabaseClient'
import { Package } from '../fetches/fetchpackages'

export interface PackageFormData {
  id?: string
  name: string
  description?: string | null
  cycle_length_weeks: number | null
  package_length_weeks: number
  default_cost_per_cycle: number | null
  is_active?: boolean
  notes?: string | null
  'until cancelled'?: boolean
  pif?: boolean
  pif_cost?: number | null
}

/**
 * Create or update a package
 */
export async function upsertPackage(packageData: PackageFormData): Promise<Package> {
  const data: any = {
    name: packageData.name,
    description: packageData.description ?? null,
    cycle_length_weeks: packageData.cycle_length_weeks ?? null,
    package_length_weeks: packageData.package_length_weeks,
    default_cost_per_cycle: packageData.default_cost_per_cycle ?? null,
    is_active: packageData.is_active ?? true,
    notes: packageData.notes ?? null,
    'until cancelled': packageData['until cancelled'] ?? false,
    pif: packageData.pif ?? false,
    pif_cost: packageData.pif_cost ?? null,
  }

  if (packageData.id) {
    // Update existing package
    const { data: updatedPackage, error } = await supabase
      .from('packages')
      .update(data)
      .eq('id', packageData.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating package:', error)
      throw error
    }

    return updatedPackage
  } else {
    // Create new package
    const { data: newPackage, error } = await supabase
      .from('packages')
      .insert([data])
      .select()
      .single()

    if (error) {
      console.error('Error creating package:', error)
      throw error
    }

    return newPackage
  }
}





