'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/supabase/auth/auth-helpers'
import { useAuth } from '@/context/authcontext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const APPROVED_USERS_NOTICE = '* Only approved users can sign in right now.'
const LOGIN_BG = '#fafafa'

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
        className="flex min-h-screen items-center justify-center text-stone-800"
        style={{ backgroundColor: LOGIN_BG }}
      >
        Loading...
      </div>
    )
  }

  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 text-stone-900"
      style={{ backgroundColor: LOGIN_BG }}
    >
      <div className="w-full max-w-md rounded-lg border border-stone-200/90 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-brand">FlexPT</h1>
          <p className="text-stone-600">
            {isSignUp ? 'Create a new account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="mb-6 flex rounded-lg bg-stone-100 p-1">
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
                ? 'bg-brand text-brand-foreground shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
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
                ? 'bg-brand text-brand-foreground shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            disabled={isLoading}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          <p className="text-sm leading-relaxed text-stone-600">{APPROVED_USERS_NOTICE}</p>

          {isSignUp && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-stone-700">
                Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-stone-300 bg-white text-stone-900 placeholder:text-stone-400"
                placeholder="Your name"
                disabled
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!isSignUp}
              className="border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus-visible:ring-brand/30"
              placeholder="you@example.com"
              disabled={isLoading || isSignUp}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isSignUp}
              className="border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus-visible:ring-brand/30"
              placeholder="••••••••"
              disabled={isLoading || isSignUp}
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || isSignUp}
            className="w-full cursor-pointer bg-brand text-brand-foreground hover:bg-[var(--brand-dark)]"
          >
            {isLoading ? 'Signing in...' : isSignUp ? 'Sign up' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}

