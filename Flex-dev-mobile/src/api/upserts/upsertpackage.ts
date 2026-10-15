import { supabase } from '../supabase'
import { Package } from '../fetches/fetchpackages'

/**
 * Package template row. Billing defaults only — no person/start/renewal.
 */
export interface PackageFormData {
  id?: string
  name: string
  description?: string | null
  pif?: boolean | null
  pif_cost?: number | null
  cost_per_bill_cycle?: number | null
  package_length_weeks?: number | null
  trainer_id?: string | null
  bill_cycle_length_weeks?: number | null
  until_cancelled?: boolean | null
}

function toNumericOrNull(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

function toIntegerOrNull(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

function toPackageRow(packageData: PackageFormData): Record<string, unknown> {
  const isPif = packageData.pif ?? false
  return {
    name: packageData.name,
    description: packageData.description ?? null,
    pif: isPif,
    pif_cost: isPif ? toIntegerOrNull(packageData.pif_cost) : null,
    cost_per_bill_cycle: isPif ? null : toNumericOrNull(packageData.cost_per_bill_cycle),
    package_length_weeks: packageData.until_cancelled
      ? null
      : toIntegerOrNull(packageData.package_length_weeks),
    trainer_id: packageData.trainer_id ?? null,
    bill_cycle_length_weeks: isPif ? null : toIntegerOrNull(packageData.bill_cycle_length_weeks),
    until_cancelled: isPif ? false : (packageData.until_cancelled ?? false),
  }
}

/**
 * Create or update a package template.
 */
export async function upsertPackage(packageData: PackageFormData): Promise<Package> {
  const data = toPackageRow(packageData)

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
