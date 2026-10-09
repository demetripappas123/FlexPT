import { supabase } from './supabase'

export type LinkedPerson = {
  id: string
  name: string
  email: string | null
  username: string | null
  auth_user_id: string | null
}

export async function fetchLinkedPerson(authUserId: string): Promise<LinkedPerson | null> {
  const { data, error } = await supabase
    .from('people')
    .select('id, name, email, username, auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) throw error
  return data
}
