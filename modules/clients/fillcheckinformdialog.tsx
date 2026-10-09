'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import {
  CheckinAssignmentField,
  CheckinFormAssignment,
  fetchCheckinFormAssignmentWithData,
} from '@/supabase/fetches/fetchcheckinformassignments'
import { saveCheckinFormAnswers } from '@/supabase/upserts/upsertcheckinformassignment'
import { CheckinFieldType } from '@/supabase/fetches/fetchcheckinforms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type FillCheckinFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignmentId: string | null
  onSaved: (assignment: CheckinFormAssignment) => void
  readOnly?: boolean
}

const SCALE_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CheckinAssignmentField
  value: string
  onChange: (next: string) => void
}) {
  const type: CheckinFieldType = field.field_type

  if (type === 'long_text') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-input text-foreground border-border"
        placeholder="Type an answer"
      />
    )
  }

  if (type === 'number') {
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-input text-foreground border-border"
        placeholder="0"
      />
    )
  }

  if (type === 'scale') {
    return (
      <div className="flex flex-wrap gap-1">
        {SCALE_VALUES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-8 w-8 rounded-md text-sm border cursor-pointer ${
              value === n
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-input text-foreground border-border hover:bg-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    )
  }

  if (type === 'yes_no') {
    return (
      <div className="flex gap-2">
        {['yes', 'no'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`px-3 py-2 rounded-md text-sm border cursor-pointer capitalize ${
              value === option
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-input text-foreground border-border hover:bg-muted'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-input text-foreground border-border"
      placeholder="Type an answer"
    />
  )
}

export default function FillCheckinFormDialog({
  open,
  onOpenChange,
  assignmentId,
  onSaved,
  readOnly = true,
}: FillCheckinFormDialogProps) {
  const { user } = useAuth()
  const [assignment, setAssignment] = useState<CheckinFormAssignment | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !assignmentId) {
      setAssignment(null)
      setValues({})
      setError(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchCheckinFormAssignmentWithData(assignmentId)
        if (cancelled) return
        if (!data) {
          setError('Assignment not found')
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
          setError(err instanceof Error ? err.message : 'Failed to load form')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, assignmentId])

  const handleSave = async () => {
    if (!assignment) return
    const missing = (assignment.fields ?? []).filter(
      (field) => field.required && !values[field.id]?.trim()
    )
    if (missing.length > 0) {
      setError(`Required: ${missing.map((field) => field.label).join(', ')}`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await saveCheckinFormAnswers({
        assignmentId: assignment.id,
        completedBy: user?.id ?? null,
        answers: (assignment.fields ?? []).map((field) => ({
          fieldId: field.id,
          valueText: values[field.id] ?? null,
        })),
      })
      onSaved({ ...assignment, status: 'completed' })
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to save answers')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment?.name ?? 'Fill check-in form'}</DialogTitle>
          <DialogDescription>
            Client-submitted answers. Trainers assign forms; clients fill them in the client app.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading form...</p>
        ) : (
          <div className="space-y-4">
            {assignment?.description && (
              <p className="text-sm text-muted-foreground">{assignment.description}</p>
            )}
            {(assignment?.fields ?? []).length === 0 && !error && (
              <p className="text-sm text-muted-foreground">This form has no questions.</p>
            )}
            {(assignment?.fields ?? []).map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                {readOnly ? (
                  <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {values[field.id]?.trim() ? values[field.id] : '—'}
                  </p>
                ) : (
                  <FieldInput
                    field={field}
                    value={values[field.id] ?? ''}
                    onChange={(next) => setValues((prev) => ({ ...prev, [field.id]: next }))}
                  />
                )}
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button
              onClick={handleSave}
              disabled={saving || loading || !assignment}
              className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {saving ? 'Saving...' : assignment?.status === 'completed' ? 'Save answers again' : 'Submit'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
