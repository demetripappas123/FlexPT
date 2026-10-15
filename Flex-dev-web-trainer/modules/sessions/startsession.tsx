'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, X, Trash2, Pause, Play, Check } from 'lucide-react'
import { SessionWithExercises } from '@/supabase/fetches/fetchsessions'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { upsertExerciseSet, upsertSessionExercise, upsertSession, upsertWorkoutExercises, upsertExerciseSets } from '@/supabase/upserts/upsertsession'
import { upsertWorkout } from '@/supabase/upserts/upsertworkout'
import { deleteExerciseSet } from '@/supabase/deletions/deletesession'
import { getServerTime } from '@/supabase/utils/getServerTime'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { parseRangeInput, formatRangeDisplay } from '@/supabase/utils/rangeparse'
import { formatAssignedLine } from '@/supabase/utils/formatWorkload'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

type TrackedSet = {
  id?: string
  set_number: number
  weight: number | null // Display format (number) for UI, converted to numrange on save
  reps: number | null // Display format (number) for UI, converted to numrange on save
  rir: number | null // Display format (number) for UI, converted to numrange on save
  rpe: number | null // Display format (number) for UI, converted to numrange on save
  notes: string | null
  completed: boolean
}

function rangeToNumber(value: string | null, integer = false): number | null {
  if (!value) return null
  const formatted = formatRangeDisplay(value)
  if (!formatted) return null
  const raw = formatted.includes('-') ? formatted.split('-')[0] : formatted
  const num = integer ? parseInt(raw, 10) : parseFloat(raw)
  return Number.isNaN(num) ? null : num
}

type TrackedExercise = {
  exercise_id: string
  exercise_name: string
  session_exercise_id?: string
  position: number
  notes: string | null
  prescribed_sets?: string | null
  prescribed_reps?: string | null
  prescribed_weight?: string | null
  prescribed_rpe?: string | null
  prescribed_rir?: string | null
  sets: TrackedSet[]
}

type StartSessionProps = {
  session: SessionWithExercises
  onSessionStart?: () => Promise<void>
  onSessionComplete: () => Promise<void>
  onCancel: () => void
  onSessionCancel?: (withCharge: boolean) => Promise<void> // Optional callback for canceling with/without charge
}

