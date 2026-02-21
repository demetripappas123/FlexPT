import { supabase } from '../supabaseClient'
import { Contract } from '../fetches/fetchcontracts'
import { Package } from '../fetches/fetchpackages'

/**
 * contracts table schema: package-like columns + person_id, trainer_id, start_date.
 * Columns: id, name, description, cycle_length_weeks, package_length_weeks,
 * default_cost_per_cycle, is_active, notes, pif, pif_cost, until cancelled,
 * start_date, person_id, trainer_id, created_at, updated_at.
 */
export type ContractFormData =
  | { id: string; person_id: string; trainer_id: string | null; start_date: string | null; name: string; description: string | null; cycle_length_weeks: number | null; package_length_weeks: number; default_cost_per_cycle: number | null; is_active: boolean; notes: string | null; pif: boolean; pif_cost: number | null; 'until cancelled': boolean }
  | { person_id: string; trainer_id: string | null; start_date: string; package: Package }

/** Normalize to date-only YYYY-MM-DD */
function toDateOnly(isoOrDate: string | null | undefined): string | null {
  if (isoOrDate == null || isoOrDate === '') return null
  const d = new Date(isoOrDate)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

/**
 * Create or update a contract.
 * For create: pass { person_id, trainer_id, start_date, package } to copy package fields into the contract.
 * For update: pass { id, ...contractFields }.
 */
export async function upsertContract(contractData: ContractFormData): Promise<Contract> {
  let data: Record<string, unknown>

  if ('id' in contractData && contractData.id) {
    data = {
      person_id: contractData.person_id,
      trainer_id: contractData.trainer_id ?? null,
      start_date: toDateOnly(contractData.start_date),
      name: contractData.name,
      description: contractData.description ?? null,
      cycle_length_weeks: contractData.cycle_length_weeks ?? null,
      package_length_weeks: contractData.package_length_weeks,
      default_cost_per_cycle: contractData.default_cost_per_cycle ?? null,
      is_active: contractData.is_active ?? true,
      notes: contractData.notes ?? null,
      pif: contractData.pif ?? false,
      pif_cost: contractData.pif_cost ?? null,
      'until cancelled': contractData['until cancelled'] ?? false,
    }
  } else if ('package' in contractData && contractData.package) {
    const pkg = contractData.package
    data = {
      person_id: contractData.person_id,
      trainer_id: contractData.trainer_id ?? null,
      start_date: toDateOnly(contractData.start_date),
      name: pkg.name,
      description: pkg.description ?? null,
      cycle_length_weeks: pkg.cycle_length_weeks ?? null,
      package_length_weeks: pkg.package_length_weeks,
      default_cost_per_cycle: pkg.default_cost_per_cycle ?? null,
      is_active: pkg.is_active ?? true,
      notes: pkg.notes ?? null,
      pif: pkg.pif ?? false,
      pif_cost: pkg.pif_cost ?? null,
      'until cancelled': pkg['until cancelled'] ?? false,
    }
  } else {
    throw new Error('Contract form data must include either id (for update) or package (for create)')
  }

  if ('id' in contractData && contractData.id) {
    const { data: updatedContract, error } = await supabase
      .from('contracts')
      .update(data)
      .eq('id', contractData.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating contract:', error)
      console.error('Payload sent:', JSON.stringify(data, null, 2))
      throw error
    }

    return updatedContract
  } else {
    const { data: newContract, error } = await supabase
      .from('contracts')
      .insert([data])
      .select()
      .single()

    if (error) {
      console.error('Error creating contract:', error)
      console.error('Payload sent:', JSON.stringify(data, null, 2))
      throw error
    }

    return newContract
  }
}
