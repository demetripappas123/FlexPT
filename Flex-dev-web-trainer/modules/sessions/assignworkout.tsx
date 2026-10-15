'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import EditWorkout from './editworkout'
import { upsertSession, upsertWorkoutExercises, upsertExerciseSets } from '@/supabase/upserts/upsertsession'
import { upsertWorkout, updateWorkout } from '@/supabase/upserts/upsertworkout'
import { SessionType } from '@/supabase/fetches/fetchsessions'
import { fetchPersonWorkoutsWithData, WorkoutWithData } from '@/supabase/fetches/fetchpersonworkoutswithdata'
import { fetchProgramAssignments, ProgramAssignment } from '@/supabase/fetches/fetchprogramassignments'
import { isActiveSession, workoutDeliveryLabel } from '@/supabase/utils/workoutDelivery'
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

function dateKey(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDay(value: string) {
  if (!value) return 'No date'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
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
  const [assignments, setAssignments] = useState<ProgramAssignment[]>([])
  const [assignedWorkouts, setAssignedWorkouts] = useState<WorkoutWithData[]>([])
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
  const [loadingProgram, setLoadingProgram] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const handleOptionSelect = (option: WorkoutOption) => {
    if (option === 'create') {
      setShowWorkoutEditor(true)
      onOpenChange(false)
    } else {
      setSelectedOption(option)
    }
  }

  const handleCancel = () => {
    setSelectedOption(null)
    setSelectedWorkoutId(null)
    onOpenChange(false)
  }

  useEffect(() => {
    if (!open) return
    if (initialOption === 'create' || initialOption === 'program') {
      handleOptionSelect(initialOption)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialOption])

  useEffect(() => {
    if (selectedOption !== 'program' || !open || !personId) return
    const load = async () => {
      setLoadingProgram(true)
      try {
        const [rows, workouts] = await Promise.all([
          fetchProgramAssignments(personId),
          fetchPersonWorkoutsWithData(personId),
        ])
        setAssignments(rows)
        setAssignedWorkouts(workouts.filter((workout) => Boolean(workout.assignment_id)))
      } catch (error) {
        console.error('Error loading assigned program workouts:', error)
        setAssignments([])
        setAssignedWorkouts([])
      } finally {
        setLoadingProgram(false)
      }
    }
    load()
  }, [selectedOption, open, personId])

  const grouped = useMemo(() => {
    return assignments
      .map((assignment) => {
        const workouts = assignedWorkouts
          .filter((workout) => workout.assignment_id === assignment.id)
          .sort((a, b) => {
            const week = (a.week_number || 0) - (b.week_number || 0)
            if (week !== 0) return week
            return dateKey(a.workout_date).localeCompare(dateKey(b.workout_date))
          })
        return { assignment, workouts }
      })
      .filter((group) => group.workouts.length > 0)
  }, [assignments, assignedWorkouts])

  const handleAssignAssignedWorkout = async () => {
    if (!selectedWorkoutId || !personId) {
      alert('Please select a workout from the client program')
      return
    }

    const selected = assignedWorkouts.find((workout) => workout.id === selectedWorkoutId)
    if (selected && isActiveSession(selected.session) && selected.session?.id !== sessionId) {
      alert('That workout is already booked on another session.')
      return
    }

    try {
      setAssigning(true)
      await upsertSession({
        id: sessionId,
        person_id: personId,
        trainer_id: user?.id || null,
        type: sessionType || 'Client Session',
        workout_id: selectedWorkoutId,
        converted: false,
      })
      await updateWorkout(selectedWorkoutId, { delivery: 'session' })
      handleCancel()
      onOpenChange(false)
    } catch (error) {
      console.error('Error assigning program workout:', error)
      alert('Error assigning workout. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

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

      const workout = await upsertWorkout({
        person_id: personId,
        day_id: data.sessionUpdates?.day_id ?? null,
        delivery: 'session',
      })

      await upsertSession({
        id: sessionId,
        person_id: personId,
        trainer_id: user?.id || null,
        type: sessionType || 'Client Session',
        workout_id: workout.id,
        start_time: data.sessionUpdates?.start_time ?? null,
        end_time: data.sessionUpdates?.end_time ?? null,
        converted: false,
      })

      const exerciseData = data.exercises.map((ex, index) => ({
        exercise_id: ex.exercise_id,
        position: index,
        notes: ex.notes || null,
      }))

      const createdExercises = await upsertWorkoutExercises(workout.id, exerciseData)

      for (let i = 0; i < data.exercises.length; i++) {
        const exercise = data.exercises[i]
        const createdExercise = createdExercises[i]

        if (createdExercise && createdExercise.id && exercise.sets && exercise.sets.length > 0) {
          const setData = exercise.sets.map((set: any) => ({
            set_number: set.set_number,
            weight: set.weight ?? null,
            reps: set.reps ?? null,
            rir: set.rir ?? null,
            rpe: set.rpe ?? null,
            notes: set.notes ?? null,
          }))
          await upsertExerciseSets(createdExercise.id, setData)
        }
      }

      setShowWorkoutEditor(false)
      onOpenChange(false)
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
                    Attach a workout already assigned on this client's program
                  </span>
                </div>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                onClick={() => setSelectedOption(null)}
                variant="ghost"
                className="text-muted-foreground hover:text-foreground cursor-pointer p-0 h-auto"
              >
                ← Back
              </Button>

              {selectedOption === 'program' && (
                <div className="space-y-4">
                  <div className="bg-background border border-border rounded-md p-4">
                    <h3 className="text-foreground font-semibold mb-4">Client program workouts</h3>

                    {loadingProgram ? (
                      <div className="text-muted-foreground text-sm">Loading assigned workouts...</div>
                    ) : grouped.length === 0 ? (
                      <div className="text-muted-foreground text-sm">
                        <p>No assigned program workouts for this client.</p>
                        <p className="text-xs mt-2">
                          Assign a program on the client Program tab first, then attach one of those workouts here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-80 overflow-y-auto">
                        {grouped.map(({ assignment, workouts }) => (
                          <div key={assignment.id} className="space-y-2">
                            <p className="text-sm font-medium text-foreground">{assignment.name}</p>
                            {workouts.map((workout) => {
                              const bookedElsewhere =
                                isActiveSession(workout.session) && workout.session?.id !== sessionId
                              const selected = selectedWorkoutId === workout.id
                              return (
                                <Button
                                  key={workout.id}
                                  onClick={() => {
                                    if (bookedElsewhere) return
                                    setSelectedWorkoutId(workout.id)
                                  }}
                                  disabled={bookedElsewhere}
                                  variant={selected ? 'default' : 'outline'}
                                  className={`w-full justify-start text-left h-auto cursor-pointer p-3 ${
                                    selected
                                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                      : bookedElsewhere
                                        ? 'opacity-60'
                                        : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                                  }`}
                                >
                                  <div className="flex flex-col items-start w-full">
                                    <span className="font-medium">
                                      {workout.day_name || 'Workout'}
                                      {workout.week_number ? ` · Week ${workout.week_number}` : ''}
                                    </span>
                                    <span className="text-xs opacity-75 mt-0.5">
                                      {formatDay(dateKey(workout.workout_date))} · {workoutDeliveryLabel(workout)}
                                      {bookedElsewhere ? ' · already on another session' : ''}
                                    </span>
                                  </div>
                                </Button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer"
                  disabled={assigning}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignAssignedWorkout}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                  disabled={assigning || selectedOption !== 'program' || !selectedWorkoutId}
                >
                  {assigning ? 'Assigning...' : 'Assign Workout'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <EditWorkout
      open={showWorkoutEditor}
      onOpenChange={(open) => {
        setShowWorkoutEditor(open)
      }}
      onSave={handleWorkoutSave}
      mode="create"
    />
    </>
  )
}
