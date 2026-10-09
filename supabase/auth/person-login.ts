import { supabase } from '../supabaseClient'
import { Person } from '../fetches/fetchpeople'

export async function upsertPersonLogin(
  personId: string,
  payload: { email: string; password?: string; username?: string | null }
): Promise<Person> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not signed in')
  }

  const res = await fetch(`/api/people/${personId}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to save login')
  }

  return body.person as Person
}
