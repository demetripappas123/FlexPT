import { supabase } from '../supabaseClient'
import { Package } from '../fetches/fetchpackages'

export interface PackageFormData {
  id?: string
  name: string
  description?: string | null
  pif?: boolean | null
  pif_cost?: number | null
  start_date?: string | null
  person_id?: string | null
  trainer_id?: string | null
  renewal_date?: string | null
  bill_cycle_length_weeks?: number | null
  until_cancelled?: boolean | null
}

/**
 * Create or update a package
 */
export async function upsertPackage(packageData: PackageFormData): Promise<Package> {
  const data: Record<string, unknown> = {
    name: packageData.name,
    description: packageData.description ?? null,
    pif: packageData.pif ?? false,
    pif_cost: packageData.pif_cost ?? null,
    start_date: packageData.start_date ?? null,
    person_id: packageData.person_id ?? null,
    trainer_id: packageData.trainer_id ?? null,
    renewal_date: packageData.renewal_date ?? null,
    bill_cycle_length_weeks: packageData.bill_cycle_length_weeks ?? null,
    until_cancelled: packageData.until_cancelled ?? false,
  }

  if (packageData.id) {
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
  }

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
