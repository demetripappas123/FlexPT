'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import {
  CheckinFieldType,
  CheckinForm,
  CheckinFormPurpose,
  CHECKIN_FORM_PURPOSE_LABEL,
  fetchCheckinForms,
  fetchCheckinFormWithFields,
} from '@/supabase/fetches/fetchcheckinforms'
import { deleteCheckinForm, replaceCheckinFormFields, upsertCheckinForm } from '@/supabase/upserts/upsertcheckinform'
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
import { Plus, Pencil, Trash, ClipboardList, UserPlus } from 'lucide-react'
import AssignCheckinFormDialog from '@/modules/clients/assigncheckinformdialog'

const PURPOSE_OPTIONS: CheckinFormPurpose[] = ['intake', 'checkin', 'habit', 'other']

const FIELD_TYPES: { value: CheckinFieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'scale', label: 'Scale (1–10)' },
  { value: 'yes_no', label: 'Yes / No' },
]

type DraftField = {
  key: string
  label: string
  field_type: CheckinFieldType
  required: boolean
}

const emptyDraftField = (): DraftField => ({
  key: crypto.randomUUID(),
  label: '',
  field_type: 'text',
  required: false,
})

export default function CheckinFormList() {
  const { user } = useAuth()
  const [forms, setForms] = useState<CheckinForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [purpose, setPurpose] = useState<CheckinFormPurpose>('checkin')
  const [fields, setFields] = useState<DraftField[]>([emptyDraftField()])
  const [deleteTarget, setDeleteTarget] = useState<CheckinForm | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [assignFormId, setAssignFormId] = useState<string | null>(null)

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await fetchCheckinForms(user.id)
      setForms(data)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load check-in forms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [user?.id])

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setPurpose('checkin')
    setFields([emptyDraftField()])
    setError(null)
    setDialogOpen(true)
  }

  const openEdit = async (form: CheckinForm) => {
    setError(null)
    try {
      const full = await fetchCheckinFormWithFields(form.id)
      setEditingId(form.id)
      setName(full?.name ?? form.name)
      setDescription(full?.description ?? '')
      setPurpose(full?.purpose ?? form.purpose ?? 'checkin')
      const existing = full?.fields ?? []
      setFields(
        existing.length > 0
          ? existing.map((field) => ({
              key: field.id,
              label: field.label,
              field_type: field.field_type,
              required: field.required,
            }))
          : [emptyDraftField()]
      )
      setDialogOpen(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load form')
    }
  }

  const handleSave = async () => {
    if (!user?.id) return
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const validFields = fields.filter((f) => f.label.trim())
    setSaving(true)
    setError(null)
    try {
      const saved = await upsertCheckinForm({
        id: editingId ?? undefined,
        trainer_id: user.id,
        name,
        description,
        purpose,
      })
      await replaceCheckinFormFields(saved.id, validFields)
      setDialogOpen(false)
      await load()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      await deleteCheckinForm(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to delete form')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading check-in forms...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <Button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add check-in form
        </Button>
      </div>

      {error && !dialogOpen && !deleteTarget && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {forms.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <ClipboardList className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            No check-in forms yet. Create a template here, then assign it to clients later.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className="flex items-center justify-between bg-card border border-border rounded-md hover:bg-muted/40 transition-colors"
            >
              <button
                type="button"
                onClick={() => openEdit(form)}
                className="flex-1 text-left p-4 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{form.name}</h3>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {CHECKIN_FORM_PURPOSE_LABEL[form.purpose ?? 'checkin']}
                  </span>
                </div>
                {form.description && (
                  <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
                )}
              </button>
              <div className="flex items-center gap-1 pr-3">
                <button
                  type="button"
                  onClick={() => setAssignFormId(form.id)}
                  className="p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Assign to client"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(form)}
                  className="p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Edit form"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(form)}
                  className="p-2 text-muted-foreground hover:text-destructive cursor-pointer"
                  title="Delete form"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit check-in form' : 'New check-in form'}</DialogTitle>
            <DialogDescription>
              Library template only. Client submissions are not stored on this table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-input text-foreground border-border"
                placeholder="Weekly progress check-in"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as CheckinFormPurpose)}
                className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm cursor-pointer"
              >
                {PURPOSE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {CHECKIN_FORM_PURPOSE_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-input text-foreground border-border"
                placeholder="Optional notes for you"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">Questions</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFields((prev) => [...prev, emptyDraftField()])}
                  className="cursor-pointer"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add question
                </Button>
              </div>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.key} className="border border-border rounded-md p-3 space-y-2">
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) => (f.key === field.key ? { ...f, label: e.target.value } : f))
                        )
                      }
                      className="bg-input text-foreground border-border"
                      placeholder={`Question ${index + 1}`}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={field.field_type}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((f) =>
                              f.key === field.key
                                ? { ...f, field_type: e.target.value as CheckinFieldType }
                                : f
                            )
                          )
                        }
                        className="px-3 py-2 rounded-md bg-input border border-border text-foreground text-sm cursor-pointer"
                      >
                        {FIELD_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            setFields((prev) =>
                              prev.map((f) =>
                                f.key === field.key ? { ...f, required: e.target.checked } : f
                              )
                            )
                          }
                          className="rounded border-border"
                        />
                        Required
                      </label>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFields((prev) => prev.filter((f) => f.key !== field.key))}
                          className="ml-auto text-sm text-destructive cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {error && dialogOpen && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create form'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignCheckinFormDialog
        open={assignFormId != null}
        onOpenChange={(open) => !open && setAssignFormId(null)}
        formId={assignFormId ?? undefined}
        onAssigned={() => {
          setAssignFormId(null)
        }}
      />

      <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Delete check-in form</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && deleteTarget && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
