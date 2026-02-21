import { supabase } from '../supabaseClient'

/**
 * person_packages table: one row per (person, package, service) per obligation cycle.
 * Columns: id, package_id, service_id, unit_cost, created_at, updated_at,
 * is_included, units_per_obligation_cycle, obligation_cycle_length_weeks,
 * person_id, trainer_id, start_date, end_date, status (enum, default 'pending').
 */
export interface PersonPackageFormData {
  id?: string
  person_id: string
  package_id: string
  service_id: string
  unit_cost?: number | null
  is_included?: boolean
  units_per_obligation_cycle: number
  obligation_cycle_length_weeks: number
  trainer_id?: string | null
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  status?: string
}

function toDateOnly(s: string): string {
  if (!s) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toISOString().split('T')[0]
}

/**
 * Create or update a single person_package row (one obligation cycle for one service).
 */
export async function upsertPersonPackage(
  personPackage: PersonPackageFormData
): Promise<unknown> {
  const now = new Date().toISOString()
  const data: Record<string, unknown> = {
    person_id: personPackage.person_id,
    package_id: personPackage.package_id,
    service_id: personPackage.service_id,
    unit_cost: personPackage.unit_cost ?? null,
    is_included: personPackage.is_included ?? true,
    units_per_obligation_cycle: personPackage.units_per_obligation_cycle,
    obligation_cycle_length_weeks: personPackage.obligation_cycle_length_weeks,
    trainer_id: personPackage.trainer_id ?? null,
    start_date: toDateOnly(personPackage.start_date),
    end_date: toDateOnly(personPackage.end_date),
    status: personPackage.status ?? 'pending',
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
  } else {
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
}
