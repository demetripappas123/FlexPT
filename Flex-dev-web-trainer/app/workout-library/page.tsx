'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Search, Trash } from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchLibraryWorkouts, LibraryWorkout } from '@/supabase/fetches/fetchlibraryworkouts'
import { fetchPrograms } from '@/supabase/fetches/fetchprograms'
import { fetchWeeks, Week } from '@/supabase/fetches/fetchweek'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { addDay, updateDay } from '@/supabase/upserts/upsertday'
import { upsertDayExercises, updateDayExercises, DayExercise } from '@/supabase/upserts/upsertexercises'
import { upsertWeek } from '@/supabase/upserts/upsertweek'
import { parseRangeInput } from '@/supabase/utils/rangeparse'
import { Program } from '@/supabase/upserts/upsertprogram'
import AddDayDialog from '@/modules/programs/adddaydialog'
import DeleteDayDialog from '@/modules/programs/deleteday'

type DayPayload = {
  dayName: string
  exercises: Array<{
    name: string
    sets: string
    reps: string
    rir: string | null
    rpe: string | null
    weight: string | null
    notes: string
  }>
  dayId?: string
  delivery: 'session' | 'solo'
}

export default function WorkoutLibraryPage() {
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState<LibraryWorkout[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<LibraryWorkout | null>(null)
  const [creating, setCreating] = useState(false)
  const [programId, setProgramId] = useState('')
  const [weekId, setWeekId] = useState('')
  const [dayOpen, setDayOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [rows, programRows] = await Promise.all([
        fetchLibraryWorkouts(user?.id),
        fetchPrograms(user?.id),
      ])
      setWorkouts(rows)
      setPrograms(programRows.filter((program) => program.id))
    } catch (err) {
      console.error('Error loading workout library:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) void load()
  }, [user])

  useEffect(() => {
    if (!programId) {
      setWeeks([])
      setWeekId('')
      return
    }
    fetchWeeks(programId)
      .then((rows) => {
        setWeeks(rows)
        setWeekId(rows[0]?.id ?? '')
      })
      .catch((err) => console.error(err))
  }, [programId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return workouts
    return workouts.filter((workout) =>
      workout.name.toLowerCase().includes(q) ||
      workout.programName.toLowerCase().includes(q) ||
      workout.exercises.some((name) => name.toLowerCase().includes(q))
    )
  }, [workouts, query])

  const saveDay = async (payload: DayPayload) => {
    const isEdit = Boolean(payload.dayId)
    let dayId = payload.dayId
    if (isEdit && dayId) {
      const updated = await updateDay(dayId, payload.dayName, payload.delivery)
      if (!updated) throw new Error('Failed to update workout')
    } else {
      if (!weekId) throw new Error('Pick a week')
      const created = await addDay(weekId, payload.dayName, payload.delivery)
      if (!created) throw new Error('Failed to create workout')
      dayId = created.id
    }

    const library = await fetchExercises()
    const mapped: DayExercise[] = payload.exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise, index) => {
        const match = library.find((item) => item.name === exercise.name)
        if (!match) throw new Error(`Exercise "${exercise.name}" not found in library`)
        return {
          day_id: dayId!,
          exercise_def_id: match.id,
          sets: exercise.sets.trim() ? parseRangeInput(exercise.sets) ?? null : null,
          reps: exercise.reps.trim() ? parseRangeInput(exercise.reps) ?? null : null,
          rir: exercise.rir?.trim() ? parseRangeInput(exercise.rir) ?? null : null,
          rpe: exercise.rpe?.trim() ? parseRangeInput(exercise.rpe) ?? null : null,
          notes: exercise.notes || '',
          weight_used: exercise.weight?.trim() ? parseRangeInput(exercise.weight) ?? null : null,
          exercise_number: index + 1,
        }
      })

    if (isEdit) await updateDayExercises(dayId!, mapped)
    else if (mapped.length > 0) await upsertDayExercises(mapped)

    setEditing(null)
    setDayOpen(false)
    setCreating(false)
    await load()
  }

  const startCreate = async () => {
    if (!programId) return
    let targetWeek = weekId
    if (!targetWeek) {
      const week = await upsertWeek({ program_id: programId })
      targetWeek = week.id
      setWeekId(week.id)
      setWeeks((current) => [...current, week])
    }
    setCreating(false)
    setDayOpen(true)
  }

  return (
    <div className="w-full space-y-4 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight">Workout library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Days on your program templates. Editing one here updates that program.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)} disabled={programs.length === 0}>
          <Plus className="h-4 w-4" />
          Add workout
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search workouts"
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading workouts...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
          {programs.length === 0
            ? 'Create a program first. Its days show up here as workouts.'
            : 'No workout days yet. Add a day to a program, or add one here.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((workout) => (
            <article key={workout.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-medium">{workout.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Link href={`/programs/${workout.programId}`} className="hover:text-foreground">
                      {workout.programName}
                    </Link>
                    {' · '}Week {workout.weekNumber}
                    {' · '}{workout.delivery === 'session' ? 'Session' : 'Solo'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(workout)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Edit ${workout.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <DeleteDayDialog dayId={workout.id} dayName={workout.name} onDeleted={() => void load()}>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Delete ${workout.name}`}
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </DeleteDayDialog>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {workout.exercises.length === 0 ? (
                  <li>No exercises</li>
                ) : (
                  workout.exercises.map((name, index) => <li key={`${workout.id}-${index}`}>{name}</li>)
                )}
              </ul>
            </article>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-medium">Add a workout day</h2>
            <p className="mt-1 text-sm text-muted-foreground">It is saved on the program you pick.</p>
            <label className="mt-4 block text-sm font-medium">Program</label>
            <select
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            >
              <option value="">Select a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-medium">Week</label>
            <select
              value={weekId}
              onChange={(event) => setWeekId(event.target.value)}
              disabled={!programId}
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm disabled:opacity-60"
            >
              {weeks.length === 0 ? (
                <option value="">New week</option>
              ) : (
                weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    Week {week.number}
                  </option>
                ))
              )}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!programId} onClick={() => void startCreate()}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddDayDialog
        open={Boolean(editing) || dayOpen}
        onClose={() => {
          setEditing(null)
          setDayOpen(false)
        }}
        weekId={editing?.weekId || weekId}
        dayId={editing?.id}
        initialDayName={editing?.name}
        initialDelivery={editing?.delivery}
        onAdded={() => void load()}
        onSubmit={(payload) => {
          void saveDay(payload).catch((err) => {
            console.error(err)
            alert(err instanceof Error ? err.message : 'Could not save workout')
          })
        }}
      />
    </div>
  )
}
