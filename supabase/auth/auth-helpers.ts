import { User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

export function isClientRole(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'client'
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

/**
 * Sign up with email and password
 * Also creates a trainer record in the trainers table
 * Note: Email confirmation errors are suppressed if user was created successfully
 */
export async function signUp(email: string, password: string, name?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Suppress email sending if possible (may still try if enabled in dashboard)
      emailRedirectTo: undefined,
    }
  })

  // If user was created but there's an email-related error, treat it as success
  // The user can still sign in even if email confirmation failed
  if (error && data?.user) {
    // Check if error is related to email confirmation
    const isEmailError = error.message?.toLowerCase().includes('email') || 
                         error.message?.toLowerCase().includes('confirmation') ||
                         error.message?.toLowerCase().includes('send')
    
    if (isEmailError) {
      // Return success data without the email error
      // User was created, trainer record will be created below
      console.warn('Email confirmation error (user created anyway):', error.message)
      // Continue to create trainer record
    } else {
      // Real error, return it
      return { data, error }
    }
  } else if (error) {
    return { data, error }
  }

  // If user was created successfully, create a trainer record
  if (data?.user) {
    try {
      const trainerName = name || email.split('@')[0] // Use name or email prefix as default
      const userEmail = data.user.email || email // Use email from user object or fallback to parameter
      
      const { error: trainerError } = await supabase
        .from('trainers')
        .insert({
          id: data.user.id, // Use the auth user's ID as the trainer ID
          name: trainerName,
          email: userEmail, // Store email in trainers table
          monthly_revenue_goal: 0,
          commission_percentage: 0,
          client_goal: 0,
          trained_hours_goal: 0,
          daily_booking_goal: 0,
        })

      if (trainerError) {
        console.error('Error creating trainer record:', trainerError)
        // Don't fail the signup if trainer creation fails, but log it
        // The user can still sign in, but won't have a trainer record
      }
    } catch (err) {
      console.error('Unexpected error creating trainer record:', err)
      // Continue even if trainer creation fails
    }
  }

  return { data, error }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Get the current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

/**
 * Get the current user
 */
export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

/**
 * Check if the current user's email is verified
 */
export async function isEmailVerified(): Promise<boolean> {
  const { user } = await getUser()
  return user?.email_confirmed_at !== null && user?.email_confirmed_at !== undefined
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string) {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
  })
  return { data, error }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback)
}