export default function StartSession({
  session,
  onSessionStart,
  onSessionComplete,
  onCancel,
  onSessionCancel,
}: StartSessionProps) {
  const [exercises, setExercises] = useState<TrackedExercise[]>([])
  const [loading, setLoading] = useState(false)
  const [savingSetKey, setSavingSetKey] = useState<string | null>(null)
  const [workoutId, setWorkoutId] = useState<string | null>(session.workout_id)
  const [exerciseLibrary, setExerciseLibrary] = useState<{ id: string; name: string }[]>([])
  const [openCombobox, setOpenCombobox] = useState<{ [key: number]: boolean }>({})
  const [searchValue, setSearchValue] = useState<{ [key: number]: string }>({})
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const exercisesRef = useRef<TrackedExercise[]>([])
  const workoutIdRef = useRef<string | null>(session.workout_id)
  const initializedRef = useRef(false)
  const startRequestedRef = useRef(false)

  useEffect(() => {
    exercisesRef.current = exercises
  }, [exercises])

  useEffect(() => {
    workoutIdRef.current = workoutId
  }, [workoutId])

  // Load exercise library
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const data = await fetchExercises()
        setExerciseLibrary(data)
      } catch (err) {
        console.error('Failed to fetch exercises:', err)
      }
    }
    loadLibrary()
  }, [])

  // localStorage key for this session
  const storageKey = `session_workout_${session.id}`

  useEffect(() => {
    if (initializedRef.current) return

    const fromDb: TrackedExercise[] = (session.exercises || []).map((ex) => ({
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name || 'Unknown Exercise',
      session_exercise_id: ex.id,
      position: ex.position,
      notes: ex.notes,
      prescribed_sets: ex.prescribed_sets ?? null,
      prescribed_reps: ex.prescribed_reps ?? null,
      prescribed_weight: ex.prescribed_weight ?? null,
      prescribed_rpe: ex.prescribed_rpe ?? null,
      prescribed_rir: ex.prescribed_rir ?? null,
      sets: (ex.sets || []).map((set) => ({
        id: set.id,
        set_number: set.set_number,
        weight: rangeToNumber(set.weight),
        reps: rangeToNumber(set.reps, true),
        rir: rangeToNumber(set.rir, true),
        rpe: rangeToNumber(set.rpe),
        notes: set.notes,
        completed: set.completed === true,
      })),
    }))

    const savedData = localStorage.getItem(storageKey)
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        if (parsed.sessionId === session.id && Array.isArray(parsed.exercises)) {
          const dbById = new Map(
            fromDb.flatMap((ex) => ex.sets.filter((s) => s.id).map((s) => [s.id as string, s]))
          )
          const merged: TrackedExercise[] = parsed.exercises.map((ex: TrackedExercise, index: number) => {
            const dbEx = fromDb[index]
            return {
              ...ex,
              session_exercise_id: ex.session_exercise_id || dbEx?.session_exercise_id,
              prescribed_sets: dbEx?.prescribed_sets ?? ex.prescribed_sets,
              prescribed_reps: dbEx?.prescribed_reps ?? ex.prescribed_reps,
              prescribed_weight: dbEx?.prescribed_weight ?? ex.prescribed_weight,
              prescribed_rpe: dbEx?.prescribed_rpe ?? ex.prescribed_rpe,
              prescribed_rir: dbEx?.prescribed_rir ?? ex.prescribed_rir,
              sets: (ex.sets ?? []).map((set) => {
                const dbSet = set.id ? dbById.get(set.id) : undefined
                if (dbSet?.completed) return { ...set, ...dbSet, completed: true }
                return { ...set, completed: set.completed === true }
              }),
            }
          })
          setExercises(merged.length ? merged : fromDb)
          initializedRef.current = true
          return
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error)
      }
    }

    setExercises(fromDb)
    initializedRef.current = true
  }, [session.exercises, session.id, storageKey])

  useEffect(() => {
    if (session.started_at || !onSessionStart || startRequestedRef.current) return
    startRequestedRef.current = true
    onSessionStart().catch((err) => console.error('Error setting session start:', err))
  }, [session.started_at, onSessionStart])

  useEffect(() => {
    if (!session.started_at || isPaused) return
    const started = new Date(session.started_at).getTime()
    const tick = () => setTimeElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session.started_at, isPaused])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    if (exercises.length > 0) {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ sessionId: session.id, exercises, isPaused })
      )
    }
  }, [exercises, isPaused, session.id, storageKey])

  const persistLiveSet = async (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<TrackedSet> = {}
  ) => {
    const exercise = exercisesRef.current[exerciseIndex]
    const currentSet = exercise?.sets[setIndex]
    if (!exercise || !currentSet) return
    if (!exercise.exercise_id) {
      throw new Error('Pick an exercise before logging a set')
    }

    const nextSet: TrackedSet = { ...currentSet, ...patch }
    let nextWorkoutId = workoutIdRef.current

    if (!nextWorkoutId) {
      if (!session.person_id) throw new Error('Session has no person')
      const workout = await upsertWorkout({
        person_id: session.person_id,
        day_id: null,
        completed: false,
      })
      nextWorkoutId = workout.id
      workoutIdRef.current = nextWorkoutId
      setWorkoutId(nextWorkoutId)
      await upsertSession({
        id: session.id,
        type: session.type,
        person_id: session.person_id,
        trainer_id: session.trainer_id,
        start_time: session.start_time,
        started_at: session.started_at,
        workout_id: nextWorkoutId,
        converted: session.converted,
        status: 'in_progress',
      })
    }

    let exerciseRowId = exercise.session_exercise_id
    if (!exerciseRowId) {
      const row = await upsertSessionExercise({
        workout_id: nextWorkoutId,
        exercise_id: exercise.exercise_id,
        position: exercise.position,
        notes: exercise.notes,
      })
      exerciseRowId = row.id
    }

    const saved = await upsertExerciseSet({
      id: nextSet.id,
      session_exercise_id: exerciseRowId,
      set_number: nextSet.set_number,
      weight: nextSet.weight != null ? parseRangeInput(String(nextSet.weight)) : null,
      reps: nextSet.reps != null ? parseRangeInput(String(nextSet.reps)) : null,
      rir: nextSet.rir != null ? parseRangeInput(String(nextSet.rir)) : null,
      rpe: nextSet.rpe != null ? parseRangeInput(String(nextSet.rpe)) : null,
      notes: nextSet.notes,
      completed: nextSet.completed,
    })

    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exerciseIndex
          ? ex
          : {
              ...ex,
              session_exercise_id: exerciseRowId,
              sets: ex.sets.map((s, j) =>
                j === setIndex ? { ...s, ...patch, id: saved.id } : s
              ),
            }
      )
    )
  }

  const toggleSetComplete = async (exerciseIndex: number, setIndex: number) => {
    const set = exercisesRef.current[exerciseIndex]?.sets[setIndex]
    if (!set) return
    const completed = !set.completed
    const key = `${exerciseIndex}-${setIndex}`
    setSavingSetKey(key)
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exerciseIndex
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, completed } : s)),
            }
      )
    )
    try {
      await persistLiveSet(exerciseIndex, setIndex, { completed })
    } catch (err) {
      console.error('Error persisting set:', err)
      setExercises((prev) =>
        prev.map((ex, i) =>
          i !== exerciseIndex
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((s, j) =>
                  j === setIndex ? { ...s, completed: set.completed } : s
                ),
              }
        )
      )
      alert(err instanceof Error ? err.message : 'Could not save set')
    } finally {
      setSavingSetKey(null)
    }
  }

  const flushCompletedSet = (exerciseIndex: number, setIndex: number) => {
    if (!exercisesRef.current[exerciseIndex]?.sets[setIndex]?.completed) return
    persistLiveSet(exerciseIndex, setIndex).catch((err) => console.error('Error saving set:', err))
  }

  const updateExerciseNotes = (index: number, notes: string) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, notes } : ex))
    )
  }

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof TrackedSet,
    value: any
  ) => {
    setExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex].sets[setIndex] = {
        ...updated[exerciseIndex].sets[setIndex],
        [field]: value === '' ? null : value,
      }
      return updated
    })
  }

  const addSet = (exerciseIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev]
      const exercise = updated[exerciseIndex]
      const newSetNumber = exercise.sets.length > 0
        ? Math.max(...exercise.sets.map((s) => s.set_number)) + 1
        : 1

      // Create a new exercise object with updated sets array
      updated[exerciseIndex] = {
        ...exercise,
        sets: [
          ...exercise.sets,
          {
            set_number: newSetNumber,
            weight: null,
            reps: null,
            rir: null,
            rpe: null,
            notes: null,
            completed: false,
          },
        ],
      }
      return updated
    })
  }

  const removeSet = async (exerciseIndex: number, setIndex: number) => {
    const set = exercisesRef.current[exerciseIndex]?.sets[setIndex]
    if (set?.id) {
      try {
        await deleteExerciseSet(set.id)
      } catch (err) {
        console.error('Error deleting set:', err)
        alert('Could not delete set')
        return
      }
    }
    setExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets
          .filter((_, idx) => idx !== setIndex)
          .map((row, idx) => ({ ...row, set_number: idx + 1 })),
      }
      return updated
    })
  }

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        exercise_id: '',
        exercise_name: '',
        position: prev.length,
        notes: null,
        sets: [],
      },
    ])
  }

  const removeExercise = (index: number) => {
    setExercises((prev) => 
      prev.filter((_, i) => i !== index).map((ex, i) => ({
        ...ex,
        position: i,
      }))
    )
  }

  const updateExerciseField = <K extends keyof TrackedExercise>(
    index: number,
    key: K,
    value: TrackedExercise[K]
  ) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, [key]: value } : ex)))
  }

  const handleFinishSession = async () => {
    setLoading(true)
    try {
      // Clear localStorage when finishing session
      localStorage.removeItem(storageKey)
      // Filter out exercises without exercise_id (incomplete exercises)
      const validExercises = exercises.filter(ex => ex.exercise_id && ex.exercise_id.trim() !== '')

      let workoutId = workoutIdRef.current || session.workout_id

      // If there are exercises but no workout, create a workout
      if (validExercises.length > 0 && !workoutId) {
        if (!session.person_id) {
          throw new Error('Session has no person_id - cannot create workout')
        }
        
        // Import upsertWorkout
        const { upsertWorkout } = await import('@/supabase/upserts/upsertworkout')
        const workout = await upsertWorkout({
          person_id: session.person_id,
          day_id: null,
        })
        workoutId = workout.id

        // Update session with the new workout_id
        await upsertSession({
          id: session.id,
          type: session.type,
          person_id: session.person_id,
          trainer_id: session.trainer_id,
          start_time: session.start_time,
          started_at: session.started_at,
          end_time: null, // Will be set below
          workout_id: workoutId,
          converted: session.converted,
        })
      }

      // Only update exercises if there are valid exercises and a workout
      if (validExercises.length > 0 && workoutId) {
        // Use smart update function to handle exercises intelligently
        const exerciseData = validExercises.map((ex, index) => ({
          exercise_id: ex.exercise_id,
          position: index,
          notes: ex.notes ?? null,
        }))

        // Upsert exercises using smart update (compares and updates/inserts/deletes as needed)
        const updatedExercises = await upsertWorkoutExercises(workoutId, exerciseData)

        // Now update sets for each exercise using smart update
        for (let i = 0; i < validExercises.length; i++) {
          const exercise = validExercises[i]
          const updatedExercise = updatedExercises[i]
          
          if (updatedExercise && updatedExercise.id) {
            const setData = exercise.sets.map((set, idx) => ({
              set_number: idx + 1, // Re-number sets sequentially
              // Convert number inputs to numrange format for database
              weight: set.weight !== null && set.weight !== undefined ? parseRangeInput(String(set.weight)) : null,
              reps: set.reps !== null && set.reps !== undefined ? parseRangeInput(String(set.reps)) : null,
              rir: set.rir !== null && set.rir !== undefined ? parseRangeInput(String(set.rir)) : null,
              rpe: set.rpe !== null && set.rpe !== undefined ? parseRangeInput(String(set.rpe)) : null,
              notes: set.notes ?? null,
              completed: set.completed === true,
            }))

            // Use smart update for sets (compares and updates/inserts/deletes as needed)
            await upsertExerciseSets(updatedExercise.id, setData)
          }
        }
      }

      // Update session end_time when completing
      // started_at should already be set when session started, end_time set now
      // Use server time to avoid client clock issues
      const currentTime = await getServerTime()
      
      await upsertSession({
        id: session.id,
        type: session.type,
        person_id: session.person_id,
        trainer_id: session.trainer_id,
        start_time: session.start_time, // Keep scheduled time
        started_at: session.started_at || currentTime, // Use existing started_at or set now if not set
        end_time: currentTime, // Set end time when completing (from server)
        workout_id: workoutId, // Use the workoutId (may have been created above)
        person_package_id: session.person_package_id, // Keep person_package_id
        converted: session.converted,
        status: 'completed', // Set status to completed when finishing session
      })

      // Mark the workout as completed and set workout_date
      if (workoutId) {
        const { upsertWorkout } = await import('@/supabase/upserts/upsertworkout')
        await upsertWorkout({
          id: workoutId,
          person_id: session.person_id!,
          day_id: null, // Keep existing day_id if any
          completed: true, // Mark workout as completed
          workout_date: currentTime, // Set workout_date to when the session was completed
        })
      }

      // Remaining entitlement units come from linked sessions, including this one.
      await onSessionComplete()
      alert('Session completed successfully!')
    } catch (error) {
      console.error('Error completing session:', error)
      alert('Error completing session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const completedSetCount = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  )
  const totalSetCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live workout</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-semibold tabular-nums">{formatTime(timeElapsed)}</span>
              <button
                type="button"
                onClick={() => setIsPaused((prev) => !prev)}
                className="rounded-full border border-border p-2 text-muted-foreground hover:bg-muted cursor-pointer"
                title={isPaused ? 'Resume timer' : 'Pause timer'}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {completedSetCount}/{totalSetCount} sets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onCancel}
              variant="outline"
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border cursor-pointer"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              onClick={handleFinishSession}
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 text-white cursor-pointer"
            >
              {loading ? 'Finishing...' : 'Finish'}
            </Button>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto p-8">

        <div className="space-y-6">
          {exercises.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground mb-4">No exercises in workout. Add exercises below.</p>
              <Button
                onClick={addExercise}
                variant="outline"
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </div>
          ) : (
            <>
              {exercises.map((exercise, exerciseIndex) => (
              <div
                key={exerciseIndex}
                className="bg-background border border-border rounded-lg p-4 relative"
              >
                <button
                  onClick={() => removeExercise(exerciseIndex)}
                  className="absolute right-2 top-2 text-destructive hover:text-destructive/80 cursor-pointer p-1"
                  title="Remove exercise"
                >
                  <Trash2 className="h-5 w-5" />
                </button>

                <div className="mb-4">
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      {exercise.position + 1}. Exercise Name
                    </label>
                    <div className="relative">
                      <Input
                        value={exercise.exercise_name}
                        onChange={(e) => {
                          const value = e.target.value
                          updateExerciseField(exerciseIndex, 'exercise_name', value)
                          setSearchValue((prev) => ({ ...prev, [exerciseIndex]: value }))
                          setOpenCombobox((prev) => ({ ...prev, [exerciseIndex]: value.length > 0 }))
                        }}
                        onFocus={() => {
                          if (exercise.exercise_name.length > 0 || exerciseLibrary.length > 0) {
                            setOpenCombobox((prev) => ({ ...prev, [exerciseIndex]: true }))
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setOpenCombobox((prev) => ({ ...prev, [exerciseIndex]: false }))
                          }, 200)
                        }}
                        placeholder="Type to search exercises..."
                        className="bg-input text-foreground border-border placeholder-muted-foreground"
                      />
                      {openCombobox[exerciseIndex] && (
                        <div
                          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg"
                          onMouseDown={(e) => {
                            e.preventDefault()
                          }}
                        >
                          <Command className="bg-card text-foreground">
                            <CommandInput
                              value={searchValue[exerciseIndex] || exercise.exercise_name}
                              onValueChange={(value) => {
                                setSearchValue((prev) => ({ ...prev, [exerciseIndex]: value }))
                                updateExerciseField(exerciseIndex, 'exercise_name', value)
                              }}
                              placeholder="Search exercises..."
                              className="bg-background text-foreground border-border placeholder-muted-foreground"
                            />
                            <CommandList className="max-h-[200px] overflow-y-auto bg-card custom-scrollbar">
                              <CommandEmpty className="text-muted-foreground py-4 text-center">
                                No exercises found.
                              </CommandEmpty>
                              <CommandGroup className="bg-card">
                                {exerciseLibrary
                                  .filter((ex) => {
                                    const search = (searchValue[exerciseIndex] || exercise.exercise_name || '').toLowerCase()
                                    return ex.name.toLowerCase().includes(search)
                                  })
                                  .map((ex) => (
                                    <CommandItem
                                      key={ex.id}
                                      value={ex.name}
                                      onSelect={() => {
                                        updateExerciseField(exerciseIndex, 'exercise_name', ex.name)
                                        updateExerciseField(exerciseIndex, 'exercise_id', ex.id)
                                        setSearchValue((prev) => ({ ...prev, [exerciseIndex]: ex.name }))
                                        setOpenCombobox((prev) => ({ ...prev, [exerciseIndex]: false }))
                                      }}
                                      className="text-foreground hover:bg-secondary cursor-pointer data-[selected=true]:bg-secondary data-[selected=true]:text-secondary-foreground"
                                    >
                                      {ex.name}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Exercise Notes
                    </label>
                    <Textarea
                      value={exercise.notes || ''}
                      onChange={(e) => updateExerciseNotes(exerciseIndex, e.target.value)}
                      placeholder="Add notes for this exercise..."
                      className="bg-input text-foreground border-border min-h-[60px]"
                    />
                  </div>
                  {formatAssignedLine(exercise) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Assigned: {formatAssignedLine(exercise)}
                    </p>
                  )}
                </div>

              {/* Sets */}
              <div className="space-y-2">
                <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1.4fr_44px_32px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
                  <div>Set</div>
                  <div>Weight</div>
                  <div>Reps</div>
                  <div>RIR</div>
                  <div>RPE</div>
                  <div>Notes</div>
                  <div className="text-center">Done</div>
                  <div></div>
                </div>

                {exercise.sets && exercise.sets.length > 0 ? (
                  exercise.sets.map((set, setIndex) => (
                    <div
                      key={set.id || setIndex}
                      className={`grid grid-cols-[40px_1fr_1fr_1fr_1fr_1.4fr_44px_32px] gap-2 items-center rounded-md px-1 py-1 ${
                        set.completed ? 'bg-green-500/15' : ''
                      }`}
                    >
                    <div className="text-sm font-medium text-muted-foreground">{set.set_number}</div>
                    <Input
                      type="number"
                      step="0.5"
                      value={set.weight ?? ''}
                      onChange={(e) => {
                        // Only allow numeric input (including decimals)
                        const value = e.target.value
                        // Allow empty string, numbers, and single decimal point
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            'weight',
                            value ? parseFloat(value) : null
                          )
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent non-numeric characters (except allowed ones)
                        // Allow: numbers, backspace, delete, tab, escape, enter, decimal point
                        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
                        const isNumber = /^[0-9]$/.test(e.key)
                        const isDecimal = e.key === '.' && !e.currentTarget.value.includes('.')
                        const isAllowedKey = allowedKeys.includes(e.key)
                        
                        if (!isNumber && !isDecimal && !isAllowedKey && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault()
                        }
                      }}
                      placeholder={formatRangeDisplay(exercise.prescribed_weight) || 'Weight'}
                      onBlur={() => flushCompletedSet(exerciseIndex, setIndex)}
                      className="bg-input text-foreground border-border text-xs h-9 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <Input
                      type="number"
                      value={set.reps ?? ''}
                      onChange={(e) => {
                        // Only allow integer input
                        const value = e.target.value
                        // Allow empty string or integers only
                        if (value === '' || /^\d+$/.test(value)) {
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            'reps',
                            value ? parseInt(value) : null
                          )
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent non-numeric characters
                        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
                        const isNumber = /^[0-9]$/.test(e.key)
                        const isAllowedKey = allowedKeys.includes(e.key)
                        
                        if (!isNumber && !isAllowedKey && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault()
                        }
                      }}
                      placeholder={formatRangeDisplay(exercise.prescribed_reps) || 'Reps'}
                      onBlur={() => flushCompletedSet(exerciseIndex, setIndex)}
                      className="bg-input text-foreground border-border text-xs h-9 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <Input
                      type="number"
                      value={set.rir ?? ''}
                      onChange={(e) => {
                        // Only allow integer input
                        const value = e.target.value
                        // Allow empty string or integers only
                        if (value === '' || /^\d+$/.test(value)) {
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            'rir',
                            value ? parseInt(value) : null
                          )
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent non-numeric characters
                        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
                        const isNumber = /^[0-9]$/.test(e.key)
                        const isAllowedKey = allowedKeys.includes(e.key)
                        
                        if (!isNumber && !isAllowedKey && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault()
                        }
                      }}
                      placeholder={formatRangeDisplay(exercise.prescribed_rir) || 'RIR'}
                      onBlur={() => flushCompletedSet(exerciseIndex, setIndex)}
                      className="bg-input text-foreground border-border text-xs h-9 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <Input
                      type="number"
                      step="0.5"
                      value={set.rpe ?? ''}
                      onChange={(e) => {
                        // Only allow numeric input (including decimals)
                        const value = e.target.value
                        // Allow empty string, numbers, and single decimal point
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            'rpe',
                            value ? parseFloat(value) : null
                          )
                        }
                      }}
                      onKeyDown={(e) => {
                        // Prevent non-numeric characters (except allowed ones)
                        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
                        const isNumber = /^[0-9]$/.test(e.key)
                        const isDecimal = e.key === '.' && !e.currentTarget.value.includes('.')
                        const isAllowedKey = allowedKeys.includes(e.key)
                        
                        if (!isNumber && !isDecimal && !isAllowedKey && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault()
                        }
                      }}
                      placeholder={formatRangeDisplay(exercise.prescribed_rpe) || 'RPE'}
                      onBlur={() => flushCompletedSet(exerciseIndex, setIndex)}
                      className="bg-input text-foreground border-border text-xs h-9 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <Input
                      type="text"
                      value={set.notes || ''}
                      onChange={(e) =>
                        updateSet(exerciseIndex, setIndex, 'notes', e.target.value || null)
                      }
                      placeholder="Notes"
                      className="bg-input text-foreground border-border text-xs h-9"
                      onBlur={() => {
                        if (set.completed) {
                          persistLiveSet(exerciseIndex, setIndex).catch((err) =>
                            console.error('Error saving set:', err)
                          )
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => toggleSetComplete(exerciseIndex, setIndex)}
                      disabled={savingSetKey === `${exerciseIndex}-${setIndex}`}
                      title={set.completed ? 'Uncheck set' : 'Complete set'}
                      className={`h-9 w-9 rounded-md flex items-center justify-center cursor-pointer border ${
                        set.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-border bg-card text-muted-foreground hover:border-green-500 hover:text-green-500'
                      } disabled:opacity-50`}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <button
                      onClick={() => removeSet(exerciseIndex, setIndex)}
                      className="p-1 text-destructive hover:text-destructive/80 cursor-pointer flex items-center justify-center"
                      title="Remove set"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground col-span-8">
                    No sets added yet. Click "Add Set" below to add sets for this exercise.
                  </div>
                )}

                {/* Add Set Button */}
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    addSet(exerciseIndex)
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 bg-card hover:bg-muted text-foreground border-border cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Set
                </Button>
              </div>
            </div>
            ))}
            <Button
              onClick={addExercise}
              variant="outline"
              className="w-full border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} /> Add Exercise
            </Button>
            </>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col gap-3">
          <Button
            onClick={handleFinishSession}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white cursor-pointer"
          >
            {loading ? 'Finishing...' : 'Finish Session'}
          </Button>
          <Button
            onClick={() => setCancelDialogOpen(true)}
            variant="outline"
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive cursor-pointer"
          >
            Cancel Session
          </Button>
        </div>

        {/* Cancel Session Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Cancel Session</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                How would you like to cancel this session?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Button
                type="button"
                onClick={async () => {
                  try {
                    // Clear localStorage when canceling
                    localStorage.removeItem(storageKey)
                    if (onSessionCancel) {
                      await onSessionCancel(true)
                    } else {
                      onCancel()
                    }
                    setCancelDialogOpen(false)
                  } catch (error) {
                    console.error('Error canceling session:', error)
                    alert('Error canceling session. Please try again.')
                  }
                }}
                className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
              >
                Cancel with Charge
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    // Clear localStorage when canceling
                    localStorage.removeItem(storageKey)
                    if (onSessionCancel) {
                      await onSessionCancel(false)
                    } else {
                      onCancel()
                    }
                    setCancelDialogOpen(false)
                  } catch (error) {
                    console.error('Error canceling session:', error)
                    alert('Error canceling session. Please try again.')
                  }
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
              >
                Cancel without Charge
              </Button>
            </div>
            <DialogFooter>
              <Button
                onClick={() => setCancelDialogOpen(false)}
                variant="outline"
                className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}

