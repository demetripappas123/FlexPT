'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import EditWorkout from './editworkout'
import { upsertSession, upsertSessionExercise, upsertExerciseSet, upsertWorkoutExercises, upsertExerciseSets } from '@/supabase/upserts/upsertsession'
import { upsertWorkout } from '@/supabase/upserts/upsertworkout'
import { SessionType } from '@/supabase/fetches/fetchsessions'
import { fetchPrograms } from '@/supabase/fetches/fetchprograms'
import { Program } from '@/supabase/upserts/upsertprogram'
import { fetchWeeks, Week, Day } from '@/supabase/fetches/fetchweek'
import { fetchDayExercises } from '@/supabase/fetches/fetchdayexercises'
import { formatRangeDisplay } from '@/supabase/utils/rangeparse'
import { useAuth } from '@/context/authcontext'

type WorkoutOption = 'create' | 'program' | 'existing' | null

type AssignWorkoutProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  sessionType?: SessionType
  personId?: string | null
  initialOption?: WorkoutOption
}

export default function AssignWorkout({ 
  open, 
  onOpenChange, 
  sessionId,
  sessionType,
  personId,
  initialOption = null,
}: AssignWorkoutProps) {
  const { user } = useAuth()
  const [selectedOption, setSelectedOption] = useState<WorkoutOption>(null)
  const [showWorkoutEditor, setShowWorkoutEditor] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [loadingPrograms, setLoadingPrograms] = useState(false)
  const [loadingDays, setLoadingDays] = useState(false)

  const handleOptionSelect = (option: WorkoutOption) => {
    if (option === 'create') {
      // Close assign dialog and open workout editor
      setShowWorkoutEditor(true)
      onOpenChange(false)
    } else {
      setSelectedOption(option)
    }
  }

  const handleCancel = () => {
    setSelectedOption(null)
    setSelectedProgramId(null)
    setWeeks([])
    setSelectedDayId(null)
    onOpenChange(false)
  }

  useEffect(() => {
    if (!open) return
    if (initialOption === 'create' || initialOption === 'program') {
      handleOptionSelect(initialOption)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialOption])

  // Fetch programs when 'program' option is selected
  useEffect(() => {
    if (selectedOption === 'program' && open && user?.id) {
      const loadPrograms = async () => {
        setLoadingPrograms(true)
        try {
          const fetchedPrograms = await fetchPrograms(user.id)
          setPrograms(fetchedPrograms)
        } catch (error) {
          console.error('Error fetching programs:', error)
          setPrograms([])
        } finally {
          setLoadingPrograms(false)
        }
      }
      loadPrograms()
    }
  }, [selectedOption, open, user?.id])

  // Fetch weeks when a program is selected
  useEffect(() => {
    if (selectedProgramId && user?.id) {
      const loadWeeks = async () => {
        setLoadingDays(true)
        try {
          const fetchedWeeks = await fetchWeeks(selectedProgramId, user.id)
          console.log('Fetched weeks:', fetchedWeeks)
          console.log('Total days across all weeks:', fetchedWeeks.reduce((acc, week) => acc + week.days.length, 0))
          setWeeks(fetchedWeeks)
        } catch (error) {
          console.error('Error fetching weeks:', error)
          setWeeks([])
        } finally {
          setLoadingDays(false)
        }
      }
      loadWeeks()
    } else {
      setWeeks([])
      setSelectedDayId(null)
    }
  }, [selectedProgramId, user?.id])

  // Handle program day selection and create workout
  const handleAssignProgramDay = async () => {
    if (!selectedDayId || !personId) {
      alert('Please select a day')
      return
    }

    try {
      setLoadingDays(true)

      // Fetch exercises for the selected day
      const dayExercises = await fetchDayExercises(selectedDayId, user?.id || null)

      // Create workout with day_id
      const workout = await upsertWorkout({
        person_id: personId,
        day_id: selectedDayId,
      })

      // Update session with workout_id
      await upsertSession({
        id: sessionId,
        person_id: personId,
        trainer_id: user?.id || null,
        type: sessionType || 'Client Session',
        workout_id: workout.id,
        converted: false,
      })

      // Create workout exercises from day exercises
      if (dayExercises.length > 0) {
        const exerciseData = dayExercises.map((ex, index) => ({
          exercise_id: ex.exercise_def_id,
          position: index,
          notes: ex.notes || null,
        }))

        const createdExercises = await upsertWorkoutExercises(workout.id, exerciseData)

        // Create sets for each exercise based on the sets range from day exercise
        for (let i = 0; i < dayExercises.length; i++) {
          const dayExercise = dayExercises[i]
          const createdExercise = createdExercises[i]
          
          if (createdExercise && createdExercise.id) {
            // Parse the sets range to determine number of sets
            // Sets range is in PostgreSQL numrange format like "[3,4]" or "(3,4]" etc
            let numSets = 3 // Default to 3 sets if no range specified
            
            if (dayExercise.sets) {
              // Parse the range using the utility function to get display format (e.g., "3-4" or "3")
              const formattedRange = formatRangeDisplay(dayExercise.sets)
              
              if (formattedRange) {
                // If it's a range like "3-4", take the upper bound
                if (formattedRange.includes('-')) {
                  const parts = formattedRange.split('-')
                  const upper = parseInt(parts[1]?.trim() || '', 10)
                  if (!isNaN(upper)) {
                    numSets = upper
                  }
                } else {
                  // Single number like "3"
                  const num = parseInt(formattedRange.trim(), 10)
                  if (!isNaN(num)) {
                    numSets = num
                  }
                }
              }
            }

            // Parse reps, rir, rpe, and weight ranges to get default values for sets
            // Extract the lower bound from each range to use as the default value for all sets
            // Each set needs individual values, not ranges
            const getValueFromRange = (range: string | null | undefined): string | null => {
              if (!range) return null
              
              // Format the range to get display format (e.g., "8" or "8-12")
              const formatted = formatRangeDisplay(range)
              if (!formatted) return null
              
              // If it's a range like "8-12", use the lower bound "8"
              // If it's a single value like "8", use that
              if (formatted.includes('-')) {
                const lower = formatted.split('-')[0]?.trim()
                // Convert single number to numrange format [x,x]
                if (lower) {
                  const num = parseFloat(lower)
                  if (!isNaN(num)) {
                    return `[${Math.round(num)},${Math.round(num)}]`
                  }
                }
              } else {
                // Single value - convert to numrange format [x,x]
                const num = parseFloat(formatted.trim())
                if (!isNaN(num)) {
                  return `[${Math.round(num)},${Math.round(num)}]`
                }
              }
              
              return null
            }

            // Extract values from ranges - each set gets the lower bound as its value
            const defaultWeight = getValueFromRange(dayExercise.weight_used)
            const defaultReps = getValueFromRange(dayExercise.reps)
            const defaultRIR = getValueFromRange(dayExercise.rir)
            const defaultRPE = getValueFromRange(dayExercise.rpe)

            // Create sets with individual values extracted from day exercise ranges
            // Each set gets the same default value (lower bound of range, or single value)
            const setData = Array.from({ length: numSets }, (_, index) => ({
              set_number: index + 1,
              weight: defaultWeight,
              reps: defaultReps,
              rir: defaultRIR,
              rpe: defaultRPE,
              notes: dayExercise.notes || null,
            }))

            // Create the sets
            await upsertExerciseSets(createdExercise.id, setData)
          }
        }
      }

      console.log('Program day workout assigned successfully!')
      handleCancel()
      // Trigger a reload by closing and reopening if needed
      onOpenChange(false)
    } catch (error) {
      console.error('Error assigning program day workout:', error)
      alert('Error assigning workout. Please try again.')
    } finally {
      setLoadingDays(false)
    }
  }

  // Get all days from all weeks
  const allDays: (Day & { programId: string; weekNumber: number })[] = weeks.flatMap(week =>
    week.days.map(day => ({
      ...day,
      programId: week.program_id,
      weekNumber: week.number,
    }))
  )

  const handleWorkoutSave = async (data: {
    exercises: any[]
    sessionUpdates?: {
      start_time?: string | null
      end_time?: string | null
      day_id?: string | null
    }
  }) => {
    try {
      if (!personId) {
        throw new Error('Person ID is required to assign a workout')
      }

      // Step 1: Create the workout first
      const workout = await upsertWorkout({
        person_id: personId,
        day_id: data.sessionUpdates?.day_id ?? null,
      })

      // Step 2: Update the session with workout_id
      const session = await upsertSession({
        id: sessionId,
        person_id: personId,
        trainer_id: user?.id || null,
        type: sessionType || 'Client Session',
        workout_id: workout.id,
        start_time: data.sessionUpdates?.start_time ?? null,
        end_time: data.sessionUpdates?.end_time ?? null,
        converted: false,
      })

      // Step 3: Create session exercises and sets immediately (now using workout_id)
      // Use smart update function to handle exercises
      const exerciseData = data.exercises.map((ex, index) => ({
        exercise_id: ex.exercise_id,
        position: index,
        notes: ex.notes || null,
      }))

      // Upsert exercises using smart update
      const createdExercises = await upsertWorkoutExercises(workout.id, exerciseData)

      // Create sets for each exercise
      for (let i = 0; i < data.exercises.length; i++) {
        const exercise = data.exercises[i]
        const createdExercise = createdExercises[i]
        
        if (createdExercise && createdExercise.id && exercise.sets && exercise.sets.length > 0) {
          const setData = exercise.sets.map((set) => ({
            set_number: set.set_number,
            weight: set.weight ?? null,
            reps: set.reps ?? null,
            rir: set.rir ?? null,
            rpe: set.rpe ?? null,
            notes: set.notes ?? null,
          }))

          // Use smart update for sets
          await upsertExerciseSets(createdExercise.id, setData)
        }
      }

      console.log('Workout assigned successfully!')
      setShowWorkoutEditor(false)
      onOpenChange(false) // Close the assign dialog as well
    } catch (error) {
      console.error('Error assigning workout:', error)
      alert('Error assigning workout. Please try again.')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Assign Workout to Session{sessionType ? ` - ${sessionType}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!selectedOption ? (
            // Initial selection screen
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm mb-4">
                Choose how you'd like to assign a workout:
              </p>
              
              <Button
                onClick={() => handleOptionSelect('create')}
                variant="outline"
                className="w-full justify-start text-left h-auto bg-background hover:bg-muted text-foreground border-border cursor-pointer p-4"
              >
                <div className="flex flex-col items-start w-full">
                  <span className="font-semibold text-foreground text-base">Create New Workout</span>
                  <span className="text-xs text-muted-foreground mt-1.5">
                    Build a custom workout from scratch
                  </span>
                </div>
              </Button>

              <Button
                onClick={() => handleOptionSelect('program')}
                variant="outline"
                className="w-full justify-start text-left h-auto bg-background hover:bg-muted text-foreground border-border cursor-pointer p-4"
              >
                <div className="flex flex-col items-start w-full">
                  <span className="font-semibold text-foreground text-base">Choose from Program</span>
                  <span className="text-xs text-muted-foreground mt-1.5">
                    Select a workout from an existing program
                  </span>
                </div>
              </Button>
            </div>
          ) : (
            // Selected option view
            <div className="space-y-4">
              {/* Back button */}
              <Button
                onClick={() => setSelectedOption(null)}
                variant="ghost"
                className="text-muted-foreground hover:text-foreground cursor-pointer p-0 h-auto"
              >
                ← Back
              </Button>

              {/* Create New Workout - This should not render here since we close the dialog */}
              {selectedOption === 'create' && (
                <div className="space-y-4">
                  <div className="bg-background border border-border rounded-md p-4">
                    <h3 className="text-foreground font-semibold mb-4">Create New Workout</h3>
                    <div className="space-y-3 text-muted-foreground text-sm">
                      <p>Opening workout editor...</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Choose from Program */}
              {selectedOption === 'program' && (
                <div className="space-y-4">
                  <div className="bg-background border border-border rounded-md p-4">
                    <h3 className="text-foreground font-semibold mb-4">Select from Program</h3>
                    
                    {loadingPrograms ? (
                      <div className="text-muted-foreground text-sm">Loading programs...</div>
                    ) : programs.length === 0 ? (
                      <div className="text-muted-foreground text-sm">
                        <p>No programs available.</p>
                        <p className="text-xs mt-2">Create a program first to assign workouts from it.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Program Selection */}
                        {!selectedProgramId ? (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">
                              Select a Program:
                            </label>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {programs.map((program) => (
                                <Button
                                  key={program.id}
                                  onClick={() => setSelectedProgramId(program.id)}
                                  variant="outline"
                                  className="w-full justify-start text-left h-auto bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer p-3"
                                >
                                  <span className="font-medium">{program.name}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Back to program selection */}
                            <Button
                              onClick={() => {
                                setSelectedProgramId(null)
                                setSelectedDayId(null)
                              }}
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground cursor-pointer p-0 h-auto text-sm"
                            >
                              ← Back to Programs
                            </Button>

                            {/* Day Selection */}
                            {loadingDays ? (
                              <div className="text-muted-foreground text-sm">Loading days...</div>
                            ) : loadingDays ? (
                              <div className="text-muted-foreground text-sm">Loading days...</div>
                            ) : allDays.length === 0 ? (
                              <div className="text-muted-foreground text-sm">
                                <p>No days available in this program.</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground mb-2">
                                  Select a Day:
                                </label>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {allDays.map((day) => (
                                    <Button
                                      key={day.id}
                                      onClick={() => setSelectedDayId(day.id)}
                                      variant={selectedDayId === day.id ? "default" : "outline"}
                                      className={`w-full justify-start text-left h-auto cursor-pointer p-3 ${
                                        selectedDayId === day.id
                                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                          : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                                      }`}
                                    >
                                      <div className="flex flex-col items-start w-full">
                                        <span className="font-medium">{day.name}</span>
                                        <span className="text-xs opacity-75 mt-0.5">
                                          Week {day.weekNumber}
                                        </span>
                                      </div>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer"
                  disabled={loadingDays}
                >
                  Cancel
                </Button>
                {selectedOption === 'program' && selectedDayId ? (
                  <Button
                    onClick={handleAssignProgramDay}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                    disabled={loadingDays}
                  >
                    {loadingDays ? 'Assigning...' : 'Assign Workout'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      // Placeholder for other assign actions
                      console.log('Assign workout:', selectedOption)
                      handleCancel()
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                    disabled={selectedOption === 'program' && !selectedDayId}
                  >
                    Assign Workout
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Workout Editor Dialog - opens when "Create New Workout" is selected */}
    <EditWorkout
      open={showWorkoutEditor}
      onOpenChange={(open) => {
        setShowWorkoutEditor(open)
        if (!open) {
          // If editor closes, optionally reopen the assign dialog
          // onOpenChange(true)
        }
      }}
      onSave={handleWorkoutSave}
      mode="create"
    />
    </>
  )
}

