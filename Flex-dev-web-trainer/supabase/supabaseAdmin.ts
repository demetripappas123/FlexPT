import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
// Dashboard currently labels this "secret" key; older docs used SERVICE_ROLE_KEY.
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase Admin environment variables:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗ MISSING')
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY:',
    supabaseServiceKey ? '✓' : '✗ MISSING'
  )

  if (typeof window === 'undefined') {
    throw new Error(
      'Supabase Admin environment variables are required. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
    )
  }
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
