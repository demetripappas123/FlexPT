'use client'

import React, { useMemo, useState } from 'react'
import { WorkoutWithData } from '@/supabase/fetches/fetchpersonworkoutswithdata'
import { ChevronLeft, ChevronRight, Check, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateWorkout } from '@/supabase/upserts/upsertworkout'

type WorkoutCalendarProps = {
  workouts: WorkoutWithData[]
  onWorkoutUpdate: () => void
  onWorkoutClick: (workout: WorkoutWithData) => void
  onDateClick?: (date: Date) => void // Optional callback for clicking on empty dates
}

export default function WorkoutCalendar({ workouts, onWorkoutUpdate, onWorkoutClick, onDateClick }: WorkoutCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start of current week (Monday)
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  // Get the 7 days of the current week
  const weekDays = useMemo(() => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(date.getDate() + i)
      days.push(date)
    }
    return days
  }, [currentWeekStart])

  // Group workouts by date
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, WorkoutWithData[]>()
    
    workouts.forEach(workout => {
      // Use workout_date if available, otherwise use created_at date
      const workoutDate = workout.workout_date 
        ? new Date(workout.workout_date)
        : new Date(workout.created_at)
      
      const dateKey = workoutDate.toISOString().split('T')[0] // YYYY-MM-DD
      
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(workout)
    })
    
    return map
  }, [workouts])

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeekStart(newDate)
  }

  const goToCurrentWeek = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  const handleCompleteWorkout = async (workoutId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updateWorkout(workoutId, { completed: true })
      onWorkoutUpdate()
    } catch (err) {
      console.error('Error completing workout:', err)
      alert('Error completing workout. Please try again.')
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isPast = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  return (
    <div className="w-full">
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          onClick={() => navigateWeek('prev')}
          variant="outline"
          className="bg-card border-border text-foreground hover:bg-muted cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-foreground">
            {weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
            {weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <Button
            onClick={goToCurrentWeek}
            variant="outline"
            className="bg-card border-border text-foreground hover:bg-muted text-sm cursor-pointer"
          >
            Today
          </Button>
        </div>
        
        <Button
          onClick={() => navigateWeek('next')}
          variant="outline"
          className="bg-card border-border text-foreground hover:bg-muted cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
          <div
            key={day}
            className="text-center font-semibold text-muted-foreground pb-2 border-b border-border"
          >
            <div className="text-xs">{day}</div>
            <div className="text-sm text-foreground mt-1">{formatDate(weekDays[idx])}</div>
          </div>
        ))}

        {/* Day Cells */}
        {weekDays.map((date, idx) => {
          const dateKey = date.toISOString().split('T')[0]
          const dayWorkouts = workoutsByDate.get(dateKey) || []
          const today = isToday(date)
          const past = isPast(date)

          return (
            <div
              key={dateKey}
              className={`min-h-[120px] p-2 border border-border rounded-md ${
                today ? 'bg-card border-primary/50' : 'bg-background'
              } ${past ? 'opacity-60' : ''} ${onDateClick ? 'cursor-pointer hover:bg-card transition-colors' : ''}`}
              onClick={() => {
                // If there are no workouts on this date and onDateClick is provided, trigger it
                if (dayWorkouts.length === 0 && onDateClick) {
                  onDateClick(date)
                }
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                  {date.getDate()}
                </span>
                {today && <span className="text-xs text-primary font-semibold">Today</span>}
              </div>

              <div className="space-y-1">
                {dayWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    onClick={() => onWorkoutClick(workout)}
                    className={`p-1.5 rounded text-xs cursor-pointer transition-colors ${
                      workout.completed
                        ? 'bg-green-600/20 border border-green-600/50 text-green-400 hover:bg-green-600/30'
                        : 'bg-orange-600/20 border border-orange-600/50 text-orange-400 hover:bg-orange-600/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {workout.completed ? '✓' : '○'} Workout
                      </span>
                      {!workout.completed && (
                        <button
                          onClick={(e) => handleCompleteWorkout(workout.id, e)}
                          className="ml-1 p-0.5 hover:bg-green-600/30 rounded"
                          title="Mark as completed"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {workout.exercises && workout.exercises.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ))}
                {dayWorkouts.length === 0 && onDateClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDateClick(date)
                    }}
                    className="w-full p-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-1"
                    title="Click to assign workout from program"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Assign Workout</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

