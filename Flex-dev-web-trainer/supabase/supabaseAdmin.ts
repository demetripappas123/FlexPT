import { createClient, SupabaseClient } from '@supabase/supabase-js'

function missingAdminEnv(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
  const missing = [
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !supabaseServiceKey ? 'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY' : null,
  ].filter(Boolean)
  return missing.join(', ')
}

function createAdminClient(): SupabaseClient {
  const missing = missingAdminEnv()
  if (missing) {
    throw new Error(
      `Supabase Admin environment variables are required (${missing}). ` +
        'Add them in the Vercel project settings for this deployment.'
    )
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

let cached: SupabaseClient | null = null

function admin(): SupabaseClient {
  if (!cached) cached = createAdminClient()
  return cached
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = admin()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
