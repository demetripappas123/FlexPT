// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function createSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase environment variables are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
  return createClient(supabaseUrl, supabaseKey)
}

let cached: ReturnType<typeof createClient> | null = null

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop, receiver) {
    if (!cached) cached = createSupabase()
    const value = Reflect.get(cached, prop, receiver)
    return typeof value === 'function' ? value.bind(cached) : value
  },
})
