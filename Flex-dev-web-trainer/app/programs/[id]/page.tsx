'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/supabase/supabaseClient'
import { upsertWeek } from '@/supabase/upserts/upsertweek'
import { fetchWeeks, Week } from '@/supabase/fetches/fetchweek'
import DeleteWeekDialog from '@/modules/programs/deleteweek'
import DeleteDayDialog from '@/modules/programs/deleteday'
import { TrashIcon } from '@heroicons/react/24/solid'
import { Plus, ChevronRight, ChevronLeft } from 'lucide-react'
import { addDay, updateDay } from '@/supabase/upserts/upsertday'
import { upsertDayExercises, updateDayExercises, DayExercise } from '@/supabase/upserts/upsertexercises'
import { fetchExercises } from '@/supabase/fetches/fetchexlib'
import { fetchDayExercises, DayExerciseWithName } from '@/supabase/fetches/fetchdayexercises'
import { parseRangeInput, formatRangeDisplay } from '@/supabase/utils/rangeparse'
import AddDayDialog from '@/modules/programs/adddaydialog'
import ProgramChat from '@/modules/programs/programchat'

type Program = {
  id: string
  name: string
  description?: string | null
}

export default function ProgramPage() {
  const params = useParams()
  const router = useRouter()

  const [program, setProgram] = useState<Program | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  // Store exercises by day_id
  const [dayExercises, setDayExercises] = useState<Record<string, DayExerciseWithName[]>>({})

  // For controlling the AddDayDialog per week
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null)
  // For controlling edit mode - stores the day being edited
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  // For controlling AI editor visibility
  const [aiEditorExpanded, setAiEditorExpanded] = useState(true)

  const refreshWeeks = async () => {
    const programId = params.id
    if (!programId) return

    try {
      const weeksData = await fetchWeeks(programId as string)
      setWeeks(weeksData)

      // Fetch exercises for all days
      const allDayIds = weeksData.flatMap(week => week.days.map(day => day.id))
      const exercisesMap: Record<string, DayExerciseWithName[]> = {}

      // Fetch exercises for each day in parallel
      const exercisePromises = allDayIds.map(async (dayId) => {
        const exercises = await fetchDayExercises(dayId)
        exercisesMap[dayId] = exercises
      })

      await Promise.all(exercisePromises)
      setDayExercises(exercisesMap)
    } catch (err) {
      console.error('Failed to fetch weeks:', err)
    }
  }

  useEffect(() => {
    const loadProgram = async () => {
      const programId = params.id
      if (!programId) return setLoading(false)

      setLoading(true)
      try {
        const { data: programData, error: programError } = await supabase
          .from('programs')
          .select('*')
          .eq('id', programId)
          .single()

        if (programError) {
          console.error('Error loading program:', programError)
          setProgram(null)
        } else {
          setProgram(programData)
        }

        await refreshWeeks()
      } catch (err) {
        console.error('Unexpected error loading program:', err)
        setProgram(null)
        setWeeks([])
      } finally {
        setLoading(false)
      }
    }

    loadProgram()
  }, [params.id])

  const handleAddWeek = async () => {
    if (!program) return

    try {
      const savedWeek = await upsertWeek({ program_id: program.id })
      setWeeks(prev => [...prev, savedWeek])
    } catch (err) {
      console.error('Failed to add week:', err)
    }
  }

  // Submit a new day with exercises OR update an existing day
  const handleAddDaySubmit = async (payload: { dayName: string; exercises: any[]; dayId?: string }) => {
    const isEditMode = !!payload.dayId

    try {
      let dayId: string

      if (isEditMode) {
        // EDIT MODE: Update existing day
        if (!payload.dayId) return

        // 1. Update the day name
        const updatedDay = await updateDay(payload.dayId, payload.dayName)
        if (!updatedDay) {
          throw new Error('Failed to update day')
        }
        dayId = updatedDay.id
      } else {
        // ADD MODE: Create new day
        if (!activeWeekId) return

        // 1. Create the day and get its ID
        const newDay = await addDay(activeWeekId, payload.dayName)
        if (!newDay) {
          throw new Error('Failed to create day')
        }
        dayId = newDay.id
      }

      // 2. Fetch exercise library to map exercise names to IDs
      const exerciseLibrary = await fetchExercises()

      // 3. Map exercises to DayExercise format
      const mappedExercises: DayExercise[] = payload.exercises
        .filter(ex => ex.name.trim() !== '') // Only include exercises with names
        .map((ex, index) => {
          // Find exercise_id by matching name in exercise library
          const exercise = exerciseLibrary.find(e => e.name === ex.name)
          if (!exercise) {
            throw new Error(`Exercise "${ex.name}" not found in library`)
          }

          return {
            day_id: dayId,
            exercise_def_id: exercise.id,
            sets: ex.sets && ex.sets.trim() ? parseRangeInput(ex.sets) ?? null : null,
            reps: ex.reps && ex.reps.trim() ? parseRangeInput(ex.reps) ?? null : null,
            rir: ex.rir && ex.rir.trim() ? parseRangeInput(ex.rir) ?? null : null,
            rpe: ex.rpe && ex.rpe.trim() ? parseRangeInput(ex.rpe) ?? null : null,
            notes: ex.notes || '',
            weight_used: ex.weight && ex.weight.trim() ? parseRangeInput(ex.weight) ?? null : null,
            exercise_number: index + 1, // Set exercise_number based on array position
          }
        })

      // 4. Update or insert exercises based on mode
      if (isEditMode) {
        // Use smart update that only modifies changed exercises
        await updateDayExercises(dayId, mappedExercises)
      } else {
        // Insert new exercises
        if (mappedExercises.length > 0) {
          await upsertDayExercises(mappedExercises)
        }
      }

      // 5. Refresh weeks to show the updated/new day
      await refreshWeeks()
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'add'} day:`, err)
    } finally {
      setActiveWeekId(null) // close the dialog
      setEditingDayId(null) // clear editing state
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading program...</p>
  if (!program) return <p className="text-muted-foreground">Program not found.</p>

  return (
    <div className="p-6 bg-background min-h-screen text-foreground">
      {/* Header Section */}
      <div className="space-y-4 mb-6">
        <button
          onClick={() => router.back()}
          className="px-3 py-1 bg-muted rounded-md hover:bg-muted/80 text-foreground"
        >
          ← Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{program.name}</h1>
            {program.description && (
              <p className="text-muted-foreground">{program.description}</p>
            )}
          </div>
          
          <div className="flex justify-start items-center gap-2">
            <button
              onClick={() => setAiEditorExpanded(!aiEditorExpanded)}
              className="flex items-center justify-center p-2 bg-muted rounded-md hover:bg-muted/80 cursor-pointer text-foreground"
              title={aiEditorExpanded ? "Collapse AI Editor" : "Expand AI Editor"}
            >
              {aiEditorExpanded ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={handleAddWeek}
              className="flex items-center gap-2 px-4 py-2 bg-primary rounded-md hover:bg-primary/90 cursor-pointer text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              <span>Add Week</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Program and Chat side by side */}
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Left side - Program content */}
        <div className={`${aiEditorExpanded ? 'flex-1' : 'flex-1'} space-y-4 overflow-y-auto`}>
          <div className="space-y-4">
        {weeks.length === 0 && (
          <p className="text-muted-foreground">No weeks yet. Add one!</p>
        )}

        {weeks.map(week => (
          <div
            key={week.id}
            className="flex items-start justify-between p-4 bg-card border border-border rounded-md"
          >
            <div className="flex-1">
              <p className="text-foreground font-semibold mb-2">Week {week.number}</p>

              <div className="flex gap-2 flex-wrap items-start justify-between">
                <div className="flex gap-2 flex-wrap items-start">
                  {week.days.map(day => (
                    <div
                      key={day.id}
                      className="p-3 border border-border rounded-md bg-background min-w-[200px] relative"
                    >
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          onClick={() => setEditingDayId(day.id)}
                          className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                          title="Edit day"
                        >
                          ✎
                        </button>
                        <DeleteDayDialog
                          dayId={day.id}
                          dayName={day.name}
                          onDeleted={refreshWeeks}
                        >
                          <TrashIcon className="w-4 h-4 text-destructive hover:text-destructive/80 cursor-pointer" />
                        </DeleteDayDialog>
                      </div>
                      <div className="font-semibold text-foreground mb-2">{day.name}</div>
                      {dayExercises[day.id] && dayExercises[day.id].length > 0 ? (
                        <div className="space-y-1">
                          {dayExercises[day.id].map((exercise, idx) => (
                            <div
                              key={idx}
                              className="text-sm text-muted-foreground border-l-2 border-primary pl-2"
                            >
                              <div className="font-medium text-foreground">{exercise.exercise_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatRangeDisplay(exercise.sets) || "—"}×{formatRangeDisplay(exercise.reps) || "—"}
                                {exercise.weight_used && ` @ ${formatRangeDisplay(exercise.weight_used) || exercise.weight_used}lbs`}
                                {exercise.rir !== null && ` (RIR: ${formatRangeDisplay(exercise.rir) || "—"})`}
                                {exercise.rpe !== null && ` (RPE: ${formatRangeDisplay(exercise.rpe) || "—"})`}
                              </div>
                              {exercise.notes && (
                                <div className="text-xs text-muted-foreground italic mt-1">{exercise.notes}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No exercises</div>
                      )}
                    </div>
                  ))}

                  {/* Add Day button */}
                  <button
                    className="p-2 border border-dashed border-border rounded-md text-muted-foreground cursor-pointer flex items-center justify-center hover:bg-muted"
                    onClick={() => setActiveWeekId(week.id)}
                  >
                    + Add Day
                  </button>

                  {/* Controlled Dialog for Add */}
                  <AddDayDialog
                    open={activeWeekId === week.id && !editingDayId}
                    onClose={() => setActiveWeekId(null)}
                    weekId={week.id}
                    onAdded={refreshWeeks}
                    onSubmit={handleAddDaySubmit}
                  />
                </div>

                <DeleteWeekDialog
                  weekId={week.id}
                  weekNumber={week.number}
                  onDeleted={refreshWeeks}
                >
                  <TrashIcon className="w-6 h-6 text-destructive hover:text-destructive/80 cursor-pointer" />
                </DeleteWeekDialog>
              </div>

              {/* Controlled Dialog for Edit - check if any day in this week is being edited */}
              {week.days.map(day => (
                <AddDayDialog
                  key={`edit-${day.id}`}
                  open={editingDayId === day.id}
                  onClose={() => setEditingDayId(null)}
                  weekId={week.id}
                  onAdded={refreshWeeks}
                  onSubmit={handleAddDaySubmit}
                  dayId={day.id}
                  initialDayName={day.name}
                />
              ))}
            </div>
          </div>
        ))}
          </div>
        </div>

        {/* Right side - Chat UI */}
        {aiEditorExpanded && (
          <div className="w-96 flex-shrink-0">
            <ProgramChat 
              programId={program.id} 
              programName={program.name}
              onProgramUpdated={refreshWeeks}
            />
          </div>
        )}
      </div>
    </div>
  )
}
