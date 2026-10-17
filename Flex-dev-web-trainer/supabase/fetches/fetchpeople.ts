import { supabase } from '../supabaseClient'

export type PersonOnboardingStatus = 'not_started' | 'in_progress' | 'complete'

export interface Person {
  id: string
  name: string
  number: string
  program_id?: string | null
  package_id?: string | null
  created_at: string
  converted_at: string | null
  onboarding_status?: PersonOnboardingStatus | null
  notes?: string | null
  lead_source?: string | null
  trainer_id?: string | null
  email?: string | null
  username?: string | null
  auth_user_id?: string | null
  stripe_customer_id?: string | null
  avatar_path?: string | null
  lead_bucket?: 'hot' | 'cold' | null
}

export function personIsInOnboarding(status: PersonOnboardingStatus | null | undefined): boolean {
  return status === 'not_started' || status === 'in_progress'
}

// Re-export types for backward compatibility
export type Client = Person
export type Prospect = Person

/**
 * Fetches all people from the "people" table.
 * Optionally filter by converted_at status and trainer_id.
 */
export async function fetchPeople(options?: {
  isClient?: boolean // if true, only clients; if false, only prospects; if undefined, all
  trainerId?: string | null // filter by trainer_id
}): Promise<Person[]> {
  let query = supabase
    .from('people')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.trainerId) {
    query = query.eq('trainer_id', options.trainerId)
  }

  if (options?.isClient === true) {
    query = query.not('converted_at', 'is', null)
  } else if (options?.isClient === false) {
    query = query.is('converted_at', null)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching people:', error)
    throw error
  }

  // Additional client-side filter as backup
  if (options?.isClient === true) {
    return (data || []).filter((person: any) => 
      person.converted_at !== null && person.converted_at !== undefined
    ) as Person[]
  } else if (options?.isClient === false) {
    return (data || []).filter((person: any) => 
      person.converted_at === null || person.converted_at === undefined
    ) as Person[]
  }

  return data || []
}

/**
 * Fetches all clients from the "people" table where converted_at is not null.
 */
export async function fetchClients(trainerId?: string | null): Promise<Client[]> {
  return fetchPeople({ isClient: true, trainerId })
}

/**
 * Fetches all prospects from the "people" table where converted_at is null.
 */
export async function fetchProspects(trainerId?: string | null): Promise<Prospect[]> {
  return fetchPeople({ isClient: false, trainerId })
}

/**
 * Fetches a single person by ID.
 */
export async function fetchPersonById(personId: string): Promise<Person | null> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('id', personId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching person:', error)
    throw error
  }

  return data
}


