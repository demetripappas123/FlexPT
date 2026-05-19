import { supabase } from '../supabaseClient'

export interface Payment {
  id: string
  person_package_id: string | null
  trainer_id: string | null
  amount: number
  payment_date: string
  method: string | null
  notes: string | null
}

function applyTrainerFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  trainerId?: string | null
): T {
  if (trainerId) {
    return query.eq('trainer_id', trainerId)
  }
  return query
}

/**
 * Fetch all payments, optionally filtered by trainer_id on the payments row.
 */
export async function fetchPayments(trainerId?: string | null): Promise<Payment[]> {
  let query = supabase.from('payments').select('*').order('payment_date', { ascending: false })
  query = applyTrainerFilter(query, trainerId)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching payments:', error)
    throw error
  }

  return data ?? []
}

/**
 * Sum payment amounts in a date range, optionally for one trainer.
 */
export async function sumPaymentsInDateRange(
  startDate: Date,
  endDate: Date,
  trainerId?: string | null
): Promise<number> {
  let query = supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', startDate.toISOString())
    .lte('payment_date', endDate.toISOString())

  query = applyTrainerFilter(query, trainerId)

  const { data, error } = await query

  if (error) {
    console.error('Error summing payments in date range:', error)
    throw error
  }

  if (!data?.length) return 0

  return data.reduce((sum, row) => {
    const amount = Number(row.amount) || 0
    return isNaN(amount) ? sum : sum + amount
  }, 0)
}

/**
 * Fetch payments for a specific person_package
 */
export async function fetchPaymentsByPersonPackage(personPackageId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('person_package_id', personPackageId)
    .order('payment_date', { ascending: false })

  if (error) {
    console.error('Error fetching payments by person_package:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch a single payment by ID
 */
export async function fetchPaymentById(paymentId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching payment:', error)
    throw error
  }

  return data
}

/**
 * Fetch payments for a specific person (via person_packages.person_id).
 */
export async function fetchPaymentsByPersonId(personId: string): Promise<Payment[]> {
  const { data: personPackages, error: ppError } = await supabase
    .from('person_packages')
    .select('id')
    .eq('person_id', personId)

  if (ppError) {
    console.error('Error fetching person_packages for payments:', ppError)
    throw ppError
  }

  if (!personPackages?.length) {
    return []
  }

  const personPackageIds = personPackages.map((pp) => pp.id)

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .in('person_package_id', personPackageIds)
    .order('payment_date', { ascending: false })

  if (error) {
    console.error('Error fetching payments by person:', error)
    throw error
  }

  return data ?? []
}
