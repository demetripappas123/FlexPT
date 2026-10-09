import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function isClientRole(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'client'
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

export function onAuthStateChange(
  callback: (event: string, session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => void
) {
  return supabase.auth.onAuthStateChange(callback)
}
