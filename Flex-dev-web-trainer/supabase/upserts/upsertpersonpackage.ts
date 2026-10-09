import { supabase } from '../supabaseClient'

/**
 * person_packages: consumable entitlements tied to payment / timeframe / contract.
 */
export interface PersonPackageFormData {
  id?: string
  person_id?: string | null
  package_id: string
  service_id: string
  unit_cost?: number | null
  is_included?: boolean | null
  units_per_obligation_cycle?: number | null
  obligation_cycle_length_weeks?: number | null
  trainer_id?: string | null
  payment_date?: string | null
  status?: string | null
  payment_id?: string | null
  next_payment_date?: string | null
  contract_id?: string | null
}

function toDateOnly(s: string | null | undefined): string | null {
  if (s == null || s === '') return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toISOString().split('T')[0]
}

/**
 * Create or update a single person_package row.
 */
export async function upsertPersonPackage(
  personPackage: PersonPackageFormData
): Promise<unknown> {
  const now = new Date().toISOString()
  const data: Record<string, unknown> = {
    package_id: personPackage.package_id,
    service_id: personPackage.service_id,
    unit_cost: personPackage.unit_cost ?? 0,
    is_included: personPackage.is_included ?? null,
    units_per_obligation_cycle: personPackage.units_per_obligation_cycle ?? null,
    obligation_cycle_length_weeks: personPackage.obligation_cycle_length_weeks ?? null,
    person_id: personPackage.person_id ?? null,
    trainer_id: personPackage.trainer_id ?? null,
    payment_date: toDateOnly(personPackage.payment_date),
    status: personPackage.status ?? 'pending',
    payment_id: personPackage.payment_id ?? null,
    next_payment_date: toDateOnly(personPackage.next_payment_date),
    contract_id: personPackage.contract_id ?? null,
    updated_at: now,
  }

  if (personPackage.id) {
    const { data: updated, error } = await supabase
      .from('person_packages')
      .update(data)
      .eq('id', personPackage.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating person_package:', error)
      throw error
    }

    return updated
  }

  const insertData = { ...data, created_at: now }
  const { data: created, error } = await supabase
    .from('person_packages')
    .insert([insertData])
    .select()
    .single()

  if (error) {
    console.error('Error creating person_package:', error)
    throw error
  }

  return created
}
