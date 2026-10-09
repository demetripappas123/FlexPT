'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash } from 'lucide-react'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { fetchUserExercises } from '@/supabase/fetches/fetchuserexercises'
import { fetchCommunityExercises } from '@/supabase/fetches/fetchcommunityexercises'
import { useAuth } from '@/context/authcontext'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { SessionExerciseWithSets, SessionStatus } from '@/supabase/fetches/fetchsessions'
import { parseRangeInput, formatRangeDisplay } from '@/supabase/utils/rangeparse'

type LocalExercise = {
  id?: string // For editing existing exercises
  exercise_id: string
  exercise_name: string
  position: number
  notes: string
  sets: LocalSet[]
}

type LocalSet = {
  id?: string // For editing existing sets
  set_number: number
  weight: number | string | null // Display format: number for single numbers, string for ranges (e.g., "8-12")
  reps: number | string | null // Display format: number for single numbers, string for ranges
  rir: number | string | null // Display format: number for single numbers, string for ranges
  rpe: number | string | null // Display format: number for single numbers, string for ranges
  notes: string | null
}

type EditWorkoutProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId?: string // If provided, we're editing an existing session
  initialExercises?: SessionExerciseWithSets[] // If provided, load these exercises
  sessionStatus?: SessionStatus // Session status to determine if ranges are allowed
  onSave: (data: {
    exercises: LocalExercise[]
    sessionUpdates?: {
      start_time?: string | null
      end_time?: string | null
      workout_id?: string | null
      day_id?: string | null
    }
  }) => Promise<void>
  mode?: 'create' | 'edit' | 'in-progress' // create = new workout, edit = from template/day, in-progress = editing active session
  hideDialog?: boolean // If true, render without Dialog wrapper (for full-screen overlay)
}

