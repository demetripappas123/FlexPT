import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth:
    Platform.OS === 'web'
      ? { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      : { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
})
