'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchPrograms } from '@/supabase/fetches/fetchprograms'
import { Program } from '@/supabase/upserts/upsertprogram'
import { fetchWeeks, Week, Day } from '@/supabase/fetches/fetchweek'
import { copyProgramDayToWorkout } from '@/supabase/utils/copyProgramDayToWorkout'
import { useAuth } from '@/context/authcontext'

type AssignProgramWorkoutProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: string
  onWorkoutAssigned: () => void
  initialDate?: string // Optional initial date (for calendar view)
}

export default function AssignProgramWorkout({
  open,
  onOpenChange,
  personId,
  onWorkoutAssigned,
  initialDate,
}: AssignProgramWorkoutProps) {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [workoutDate, setWorkoutDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  )
  const [loadingPrograms, setLoadingPrograms] = useState(false)
  const [loadingWeeks, setLoadingWeeks] = useState(false)
  const [assigning, setAssigning] = useState(false)

  // Fetch programs when dialog opens
  useEffect(() => {
    if (open && user?.id) {
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
  }, [open, user?.id])

  // Fetch weeks when a program is selected
  useEffect(() => {
    if (selectedProgramId && user?.id) {
      const loadWeeks = async () => {
        setLoadingWeeks(true)
        try {
          const fetchedWeeks = await fetchWeeks(selectedProgramId, user.id)
          setWeeks(fetchedWeeks)
        } catch (error) {
          console.error('Error fetching weeks:', error)
          setWeeks([])
        } finally {
          setLoadingWeeks(false)
        }
      }
      loadWeeks()
    } else {
      setWeeks([])
      setSelectedDayId(null)
    }
  }, [selectedProgramId, user?.id])

  // Update workout date when initialDate changes
  useEffect(() => {
    if (initialDate) {
      setWorkoutDate(initialDate)
    }
  }, [initialDate])

  // Get all days from all weeks
  const allDays: (Day & { programId: string; weekNumber: number; weekId: string })[] = weeks.flatMap(week =>
    week.days.map(day => ({
      ...day,
      programId: week.program_id,
      weekNumber: week.number,
      weekId: week.id,
    }))
  )

  const handleAssign = async () => {
    if (!selectedDayId || !workoutDate) {
      alert('Please select a day and workout date')
      return
    }

    try {
      setAssigning(true)
      const selectedDay = allDays.find((day) => day.id === selectedDayId)
      await copyProgramDayToWorkout({
        personId,
        trainerId: user?.id || null,
        dayId: selectedDayId,
        workoutDate,
        weekNumber: selectedDay?.weekNumber ?? null,
        dayName: selectedDay?.name ?? null,
        delivery: selectedDay?.delivery === 'session' ? 'session' : 'solo',
      })
      onWorkoutAssigned()
      onOpenChange(false)
      
      // Reset form
      setSelectedProgramId(null)
      setSelectedDayId(null)
      setWeeks([])
    } catch (error) {
      console.error('Error assigning program workout:', error)
      alert('Error assigning workout. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  const handleCancel = () => {
    setSelectedProgramId(null)
    setSelectedDayId(null)
    setWeeks([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-card-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Assign Workout from Program</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workout Date */}
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Workout Date *
            </label>
            <Input
              type="date"
              value={workoutDate}
              onChange={(e) => setWorkoutDate(e.target.value)}
              className="bg-background text-foreground border-border cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:invert"
              required
            />
          </div>

          {/* Program Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-muted-foreground">
              Select Program *
            </label>
            {loadingPrograms ? (
              <p className="text-muted-foreground text-sm">Loading programs...</p>
            ) : programs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No programs found. Create a program first.</p>
            ) : (
              <select
                value={selectedProgramId || ''}
                onChange={(e) => {
                  setSelectedProgramId(e.target.value || null)
                  setSelectedDayId(null)
                }}
                className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 cursor-pointer"
              >
                <option value="">-- Select a program --</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Week and Day Selection */}
          {selectedProgramId && (
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">
                Select Day *
              </label>
              {loadingWeeks ? (
                <p className="text-muted-foreground text-sm">Loading weeks...</p>
              ) : allDays.length === 0 ? (
                <p className="text-muted-foreground text-sm">No days found in this program.</p>
              ) : (
                <select
                  value={selectedDayId || ''}
                  onChange={(e) => setSelectedDayId(e.target.value || null)}
                  className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 cursor-pointer"
                >
                  <option value="">-- Select a day --</option>
                  {allDays.map((day) => (
                    <option key={day.id} value={day.id}>
                      Week {day.weekNumber} - {day.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedDayId || !workoutDate || assigning}
            className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assigning ? 'Assigning...' : 'Assign Workout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

