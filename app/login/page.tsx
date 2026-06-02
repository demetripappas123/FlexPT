'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/supabase/auth/auth-helpers'
import { useAuth } from '@/context/authcontext'
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
    if (!loading && user) {
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
        if (!name.trim()) {
          setError('Please enter your name')
          setIsLoading(false)
          return
        }

        const { data, error } = await signUp(email, password, name.trim())

        if (error && !data?.user) {
          // Only show error if user wasn't created
          setError(error.message || 'Failed to sign up')
          setIsLoading(false)
          return
        }
        // If there's an error but user was created (email confirmation error), 
        // the signUp function handles it and we continue

        if (data?.user) {
          setSuccessMessage('Account created successfully! You can now sign in.')
          setIsLoading(false)
          // Optionally switch to sign in mode after successful signup
          setTimeout(() => {
            setIsSignUp(false)
            setSuccessMessage(null)
            setName('') // Clear name field
          }, 3000)
        }
      } else {
        const { data, error } = await signIn(email, password)

        if (error) {
          setError(error.message || 'Failed to sign in')
          setIsLoading(false)
          return
        }

        if (data?.user) {
          // Redirect will happen via useEffect
          router.push('/dash')
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">FlexPT</h1>
          <p className="text-muted-foreground">
            {isSignUp ? 'Create a new account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Toggle between Sign In and Sign Up */}
        <div className="flex mb-6 bg-background rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false)
              setError(null)
              setSuccessMessage(null)
              setName('') // Clear name when switching to sign in
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isSignUp
                ? 'bg-primary text-primary-foreground'
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
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isSignUp
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            disabled={isLoading}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/50 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

            {successMessage && (
              <div className="p-3 bg-green-600/20 border border-green-600/50 rounded-md text-green-400 text-sm">
                {successMessage}
              </div>
            )}

            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">
                  Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isSignUp}
                  className="bg-input border-border text-foreground"
                  placeholder="Your name"
                  disabled={isLoading}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
                Email
              </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-input border-border text-foreground"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-input border-border text-foreground"
              placeholder="••••••••"
              disabled={isLoading}
              minLength={6}
            />
            {isSignUp && (
              <p className="mt-1 text-xs text-muted-foreground">Password must be at least 6 characters</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
          >
            {isLoading
              ? isSignUp
                ? 'Creating account...'
                : 'Signing in...'
              : isSignUp
                ? 'Sign up'
                : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}