export default function EditWorkout({
  open,
  onOpenChange,
  sessionId,
  initialExercises,
  sessionStatus,
  onSave,
  mode = 'create',
  hideDialog = false,
}: EditWorkoutProps) {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<LocalExercise[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<{ id: string; name: string }[]>([])
  const [openCombobox, setOpenCombobox] = useState<{ [key: number]: boolean }>({})
  const [searchValue, setSearchValue] = useState<{ [key: number]: string }>({})
  const [loading, setLoading] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<string>('')
  const [sessionEndTime, setSessionEndTime] = useState<string>('')

  // Helper function to round time to nearest 15-minute interval
  const roundTo15Minutes = (dateTimeString: string): string => {
    if (!dateTimeString) return dateTimeString
    const date = new Date(dateTimeString)
    const minutes = date.getMinutes()
    const roundedMinutes = Math.round(minutes / 15) * 15
    date.setMinutes(roundedMinutes)
    date.setSeconds(0)
    date.setMilliseconds(0)
    // Return in datetime-local format (YYYY-MM-DDTHH:mm)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const mins = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${mins}`
  }

  // Determine if ranges are allowed based on session status
  const allowRanges = sessionStatus !== 'in_progress' && sessionStatus !== 'completed'

  // Reset form when dialog opens or initialExercises change
  useEffect(() => {
    if (open) {
      if (initialExercises && initialExercises.length > 0) {
        // Load existing exercises
        const mappedExercises: LocalExercise[] = initialExercises.map((ex, idx) => ({
          id: ex.id,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name || '',
          position: ex.position,
          notes: ex.notes || '',
          sets: (ex.sets || []).map((set) => {
            // If ranges allowed, keep as string (range format), otherwise convert to single number
            return {
              id: set.id,
              set_number: set.set_number,
              weight: set.weight ? (() => {
                const formatted = formatRangeDisplay(set.weight)
                if (!formatted) return null
                if (allowRanges) {
                  // Return as string for text input (e.g., "8" or "8-12")
                  return formatted
                } else {
                  // Return as number for number input (single number only)
                  const num = formatted.includes('-') ? parseFloat(formatted.split('-')[0]) : parseFloat(formatted)
                  return isNaN(num) ? null : num
                }
              })() : null,
              reps: set.reps ? (() => {
                const formatted = formatRangeDisplay(set.reps)
                if (!formatted) return null
                if (allowRanges) {
                  return formatted
                } else {
                  const num = formatted.includes('-') ? parseInt(formatted.split('-')[0]) : parseInt(formatted)
                  return isNaN(num) ? null : num
                }
              })() : null,
              rir: set.rir ? (() => {
                const formatted = formatRangeDisplay(set.rir)
                if (!formatted) return null
                if (allowRanges) {
                  return formatted
                } else {
                  const num = formatted.includes('-') ? parseInt(formatted.split('-')[0]) : parseInt(formatted)
                  return isNaN(num) ? null : num
                }
              })() : null,
              rpe: set.rpe ? (() => {
                const formatted = formatRangeDisplay(set.rpe)
                if (!formatted) return null
                if (allowRanges) {
                  return formatted
                } else {
                  const num = formatted.includes('-') ? parseFloat(formatted.split('-')[0]) : parseFloat(formatted)
                  return isNaN(num) ? null : num
                }
              })() : null,
              notes: set.notes,
            }
          }),
        }))
        setExercises(mappedExercises)
      } else {
        // Start fresh
        setExercises([])
      }
      setOpenCombobox({})
      setSearchValue({})
    }
  }, [open, initialExercises])

  // Fetch exercise library when dialog opens (includes base, user, and community exercises)
  useEffect(() => {
    const loadLibrary = async () => {
      if (!open) {
        setExerciseLibrary([]) // Clear when dialog closes
        return
      }
      console.log('Loading exercise library...')
      try {
        // Fetch all exercise types in parallel
        const [baseExercises, userExercises, communityExercises] = await Promise.all([
          fetchExercises(),
          fetchUserExercises(user?.id),
          fetchCommunityExercises()
        ])
        
        // Combine all exercises into a single array
        const allExercises = [
          ...baseExercises.map(ex => ({ id: ex.id, name: ex.name })),
          ...userExercises.map(ex => ({ id: ex.id, name: ex.name })),
          ...communityExercises.map(ex => ({ id: ex.id, name: ex.name }))
        ]
        
        // Remove duplicates by id (in case same exercise exists in multiple sources)
        const uniqueExercises = Array.from(
          new Map(allExercises.map(ex => [ex.id, ex])).values()
        ).sort((a, b) => a.name.localeCompare(b.name))
        
        console.log('Exercise library fetched:', {
          base: baseExercises.length,
          user: userExercises.length,
          community: communityExercises.length,
          total: uniqueExercises.length
        })
        
        if (uniqueExercises.length > 0) {
          setExerciseLibrary(uniqueExercises)
          console.log('Exercise library set successfully')
        } else {
          console.warn('Exercise library is empty')
          setExerciseLibrary([])
        }
      } catch (err) {
        console.error('Failed to fetch exercises:', err)
        setExerciseLibrary([]) // Reset to empty array on error
      }
    }
    loadLibrary()
  }, [open, user?.id])

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        exercise_id: '',
        exercise_name: '',
        position: prev.length,
        notes: '',
        sets: [],
      },
    ])
  }

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index).map((ex, i) => ({
      ...ex,
      position: i, // Ensure positions are renumbered starting from 0
    })))
  }

  const updateExercise = <K extends keyof LocalExercise>(
    index: number,
    key: K,
    value: LocalExercise[K]
  ) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, [key]: value } : ex)))
  }

  const addSet = (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex]
    const newSetNumber = exercise.sets.length > 0
      ? Math.max(...exercise.sets.map((s) => s.set_number)) + 1
      : 1

    const newSet: LocalSet = {
      set_number: newSetNumber,
      weight: null,
      reps: null,
      rir: null,
      rpe: null,
      notes: null,
    }

    const updated = [...exercises]
    updated[exerciseIndex].sets = [...exercise.sets, newSet]
    setExercises(updated)
  }

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const updated = [...exercises]
    updated[exerciseIndex].sets = updated[exerciseIndex].sets.filter((_, i) => i !== setIndex)
    // Re-number sets after removal to keep them sequential
    updated[exerciseIndex].sets = updated[exerciseIndex].sets.map((set, idx) => ({
      ...set,
      set_number: idx + 1,
    }))
    setExercises(updated)
  }

  const updateSet = <K extends keyof LocalSet>(
    exerciseIndex: number,
    setIndex: number,
    key: K,
    value: LocalSet[K]
  ) => {
    const updated = [...exercises]
    updated[exerciseIndex].sets[setIndex] = {
      ...updated[exerciseIndex].sets[setIndex],
      [key]: value,
    }
    setExercises(updated)
  }

  // Helper function to get the next input field
  const getNextInput = (exerciseIndex: number, setIndex: number, fieldIndex: number, direction: 'next' | 'prev'): HTMLElement | null => {
    const fieldOrder = ['weight', 'reps', 'rir', 'rpe', 'notes'] as const
    const currentExercise = exercises[exerciseIndex]
    if (!currentExercise) return null

    let nextFieldIndex = fieldIndex
    let nextSetIndex = setIndex
    let nextExerciseIndex = exerciseIndex

    if (direction === 'next') {
      nextFieldIndex++
      // If we've passed the last field (notes), move to next set
      if (nextFieldIndex >= fieldOrder.length) {
        nextFieldIndex = 0
        nextSetIndex++
        // If we've passed the last set, move to next exercise's first set
        if (nextSetIndex >= currentExercise.sets.length) {
          nextSetIndex = 0
          nextExerciseIndex++
          // If we've passed the last exercise, wrap to first
          if (nextExerciseIndex >= exercises.length) {
            nextExerciseIndex = 0
          }
        }
      }
    } else {
      nextFieldIndex--
      // If we've gone before the first field (weight), move to previous set
      if (nextFieldIndex < 0) {
        nextFieldIndex = fieldOrder.length - 1
        nextSetIndex--
        // If we've gone before the first set, move to previous exercise's last set
        if (nextSetIndex < 0) {
          nextExerciseIndex--
          // If we've gone before the first exercise, wrap to last
          if (nextExerciseIndex < 0) {
            nextExerciseIndex = exercises.length - 1
          }
          const prevExercise = exercises[nextExerciseIndex]
          nextSetIndex = prevExercise && prevExercise.sets.length > 0 ? prevExercise.sets.length - 1 : 0
        }
      }
    }

    const nextExercise = exercises[nextExerciseIndex]
    if (!nextExercise || !nextExercise.sets[nextSetIndex]) return null

    // Find the input element by data attributes
    const fieldName = fieldOrder[nextFieldIndex]
    const inputId = `input-${nextExerciseIndex}-${nextSetIndex}-${fieldName}`
    return document.getElementById(inputId) as HTMLElement
  }

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    exerciseIndex: number,
    setIndex: number,
    fieldName: 'weight' | 'reps' | 'rir' | 'rpe' | 'notes'
  ) => {
    const fieldOrder = ['weight', 'reps', 'rir', 'rpe', 'notes'] as const
    const fieldIndex = fieldOrder.indexOf(fieldName)

    // Handle Tab or Arrow keys
    if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (e.key === 'Tab' && e.shiftKey) {
        // Shift+Tab goes to previous field
        e.preventDefault()
        const prevInput = getNextInput(exerciseIndex, setIndex, fieldIndex, 'prev')
        if (prevInput) {
          prevInput.focus()
          if (prevInput instanceof HTMLInputElement) {
            prevInput.select()
          }
        }
      } else if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        // Tab, ArrowRight, or ArrowDown goes to next field
        e.preventDefault()
        const nextInput = getNextInput(exerciseIndex, setIndex, fieldIndex, 'next')
        if (nextInput) {
          nextInput.focus()
          if (nextInput instanceof HTMLInputElement) {
            nextInput.select()
          }
        }
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      // ArrowLeft or ArrowUp goes to previous field
      e.preventDefault()
      const prevInput = getNextInput(exerciseIndex, setIndex, fieldIndex, 'prev')
      if (prevInput) {
        prevInput.focus()
        if (prevInput instanceof HTMLInputElement) {
          prevInput.select()
        }
      }
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Validate that all exercises have valid exercise_id
      const exercisesWithoutId = exercises.filter(ex => !ex.exercise_id || ex.exercise_id.trim() === '')
      if (exercisesWithoutId.length > 0) {
        alert(`Please select an exercise for all exercise entries. ${exercisesWithoutId.length} exercise(s) are missing a selection.`)
        setLoading(false)
        return
      }

      // Ensure all exercises have correct positions (0-indexed)
      const exercisesWithPositions = exercises.map((ex, index) => ({
        ...ex,
        position: index, // Force position to match array index
      }))
      
      await onSave({
        exercises: exercisesWithPositions,
        sessionUpdates: mode === 'in-progress' ? {
          start_time: sessionStartTime || null,
          end_time: sessionEndTime || null,
        } : undefined,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving workout:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const content = (
    <>
      {!hideDialog && (
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'create' && 'Assign Workout'}
            {mode === 'edit' && 'Edit Workout'}
            {mode === 'in-progress' && 'Edit Session Workout'}
          </DialogTitle>
        </DialogHeader>
      )}

        {/* Session timing (only for in-progress mode) */}
        {mode === 'in-progress' && (
          <div className="mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-white">Start Time</label>
                <Input
                  type="datetime-local"
                  step="900"
                  value={sessionStartTime}
                  onChange={(e) => {
                    const roundedTime = roundTo15Minutes(e.target.value)
                    setSessionStartTime(roundedTime)
                  }}
                  className="bg-[#111111] text-white border-[#2a2a2a]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-white">End Time</label>
                <Input
                  type="datetime-local"
                  step="900"
                  value={sessionEndTime}
                  onChange={(e) => {
                    const roundedTime = roundTo15Minutes(e.target.value)
                    setSessionEndTime(roundedTime)
                  }}
                  className="bg-[#111111] text-white border-[#2a2a2a]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Exercises - Compact layout matching display UI */}
        <div className="space-y-3 mt-4">
          {exercises.map((ex, index) => (
            <div key={index} className="bg-[#1a1a1a] rounded-md p-3 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 relative">
                  <div className="relative inline-block">
                    <span className="text-md font-medium text-white mr-1">{index + 1}.</span>
                    <Input
                      value={ex.exercise_name || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        updateExercise(index, 'exercise_name', value)
                        setSearchValue((prev) => ({ ...prev, [index]: value }))
                        if (exerciseLibrary.length > 0) {
                          setOpenCombobox((prev) => ({ ...prev, [index]: true }))
                        }
                      }}
                      onFocus={() => {
                        if (exerciseLibrary.length > 0) {
                          setOpenCombobox((prev) => ({ ...prev, [index]: true }))
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setOpenCombobox((prev) => ({ ...prev, [index]: false }))
                        }, 200)
                      }}
                      placeholder="Exercise name..."
                      className="bg-transparent border-none text-md font-medium text-white p-0 h-auto w-auto inline-block focus:ring-0 focus-visible:ring-0 min-w-[200px]"
                    />
                    {openCombobox[index] && (
                      <div
                        className="absolute z-50 w-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-md shadow-lg"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <Command className="bg-[#111111] text-white">
                          <CommandInput
                            value={searchValue[index] || ex.exercise_name || ''}
                            onValueChange={(value) => {
                              setSearchValue((prev) => ({ ...prev, [index]: value }))
                              updateExercise(index, 'exercise_name', value)
                            }}
                            placeholder="Search exercises..."
                            className="bg-[#111111] text-white border-[#2a2a2a]"
                          />
                          <CommandList className="max-h-[200px] overflow-y-auto bg-[#111111]">
                            <CommandEmpty className="text-gray-400 py-4 text-center">No exercises found.</CommandEmpty>
                            <CommandGroup className="bg-[#111111]">
                              {exerciseLibrary.length > 0 ? (
                                exerciseLibrary
                                  .filter((exercise) => {
                                    const search = (searchValue[index] || ex.exercise_name || '').toLowerCase()
                                    return search === '' || exercise.name.toLowerCase().includes(search)
                                  })
                                  .map((exercise) => (
                                    <CommandItem
                                      key={exercise.id}
                                      value={exercise.name}
                                      onSelect={() => {
                                        updateExercise(index, 'exercise_name', exercise.name)
                                        updateExercise(index, 'exercise_id', exercise.id)
                                        setSearchValue((prev) => ({ ...prev, [index]: exercise.name }))
                                        setOpenCombobox((prev) => ({ ...prev, [index]: false }))
                                      }}
                                      className="text-white hover:bg-[#2a2a2a] cursor-pointer bg-[#111111]"
                                    >
                                      {exercise.name}
                                    </CommandItem>
                                  ))
                              ) : (
                                <div className="text-gray-400 py-2 px-4 text-sm">Loading exercises...</div>
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={ex.notes || ''}
                    onChange={(e) => updateExercise(index, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="bg-transparent border-none text-xs text-gray-400 p-0 h-auto w-32 focus:ring-0"
                  />
                  <button
                    onClick={() => removeExercise(index)}
                    className="p-1 text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              {ex.sets && ex.sets.length > 0 && (
                <div className="space-y-1">
                  <div className="grid grid-cols-6 gap-2 text-xs font-semibold text-gray-400 pb-1 border-b border-[#2a2a2a]">
                    <div>Set</div>
                    <div>Weight</div>
                    <div>Reps</div>
                    <div>RIR</div>
                    <div>RPE</div>
                    <div>Notes</div>
                  </div>
                  {ex.sets.map((set, setIdx) => (
                    <div key={setIdx} className="group grid grid-cols-6 gap-2 text-xs items-center">
                      <div className="text-gray-300">{set.set_number}</div>
                      <Input
                        id={`input-${index}-${setIdx}-weight`}
                        type={allowRanges ? "text" : "number"}
                        step={allowRanges ? undefined : "0.01"}
                        value={set.weight ?? ''}
                        onChange={(e) => {
                          if (allowRanges) {
                            // For ranges, store as string (e.g., "8" or "8-12")
                            updateSet(index, setIdx, 'weight', e.target.value || null)
                          } else {
                            // For single numbers, store as number
                            updateSet(index, setIdx, 'weight', e.target.value ? parseFloat(e.target.value) : null)
                          }
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index, setIdx, 'weight')}
                        placeholder={allowRanges ? "e.g. 8 or 8-12" : "-"}
                        className="bg-transparent border-none text-gray-300 p-0 h-6 text-xs focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <Input
                        id={`input-${index}-${setIdx}-reps`}
                        type={allowRanges ? "text" : "number"}
                        value={set.reps ?? ''}
                        onChange={(e) => {
                          if (allowRanges) {
                            updateSet(index, setIdx, 'reps', e.target.value || null)
                          } else {
                            updateSet(index, setIdx, 'reps', e.target.value ? parseInt(e.target.value) : null)
                          }
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index, setIdx, 'reps')}
                        placeholder={allowRanges ? "e.g. 8 or 8-12" : "-"}
                        className="bg-transparent border-none text-gray-300 p-0 h-6 text-xs focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <Input
                        id={`input-${index}-${setIdx}-rir`}
                        type={allowRanges ? "text" : "number"}
                        value={set.rir ?? ''}
                        onChange={(e) => {
                          if (allowRanges) {
                            updateSet(index, setIdx, 'rir', e.target.value || null)
                          } else {
                            updateSet(index, setIdx, 'rir', e.target.value ? parseInt(e.target.value) : null)
                          }
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index, setIdx, 'rir')}
                        placeholder={allowRanges ? "e.g. 2 or 1-3" : "-"}
                        className="bg-transparent border-none text-gray-300 p-0 h-6 text-xs focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <Input
                        id={`input-${index}-${setIdx}-rpe`}
                        type={allowRanges ? "text" : "number"}
                        step={allowRanges ? undefined : "0.5"}
                        value={set.rpe ?? ''}
                        onChange={(e) => {
                          if (allowRanges) {
                            updateSet(index, setIdx, 'rpe', e.target.value || null)
                          } else {
                            updateSet(index, setIdx, 'rpe', e.target.value ? parseFloat(e.target.value) : null)
                          }
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index, setIdx, 'rpe')}
                        placeholder={allowRanges ? "e.g. 7 or 6-8" : "-"}
                        className="bg-transparent border-none text-gray-300 p-0 h-6 text-xs focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          id={`input-${index}-${setIdx}-notes`}
                          type="text"
                          value={set.notes ?? ''}
                          onChange={(e) => updateSet(index, setIdx, 'notes', e.target.value || null)}
                          onKeyDown={(e) => handleKeyDown(e, index, setIdx, 'notes')}
                          placeholder="-"
                          className="bg-transparent border-none text-gray-300 p-0 h-6 text-xs truncate flex-1 focus:ring-0"
                        />
                        <button
                          onClick={() => removeSet(index, setIdx)}
                          className="p-0.5 text-red-400 hover:text-red-300 cursor-pointer"
                          title="Remove set"
                        >
                          <Trash size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Add Set Button - shown when sets exist */}
                  <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
                    <Button
                      onClick={() => addSet(index)}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2 text-gray-400 hover:text-white cursor-pointer w-full"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Set
                    </Button>
                  </div>
                </div>
              )}
              {ex.sets.length === 0 && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">No sets</span>
                  <Button
                    onClick={() => addSet(index)}
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2 text-gray-400 hover:text-white cursor-pointer"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Set
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Add exercise button */}
          <Button
            onClick={addExercise}
            variant="outline"
            className="w-full border-[#2a2a2a] bg-[#333333] text-white hover:bg-[#404040] hover:text-white flex items-center justify-center gap-2 cursor-pointer text-sm py-2"
          >
            <Plus size={16} /> Add Exercise
          </Button>
        </div>

      {!hideDialog && (
        <DialogFooter>
          <Button
            className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
            onClick={handleSave}
            disabled={loading || exercises.length === 0}
          >
            {loading ? 'Saving...' : mode === 'create' ? 'Assign Workout' : 'Save Workout'}
          </Button>
        </DialogFooter>
      )}
      {hideDialog && (
        <div className="mt-6">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
            onClick={handleSave}
            disabled={loading || exercises.length === 0}
          >
            {loading ? 'Saving...' : mode === 'create' ? 'Assign Workout' : 'Save Workout'}
          </Button>
        </div>
      )}
    </>
  )

  if (hideDialog) {
    return <div className="space-y-6" style={{ overflow: 'visible' }}>{content}</div>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-[#1f1f1f] border-[#2a2a2a] text-white custom-scrollbar">
        {content}
      </DialogContent>
    </Dialog>
  )
}
