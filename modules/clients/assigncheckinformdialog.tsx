'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import { CheckinForm, fetchCheckinForms } from '@/supabase/fetches/fetchcheckinforms'
import { Client, fetchClients } from '@/supabase/fetches/fetchpeople'
import { assignCheckinForm } from '@/supabase/upserts/upsertcheckinformassignment'
import { CheckinFormAssignment } from '@/supabase/fetches/fetchcheckinformassignments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type AssignCheckinFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId?: string
  formId?: string
  onAssigned: (assignment: CheckinFormAssignment) => void
}

export default function AssignCheckinFormDialog({
  open,
  onOpenChange,
  personId,
  formId,
  onAssigned,
}: AssignCheckinFormDialogProps) {
  const { user } = useAuth()
  const [forms, setForms] = useState<CheckinForm[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedFormId, setSelectedFormId] = useState(formId ?? '')
  const [selectedPersonId, setSelectedPersonId] = useState(personId ?? '')
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedFormId(formId ?? '')
    setSelectedPersonId(personId ?? '')
    setAssignedDate(new Date().toISOString().split('T')[0])
    setError(null)
  }, [open, formId, personId])

  useEffect(() => {
    if (!open || !user?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const needsForms = !formId
        const needsClients = !personId
        const [formRows, clientRows] = await Promise.all([
          needsForms ? fetchCheckinForms(user.id) : Promise.resolve([]),
          needsClients ? fetchClients(user.id) : Promise.resolve([]),
        ])
        if (cancelled) return
        if (needsForms) setForms(formRows)
        if (needsClients) setClients(clientRows)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load assign options')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, user?.id, formId, personId])

  const handleAssign = async () => {
    if (!selectedFormId) {
      setError('Pick a check-in form')
      return
    }
    if (!selectedPersonId) {
      setError('Pick a client')
      return
    }
    if (!assignedDate) {
      setError('Pick a date')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const assignment = await assignCheckinForm({
        personId: selectedPersonId,
        trainerId: user?.id ?? null,
        formId: selectedFormId,
        assignedDate,
      })
      onAssigned(assignment)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to assign form')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>Assign check-in form</DialogTitle>
          <DialogDescription>
            Copies this template onto the client. Later library edits will not change this assignment.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-4">
            {!formId && (
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Form *</label>
                <select
                  value={selectedFormId}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm cursor-pointer"
                >
                  <option value="">Select a form</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}
                    </option>
                  ))}
                </select>
                {forms.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No templates yet. Create one under Library → Check-in forms.
                  </p>
                )}
              </div>
            )}
            {!personId && (
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Client *</label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm cursor-pointer"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Due date *</label>
              <Input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="bg-input text-foreground border-border"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={saving || loading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
          >
            {saving ? 'Assigning...' : 'Assign form'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
