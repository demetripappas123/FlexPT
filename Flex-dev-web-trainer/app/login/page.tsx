'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp, signOut, isClientRole } from '@/supabase/auth/auth-helpers'
import { useAuth } from '@/context/authcontext'
import { supabase } from '@/supabase/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user && !isClientRole(user)) {
      router.push('/dash')
    }
  }, [user, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsLoading(true)

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await signUp(email, password, name.trim() || undefined)

        if (signUpError) {
          setError(signUpError.message || 'Failed to create account')
          setIsLoading(false)
          return
        }

        if (data?.session) {
          router.push('/dash')
          return
        }

        setSuccessMessage('Account created. Confirm your email if asked, then sign in.')
        setIsSignUp(false)
        setPassword('')
        setIsLoading(false)
        return
      }

      const { data, error } = await signIn(email, password)

      if (error) {
        setError(error.message || 'Failed to sign in')
        setIsLoading(false)
        return
      }

      if (data?.user) {
        if (isClientRole(data.user)) {
          await signOut()
          setError('This is a client login. Use the client app.')
          setIsLoading(false)
          return
        }

        const { data: trainer, error: trainerError } = await supabase
          .from('trainers')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (trainerError || !trainer) {
          await signOut()
          setError('This account is not a trainer.')
          setIsLoading(false)
          return
        }

        router.push('/dash')
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background text-foreground"
      >
        Loading...
      </div>
    )
  }

  if (user && !isClientRole(user)) {
    return null // Will redirect via useEffect
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-[26px] font-normal tracking-tight text-primary">FlexPT</h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Create a new account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="mb-6 flex rounded-md bg-secondary p-1">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false)
              setError(null)
              setSuccessMessage(null)
              setName('')
            }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              !isSignUp
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            disabled={isLoading}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true)
              setError(null)
              setSuccessMessage(null)
            }}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isSignUp
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            disabled={isLoading}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {isSignUp && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-border bg-card text-foreground"
                placeholder="Your name"
                disabled={isLoading}
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-border bg-card text-foreground"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-border bg-card text-foreground"
              placeholder="••••••••"
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (isSignUp ? 'Creating account...' : 'Signing in...') : isSignUp ? 'Sign up' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}

