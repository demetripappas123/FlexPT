import { supabase } from '@/supabase/supabaseClient'

export type PrivateAlphaListFormData = {
  firstname: string
  lastname: string
  email: string
  phone?: string | null
  business?: string | null
  notes?: string | null
  receivems?: boolean
}

export async function insertPrivateAlphaListEntry(
  entry: PrivateAlphaListFormData
): Promise<void> {
  const { error } = await supabase.from('privalphalist').insert([
    {
      firstname: entry.firstname.trim(),
      lastname: entry.lastname.trim(),
      email: entry.email.trim().toLowerCase(),
      phone: entry.phone?.trim() || null,
      business: entry.business?.trim() || null,
      notes: entry.notes?.trim() || null,
      recievemsg: entry.receivems ?? false,
    },
  ])

  if (error) {
    console.error('Error inserting private alpha list entry:', error)
    throw error
  }
}

export function getPrivateAlphaListErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Something went wrong. Please try again.'
  }

  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  const lowerMessage = message.toLowerCase()

  if (code === '23505') {
    if (lowerMessage.includes('email')) {
      return 'That email is already on the list.'
    }
    if (lowerMessage.includes('phone')) {
      return 'That phone number is already on the list.'
    }
    return 'You may already be on the list.'
  }

  // PostgREST schema/request errors (often HTTP 400)
  if (code === 'PGRST204' || lowerMessage.includes('column')) {
    return 'Form could not be saved — a field name may not match the database. Check the browser console for details.'
  }

  if (message) {
    return message
  }

  return 'Something went wrong. Please try again.'
}
