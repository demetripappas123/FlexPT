'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchPrograms } from '@/supabase/fetches/fetchprograms'
import { Program } from '@/supabase/upserts/upsertprogram'
import { fetchNutritionPrograms, NutritionProgram } from '@/supabase/fetches/fetchnutritionprograms'
import { CheckinForm, CheckinFormPurpose, fetchCheckinForms } from '@/supabase/fetches/fetchcheckinforms'
import { ProgramGoalKind, PROGRAM_GOAL_KIND_LABEL } from '@/supabase/fetches/fetchprogramassignments'
import { assignProgramToPerson } from '@/supabase/utils/assignProgramToPerson'

type GoalDraft = {
  kind: ProgramGoalKind
  label: string
  baseline: string
  target: string
  unit: string
}

const EMPTY_GOAL: GoalDraft = { kind: 'qualitative', label: '', baseline: '', target: '', unit: '' }

type AssignProgramDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: string
  onAssigned: () => void
}

function formsFor(forms: CheckinForm[], purpose?: CheckinFormPurpose) {
  if (!purpose) return forms
  const matched = forms.filter((f) => f.purpose === purpose)
  return matched.length > 0 ? matched : forms
}

export default function AssignProgramDialog({
  open,
  onOpenChange,
  personId,
  onAssigned,
}: AssignProgramDialogProps) {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [nutritionPrograms, setNutritionPrograms] = useState<NutritionProgram[]>([])
  const [forms, setForms] = useState<CheckinForm[]>([])
  const [sourceProgramId, setSourceProgramId] = useState('')
  const [sourceNutritionProgramId, setSourceNutritionProgramId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [name, setName] = useState('')
  const [kickoffFormId, setKickoffFormId] = useState('')
  const [checkinFormId, setCheckinFormId] = useState('')
  const [habitFormId, setHabitFormId] = useState('')
  const [goals, setGoals] = useState<GoalDraft[]>([{ ...EMPTY_GOAL }])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !user?.id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [p, n, f] = await Promise.all([
          fetchPrograms(user.id),
          fetchNutritionPrograms(user.id),
          fetchCheckinForms(user.id),
        ])
        if (cancelled) return
        setPrograms(p)
        setNutritionPrograms(n)
        setForms(f)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load programs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, user?.id])

  const reset = () => {
    setSourceProgramId('')
    setSourceNutritionProgramId('')
    setStartDate(new Date().toISOString().split('T')[0])
    setName('')
    setKickoffFormId('')
    setCheckinFormId('')
    setHabitFormId('')
    setGoals([{ ...EMPTY_GOAL }])
    setError(null)
  }

  const handleAssign = async () => {
    if (!user?.id) return
    if (!sourceProgramId && !sourceNutritionProgramId) {
      setError('Pick a training program, a nutrition program, or both')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await assignProgramToPerson({
        personId,
        trainerId: user.id,
        startDate,
        name: name.trim() || undefined,
        sourceProgramId: sourceProgramId || null,
        sourceNutritionProgramId: sourceNutritionProgramId || null,
        kickoffFormId: kickoffFormId || null,
        checkinFormId: checkinFormId || null,
        habitFormId: habitFormId || null,
        goals: goals
          .filter((g) => g.label.trim())
          .map((g) => ({
            kind: g.kind,
            label: g.label.trim(),
            baseline_value: g.baseline ? Number(g.baseline) : null,
            target_value: g.target ? Number(g.target) : null,
            unit: g.unit.trim() || null,
          })),
      })
      reset()
      onAssigned()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign program')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign program</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Copies the template onto this client as a mesocycle: dated workouts, meals, and forms. Later template
              edits do not rewrite this block.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Training program</label>
              <select
                value={sourceProgramId}
                onChange={(e) => setSourceProgramId(e.target.value)}
                className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 cursor-pointer"
              >
                <option value="">None</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Nutrition program</label>
              <select
                value={sourceNutritionProgramId}
                onChange={(e) => setSourceNutritionProgramId(e.target.value)}
                className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 cursor-pointer"
              >
                <option value="">None</option>
                {nutritionPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Start date *</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Name (optional)</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to template name" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Kickoff form</label>
                <select
                  value={kickoffFormId}
                  onChange={(e) => setKickoffFormId(e.target.value)}
                  className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 cursor-pointer text-sm"
                >
                  <option value="">None</option>
                  {formsFor(forms, 'intake').map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Weekly check-in</label>
                <select
                  value={checkinFormId}
                  onChange={(e) => setCheckinFormId(e.target.value)}
                  className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 cursor-pointer text-sm"
                >
                  <option value="">None</option>
                  {formsFor(forms, 'checkin').map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Habit form</label>
                <select
                  value={habitFormId}
                  onChange={(e) => setHabitFormId(e.target.value)}
                  className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 cursor-pointer text-sm"
                >
                  <option value="">None</option>
                  {formsFor(forms, 'habit').map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Goals</p>
              {goals.map((goal, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <select
                    value={goal.kind}
                    onChange={(e) => {
                      const next = [...goals]
                      next[index] = { ...goal, kind: e.target.value as ProgramGoalKind }
                      setGoals(next)
                    }}
                    className="col-span-3 bg-background text-foreground border border-border rounded-md px-2 py-2 text-sm cursor-pointer"
                  >
                    {(Object.keys(PROGRAM_GOAL_KIND_LABEL) as ProgramGoalKind[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {PROGRAM_GOAL_KIND_LABEL[kind]}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="col-span-4"
                    placeholder="e.g. Gain 5 lb muscle"
                    value={goal.label}
                    onChange={(e) => {
                      const next = [...goals]
                      next[index] = { ...goal, label: e.target.value }
                      setGoals(next)
                    }}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="Baseline"
                    value={goal.baseline}
                    onChange={(e) => {
                      const next = [...goals]
                      next[index] = { ...goal, baseline: e.target.value }
                      setGoals(next)
                    }}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="Target"
                    value={goal.target}
                    onChange={(e) => {
                      const next = [...goals]
                      next[index] = { ...goal, target: e.target.value }
                      setGoals(next)
                    }}
                  />
                  <Input
                    className="col-span-1"
                    placeholder="lb"
                    value={goal.unit}
                    onChange={(e) => {
                      const next = [...goals]
                      next[index] = { ...goal, unit: e.target.value }
                      setGoals(next)
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setGoals([...goals, { ...EMPTY_GOAL }])}
              >
                Add goal
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            disabled={saving || loading}
            onClick={handleAssign}
          >
            {saving ? 'Assigning…' : 'Assign program'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
