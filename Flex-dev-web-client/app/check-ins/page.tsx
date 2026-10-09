'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthGate from '@/components/auth-gate'
import AppShell from '@/components/app-shell'
import { useAuth } from '@/context/auth-context'
import { fetchLinkedPerson } from '@/lib/person'
import { CheckinFormAssignment, listCheckinAssignments } from '@/lib/checkins'

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export default function CheckInsPage() {
  return (
    <AuthGate>
      <AppShell>
        <CheckInsList />
      </AppShell>
    </AuthGate>
  )
}

function CheckInsList() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<CheckinFormAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const person = await fetchLinkedPerson(user.id)
        if (!person) {
          if (!cancelled) setError('No client profile is linked to this login yet.')
          return
        }
        const rows = await listCheckinAssignments(person.id)
        if (!cancelled) setAssignments(rows)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load check-ins')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-stone-900">Check-ins</h1>
      <p className="mb-6 text-sm text-stone-600">
        Forms your trainer assigned. Fill them here — trainers no longer complete these for you.
      </p>

      {loading && assignments.length === 0 && (
        <p className="text-sm text-stone-600">Loading check-ins...</p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && assignments.length === 0 && (
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
          No check-in forms assigned yet.
        </div>
      )}

      <div className="space-y-2">
        {assignments.map((assignment) => (
          <Link
            key={assignment.id}
            href={`/check-ins/${assignment.id}`}
            className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-300"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-stone-900">{assignment.name}</p>
                <p className="text-xs text-stone-500">
                  {formatDate(assignment.assigned_date)} ·{' '}
                  {assignment.status === 'completed' ? 'Completed' : 'Due'}
                </p>
              </div>
              <span className="text-sm text-stone-600">
                {assignment.status === 'completed' ? 'View / edit' : 'Fill out'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
