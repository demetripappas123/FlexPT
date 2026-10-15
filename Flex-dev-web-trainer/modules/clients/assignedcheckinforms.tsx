'use client'

import React, { useState } from 'react'
import { CheckinFormAssignment } from '@/supabase/fetches/fetchcheckinformassignments'
import { CHECKIN_FORM_PURPOSE_LABEL } from '@/supabase/fetches/fetchcheckinforms'
import { deleteCheckinFormAssignment } from '@/supabase/upserts/upsertcheckinformassignment'
import { assignmentCompletedThisWeek } from '@/supabase/utils/checkinWeek'
import { Button } from '@/components/ui/button'
import { ClipboardList, Plus, Trash } from 'lucide-react'

type AssignedCheckinFormsProps = {
  assignments: CheckinFormAssignment[] | null
  loading?: boolean
  onAssignClick: () => void
  onFillClick: (assignment: CheckinFormAssignment) => void
  onDeleted: (assignmentId: string) => void
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export default function AssignedCheckinForms({
  assignments,
  loading,
  onAssignClick,
  onFillClick,
  onDeleted,
}: AssignedCheckinFormsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (assignment: CheckinFormAssignment) => {
    setDeletingId(assignment.id)
    setError(null)
    try {
      await deleteCheckinFormAssignment(assignment.id)
      onDeleted(assignment.id)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to remove assignment')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Check-in forms {assignments && assignments.length > 0 && `(${assignments.length})`}
        </h2>
        <Button
          onClick={onAssignClick}
          variant="outline"
          className="bg-card hover:bg-muted text-foreground border-border cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" />
          Assign form
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {assignments && assignments.length > 0 && (
        <div
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            assignments.some((row) => assignmentCompletedThisWeek(row))
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          {assignments.some((row) => assignmentCompletedThisWeek(row))
            ? 'Completed this week'
            : 'No check-in completed this week'}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading check-in forms...</p>
      ) : !assignments || assignments.length === 0 ? (
        <div className="text-center py-6">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No check-in forms assigned yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between gap-3 border border-border rounded-md px-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{assignment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {CHECKIN_FORM_PURPOSE_LABEL[assignment.purpose ?? 'checkin']} ·{' '}
                  {formatDate(assignment.assigned_date)} ·{' '}
                  <span
                    className={
                      assignment.status === 'completed'
                        ? 'text-emerald-400 font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    {assignment.status === 'completed' ? 'Completed' : 'Assigned'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {assignment.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onFillClick(assignment)}
                    className="cursor-pointer"
                  >
                    View answers
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(assignment)}
                  disabled={deletingId === assignment.id}
                  className="p-2 text-muted-foreground hover:text-destructive cursor-pointer"
                  title="Unassign form"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
