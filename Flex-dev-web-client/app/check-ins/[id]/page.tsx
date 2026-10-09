'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AuthGate from '@/components/auth-gate'
import AppShell from '@/components/app-shell'
import CheckinFieldInput from '@/components/checkin-field-input'
import { useAuth } from '@/context/auth-context'
import { fetchLinkedPerson } from '@/lib/person'
import {
  CheckinFormAssignment,
  clearCheckinAnswers,
  getCheckinAssignment,
  saveCheckinAnswers,
} from '@/lib/checkins'

export default function CheckInDetailPage() {
  return (
    <AuthGate>
      <AppShell>
        <CheckInForm />
      </AppShell>
    </AuthGate>
  )
}

function CheckInForm() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const assignmentId = params.id as string

  const [assignment, setAssignment] = useState<CheckinFormAssignment | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !assignmentId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const person = await fetchLinkedPerson(user.id)
        const data = await getCheckinAssignment(assignmentId)
        if (cancelled) return
        if (!data || !person || data.person_id !== person.id) {
          setError('This check-in is not assigned to you.')
          setAssignment(null)
          return
        }
        setAssignment(data)
        const next: Record<string, string> = {}
        for (const field of data.fields ?? []) {
          const answer = data.answers?.find((row) => row.field_id === field.id)
          next[field.id] = answer?.value_text ?? ''
        }
        setValues(next)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load check-in')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, assignmentId])

  const handleSave = async () => {
    if (!assignment || !user) return
    const missing = (assignment.fields ?? []).filter(
      (field) => field.required && !values[field.id]?.trim()
    )
    if (missing.length > 0) {
      setError(`Required: ${missing.map((field) => field.label).join(', ')}`)
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await saveCheckinAnswers({
        assignmentId: assignment.id,
        completedBy: user.id,
        answers: (assignment.fields ?? []).map((field) => ({
          fieldId: field.id,
          valueText: values[field.id] ?? null,
        })),
      })
      setAssignment({ ...assignment, status: 'completed' })
      setSuccess('Check-in saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save check-in')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!assignment) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await clearCheckinAnswers(assignment.id)
      setValues({})
      setAssignment({ ...assignment, status: 'assigned', completed_at: null, completed_by: null })
      setSuccess('Answers cleared.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear answers')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-stone-600">Loading form...</p>
  }

  if (!assignment) {
    return (
      <div>
        <p className="mb-4 text-sm text-red-700">{error ?? 'Check-in not found.'}</p>
        <button
          type="button"
          onClick={() => router.push('/check-ins')}
          className="cursor-pointer text-sm text-stone-700 underline"
        >
          Back to check-ins
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push('/check-ins')}
        className="mb-4 cursor-pointer text-sm text-stone-600 hover:text-stone-900"
      >
        ← Check-ins
      </button>

      <h1 className="mb-1 text-2xl font-bold text-stone-900">{assignment.name}</h1>
      {assignment.description && (
        <p className="mb-6 text-sm text-stone-600">{assignment.description}</p>
      )}

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </p>
      )}

      <form
        className="space-y-5 rounded-lg border border-stone-200 bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        {(assignment.fields ?? []).length === 0 && (
          <p className="text-sm text-stone-600">This form has no questions.</p>
        )}
        {(assignment.fields ?? []).map((field) => (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-stone-800">
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            <CheckinFieldInput
              field={field}
              value={values[field.id] ?? ''}
              onChange={(next) => setValues((prev) => ({ ...prev, [field.id]: next }))}
            />
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : assignment.status === 'completed' ? 'Update answers' : 'Submit'}
          </button>
          {assignment.status === 'completed' && (
            <button
              type="button"
              disabled={saving}
              onClick={handleClear}
              className="cursor-pointer rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
            >
              Clear answers
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
