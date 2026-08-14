import { supabase } from '../supabaseClient'
import { Contract, ContractStatus } from '../fetches/fetchcontracts'
import { Package } from '../fetches/fetchpackages'

/**
 * contracts table schema (public.contracts).
 */
export type ContractFormData =
  | {
      id: string
      person_id: string | null
      trainer_id: string | null
      start_date: string | null
      status?: ContractStatus | null
      package_id?: string | null
      name: string
      description: string | null
      bill_cycle_length_weeks: number | null
      cost_per_bill_cycle: number | null
      pif: boolean | null
      pif_cost: number | null
      until_cancelled: boolean | null
      renewal_date?: string | null
    }
  | {
      person_id: string
      trainer_id: string | null
      start_date: string
      package: Package
      /** Recurring cost lives on contracts, not packages — pass explicitly when creating. */
      cost_per_bill_cycle?: number | null
      renewal_date?: string | null
    }

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
      status: contractData.status ?? 'active',
      package_id: contractData.package_id ?? null,
      name: contractData.name,
      description: contractData.description ?? null,
      bill_cycle_length_weeks: contractData.bill_cycle_length_weeks ?? null,
      cost_per_bill_cycle: contractData.cost_per_bill_cycle ?? null,
      pif: contractData.pif ?? false,
      pif_cost: contractData.pif_cost ?? null,
      until_cancelled: contractData.until_cancelled ?? false,
      renewal_date: toDateOnly(contractData.renewal_date),
    }
  } else if ('package' in contractData && contractData.package) {
    const pkg = contractData.package
    data = {
      person_id: contractData.person_id,
      trainer_id: contractData.trainer_id ?? null,
      start_date: toDateOnly(contractData.start_date),
      status: 'active',
      package_id: pkg.id,
      name: pkg.name ?? '',
      description: pkg.description ?? null,
      bill_cycle_length_weeks: pkg.bill_cycle_length_weeks ?? null,
      cost_per_bill_cycle: contractData.cost_per_bill_cycle ?? null,
      pif: pkg.pif ?? false,
      pif_cost: pkg.pif_cost ?? null,
      until_cancelled: pkg.until_cancelled ?? false,
      renewal_date: toDateOnly(contractData.renewal_date ?? pkg.renewal_date),
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
  }

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
