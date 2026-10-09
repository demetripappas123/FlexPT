'use client'

import React, { useState } from 'react'
import { Person } from '@/supabase/fetches/fetchpeople'
import { upsertPersonLogin } from '@/supabase/auth/person-login'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ClientLoginProps = {
  person: Person
  onUpdated?: (person: Person) => void
}

export default function ClientLogin({ person, onUpdated }: ClientLoginProps) {
  const hasLogin = Boolean(person.auth_user_id)
  const [email, setEmail] = useState(person.email ?? '')
  const [username, setUsername] = useState(person.username ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const updated = await upsertPersonLogin(person.id, {
        email,
        username: username.trim() || null,
        password: password || undefined,
      })
      setPassword('')
      setSuccess(hasLogin ? 'Login updated.' : 'Client login created. They can sign in with this email.')
      onUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save login')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 bg-card border border-border rounded-md space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Client login</h2>
        <span className="text-xs text-muted-foreground">
          {hasLogin ? 'Auth linked' : 'No login yet'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Password is stored in Supabase Auth, not on this person row. Login uses email;
        username is optional.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        {error && (
          <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="sm:col-span-2 rounded-md border border-green-200 bg-green-50 p-2 text-sm text-green-700">
            {success}
          </div>
        )}
        <div>
          <label htmlFor="client-login-email" className="mb-1 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <Input
            id="client-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="client@email.com"
          />
        </div>
        <div>
          <label htmlFor="client-login-username" className="mb-1 block text-xs font-medium text-muted-foreground">
            Username (optional)
          </label>
          <Input
            id="client-login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="handle"
            minLength={3}
            maxLength={32}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="client-login-password" className="mb-1 block text-xs font-medium text-muted-foreground">
            {hasLogin ? 'New password (leave blank to keep)' : 'Password'}
          </label>
          <Input
            id="client-login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!hasLogin}
            minLength={6}
            placeholder="••••••••"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={saving} className="cursor-pointer">
            {saving ? 'Saving...' : hasLogin ? 'Update login' : 'Create login'}
          </Button>
        </div>
      </form>
    </div>
  )
}
