'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthGate from '@/components/auth-gate'
import AppShell from '@/components/app-shell'
import { useAuth } from '@/context/auth-context'
import { fetchLinkedPerson, LinkedPerson } from '@/lib/person'

export default function HomePage() {
  return (
    <AuthGate>
      <AppShell>
        <HomeContent />
      </AppShell>
    </AuthGate>
  )
}

function HomeContent() {
  const { user } = useAuth()
  const [person, setPerson] = useState<LinkedPerson | null>(null)
  const [personError, setPersonError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchLinkedPerson(user.id)
      .then(setPerson)
      .catch((err) => setPersonError(err instanceof Error ? err.message : 'Failed to load profile'))
  }, [user])

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-2xl font-bold text-stone-900">You are signed in</h1>
      <p className="mb-6 text-sm text-stone-600">
        {person ? `Hi ${person.name}.` : 'Client Auth is working.'}
      </p>

      <dl className="mb-6 space-y-3 text-sm">
        <div>
          <dt className="text-stone-500">Auth email</dt>
          <dd className="font-medium text-stone-900">{user?.email}</dd>
        </div>
        {person && (
          <div>
            <dt className="text-stone-500">Linked person</dt>
            <dd className="font-medium text-stone-900">{person.name}</dd>
          </div>
        )}
        {!person && !personError && (
          <p className="text-stone-600">No people row linked to this Auth user yet.</p>
        )}
        {personError && <p className="text-red-700">{personError}</p>}
      </dl>

      <Link
        href="/check-ins"
        className="inline-flex cursor-pointer rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
      >
        Open check-ins
      </Link>
    </div>
  )
}
