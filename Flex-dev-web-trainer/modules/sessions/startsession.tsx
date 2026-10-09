'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, X, Trash2, Play, Pause, RotateCcw } from 'lucide-react'
import { SessionWithExercises } from '@/supabase/fetches/fetchsessions'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { upsertExerciseSet, upsertSessionExercise, upsertSession, upsertWorkoutExercises, upsertExerciseSets } from '@/supabase/upserts/upsertsession'
import { getServerTime } from '@/supabase/utils/getServerTime'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { parseRangeInput, formatRangeDisplay } from '@/supabase/utils/rangeparse'
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
}

type TrackedExercise = {
  exercise_id: string
  exercise_name: string
  session_exercise_id?: string
  position: number
  notes: string | null
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
  const [exerciseLibrary, setExerciseLibrary] = useState<{ id: string; name: string }[]>([])
  const [openCombobox, setOpenCombobox] = useState<{ [key: number]: boolean }>({})
  const [searchValue, setSearchValue] = useState<{ [key: number]: string }>({})
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  
  // Timer state
  const [timeElapsed, setTimeElapsed] = useState(0) // in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)

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

  // Load from localStorage or initialize from session data
  useEffect(() => {
    if (session.exercises) {
      // Try to load from localStorage first
      const savedData = localStorage.getItem(storageKey)
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          // Only use saved data if it's for the same session
          if (parsed.sessionId === session.id) {
            setExercises(parsed.exercises)
            if (parsed.timeElapsed !== undefined) {
              setTimeElapsed(parsed.timeElapsed)
            }
            if (parsed.isRunning !== undefined) {
              setIsRunning(parsed.isRunning)
            }
            if (parsed.startTime !== undefined && parsed.startTime !== null) {
              setStartTime(parsed.startTime)
            }
            return // Don't initialize from session if we loaded from localStorage
          }
        } catch (error) {
          console.error('Error loading from localStorage:', error)
          // Fall through to initialize from session
        }
      }

      // Initialize from session data if no saved data
      const trackedExercises: TrackedExercise[] = (session.exercises || []).map((ex) => ({
        exercise_id: ex.exercise_id,
        exercise_name: ex.exercise_name || 'Unknown Exercise',
        session_exercise_id: ex.id,
        position: ex.position,
        notes: ex.notes,
        sets: (ex.sets || []).map((set) => ({
          id: set.id,
          set_number: set.set_number,
          // Convert numrange to single number for in_progress session (single numbers only)
          // If range [x,y], take lower bound x; if [x,x], take x
          weight: set.weight ? (() => {
            const formatted = formatRangeDisplay(set.weight)
            if (!formatted) return null
            // Extract first number (lower bound) for single number input
            const num = formatted.includes('-') ? parseFloat(formatted.split('-')[0]) : parseFloat(formatted)
            return isNaN(num) ? null : num
          })() : null,
          reps: set.reps ? (() => {
            const formatted = formatRangeDisplay(set.reps)
            if (!formatted) return null
            const num = formatted.includes('-') ? parseInt(formatted.split('-')[0]) : parseInt(formatted)
            return isNaN(num) ? null : num
          })() : null,
          rir: set.rir ? (() => {
            const formatted = formatRangeDisplay(set.rir)
            if (!formatted) return null
            const num = formatted.includes('-') ? parseInt(formatted.split('-')[0]) : parseInt(formatted)
            return isNaN(num) ? null : num
          })() : null,
          rpe: set.rpe ? (() => {
            const formatted = formatRangeDisplay(set.rpe)
            if (!formatted) return null
            const num = formatted.includes('-') ? parseFloat(formatted.split('-')[0]) : parseFloat(formatted)
            return isNaN(num) ? null : num
          })() : null,
          notes: set.notes,
        })),
      }))
      setExercises(trackedExercises)
    }
  }, [session.exercises, session.id, storageKey])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRunning && startTime !== null) {
      interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, startTime])

  const handleStartPause = async () => {
    if (isRunning) {
      setIsRunning(false)
    } else {
      // If this is the first time starting, call onSessionStart to set started_at
      if (!session.started_at && onSessionStart) {
        await onSessionStart()
      }
      // Calculate the offset based on current elapsed time
      const offset = timeElapsed * 1000
      setStartTime(Date.now() - offset)
      setIsRunning(true)
    }
  }

  const handleReset = () => {
    setIsRunning(false)
    setTimeElapsed(0)
    setStartTime(null)
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Save to localStorage whenever exercises change
  useEffect(() => {
    if (exercises.length > 0) {
      const dataToSave = {
        sessionId: session.id,
        exercises,
        timeElapsed,
        isRunning,
        startTime,
      }
      localStorage.setItem(storageKey, JSON.stringify(dataToSave))
    }
  }, [exercises, timeElapsed, isRunning, startTime, session.id, storageKey])

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
          },
        ],
      }
      return updated
    })
  }

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex].sets = updated[exerciseIndex].sets.filter((_, idx) => idx !== setIndex)
      // Re-number sets after removal to keep them sequential
      updated[exerciseIndex].sets = updated[exerciseIndex].sets.map((set, idx) => ({
        ...set,
        set_number: idx + 1,
      }))
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

      let workoutId = session.workout_id

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

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Track Session Workout</h1>
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2">
              <span className="text-2xl font-mono font-semibold text-foreground">
                {formatTime(timeElapsed)}
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={handleStartPause}
                  variant="outline"
                  size="sm"
                  className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border cursor-pointer"
                >
                  {isRunning ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                  className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border cursor-pointer"
                  disabled={timeElapsed === 0}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button
              onClick={onCancel}
              variant="outline"
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border cursor-pointer"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>

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
                </div>

              {/* Sets */}
              <div className="space-y-3">
                <div className="grid grid-cols-8 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b border-border">
                  <div>Set</div>
                  <div>Weight</div>
                  <div>Reps</div>
                  <div>RIR</div>
                  <div>RPE</div>
                  <div>Notes</div>
                  <div></div>
                  <div></div>
                </div>

                {exercise.sets && exercise.sets.length > 0 ? (
                  exercise.sets.map((set, setIndex) => (
                    <div
                      key={setIndex}
                      className="grid grid-cols-8 gap-2 items-center"
                    >
                    <div className="text-sm text-muted-foreground">{set.set_number}</div>
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
                      placeholder="Weight"
                      className="bg-input text-foreground border-border text-xs h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
                      placeholder="Reps"
                      className="bg-input text-foreground border-border text-xs h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
                      placeholder="RIR"
                      className="bg-input text-foreground border-border text-xs h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
                      placeholder="RPE"
                      className="bg-input text-foreground border-border text-xs h-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <Input
                      type="text"
                      value={set.notes || ''}
                      onChange={(e) =>
                        updateSet(exerciseIndex, setIndex, 'notes', e.target.value || null)
                      }
                      placeholder="Notes"
                      className="bg-input text-foreground border-border text-xs h-8"
                    />
                    <div></div>
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

