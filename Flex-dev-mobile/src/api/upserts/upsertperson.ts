import { supabase } from '../supabase'

export interface PersonFormData {
  id?: string
  name: string
  number?: string
  notes?: string
  lead_source?: string | null
  trainer_id?: string | null
  program_id?: string | null
  package_id?: string | null
  created_at?: string
  converted_at?: string | null
  email?: string | null
  username?: string | null
}

// Re-export types for backward compatibility
export interface ClientFormData extends PersonFormData {}
export interface ProspectFormData extends PersonFormData {}

/**
 * Upserts a person into the "people" table.
 * Fills in defaults for any missing fields.
 * Uses id only if updating; lets DB generate it for new inserts.
 */
export async function upsertPerson(person: Partial<PersonFormData>, options?: {
  asClient?: boolean // if true, sets converted_at to current time; if false, sets to null; if undefined, preserves existing
  trainerId?: string | null // trainer_id to associate with the person
}): Promise<any> {
  const isNewPerson = !person.id
  const fullPerson: any = {
    name: person.name ?? 'Unnamed Person',
    number: person.number ?? '',
    notes: person.notes ?? '',
    program_id: person.program_id ?? null,
    package_id: person.package_id ?? null,
    created_at: person.created_at ?? new Date().toISOString(),
    ...(person.id ? { id: person.id } : {}), // include id only if it exists
  }

  // Include trainer_id: use from person data, options, or keep existing if updating
  if (person.trainer_id !== undefined) {
    fullPerson.trainer_id = person.trainer_id
  } else if (options?.trainerId !== undefined) {
    fullPerson.trainer_id = options.trainerId
  } else if (isNewPerson && options?.trainerId === undefined && person.trainer_id === undefined) {
    // For new persons, if no trainer_id is provided, set to null
    fullPerson.trainer_id = null
  }
  // If updating existing person and trainer_id not provided, don't include it (preserve existing)

  // Include lead_source if provided (must match ENUM values exactly: 'instagram reel', 'instagram dms', etc.)
  if (person.lead_source !== undefined && person.lead_source !== null && person.lead_source.trim() !== '') {
    fullPerson.lead_source = person.lead_source.trim()
  }

  // Contact/login fields. Password is never stored on people — Auth owns it.
  if (person.email !== undefined) {
    const email = person.email?.trim().toLowerCase() || null
    fullPerson.email = email
  }
  if (person.username !== undefined) {
    const username = person.username?.trim() || null
    fullPerson.username = username
  }

  // Handle converted_at based on options
  if (options?.asClient === true) {
    // Set as client (converted_at = current time)
    fullPerson.converted_at = person.converted_at ?? new Date().toISOString()
  } else if (options?.asClient === false) {
    // Set as prospect (converted_at = null)
    fullPerson.converted_at = null
  } else {
    // Preserve existing or use provided value
    if (isNewPerson) {
      // For new persons, default to prospect (null) unless explicitly provided
      fullPerson.converted_at = person.converted_at ?? null
    } else if (person.converted_at !== undefined) {
      // Only update if explicitly provided
      fullPerson.converted_at = person.converted_at
    }
  }

  const { data, error } = await supabase
    .from('people')
    .upsert([fullPerson], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('Error upserting person:', error)
    throw error
  }

  return data
}

/**
 * Upserts a client into the "people" table.
 * Sets converted_at to current time when creating a new client.
 */
export async function upsertClient(client: Partial<ClientFormData>, trainerId?: string | null) {
  return upsertPerson(client, { asClient: true, trainerId })
}

/**
 * Upserts a prospect into the "people" table.
 * Leaves converted_at as null to indicate it's a prospect.
 */
export async function upsertProspect(prospect: Partial<ProspectFormData>, trainerId?: string | null) {
  return upsertPerson(prospect, { asClient: false, trainerId })
}


