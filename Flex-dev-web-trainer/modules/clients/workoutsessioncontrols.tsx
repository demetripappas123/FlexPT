'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { WorkoutWithData } from '@/supabase/fetches/fetchpersonworkoutswithdata'
import { updateWorkout } from '@/supabase/upserts/upsertworkout'
import {
  WorkoutDelivery,
  canScheduleSessionOnWorkout,
  workoutDelivery,
  workoutDeliveryLabel,
} from '@/supabase/utils/workoutDelivery'

export function WorkoutDeliveryBadge({ workout }: { workout: WorkoutWithData }) {
  const delivery = workoutDelivery(workout)
  const className =
    delivery === 'session'
      ? 'bg-violet-600/20 text-violet-300 border-violet-500/50'
      : 'bg-slate-600/20 text-slate-300 border-slate-500/50'
  return (
    <span className={`px-2 py-0.5 text-[11px] rounded border ${className}`}>
      {workoutDeliveryLabel(workout)}
    </span>
  )
}

export function WorkoutDeliveryToggle({
  workout,
  onChanged,
}: {
  workout: WorkoutWithData
  onChanged: () => void
}) {
  const delivery = workoutDelivery(workout)
  const setDelivery = async (next: WorkoutDelivery) => {
    if (next === delivery) return
    try {
      await updateWorkout(workout.id, { delivery: next })
      onChanged()
    } catch (err) {
      console.error('Error updating workout delivery:', err)
      alert('Could not update session vs solo')
    }
  }
  return (
    <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setDelivery('session')
        }}
        className={`px-2 py-1 cursor-pointer ${
          delivery === 'session'
            ? 'bg-violet-600 text-white'
            : 'bg-background text-muted-foreground hover:text-foreground'
        }`}
      >
        Session
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setDelivery('solo')
        }}
        className={`px-2 py-1 cursor-pointer ${
          delivery === 'solo'
            ? 'bg-slate-500 text-white'
            : 'bg-background text-muted-foreground hover:text-foreground'
        }`}
      >
        Solo
      </button>
    </div>
  )
}

export function ScheduleSessionButton({
  workout,
  remainingUnits,
  onSchedule,
}: {
  workout: WorkoutWithData
  remainingUnits: number
  onSchedule: (workout: WorkoutWithData) => void
}) {
  if (!canScheduleSessionOnWorkout(workout)) return null
  const disabled = remainingUnits <= 0
  return (
    <Button
      type="button"
      size="sm"
      variant={disabled ? 'outline' : 'default'}
      disabled={disabled}
      title={disabled ? 'No session units remaining. Record a payment first.' : 'Book this assigned workout as a coached session'}
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return
        onSchedule(workout)
      }}
      className={`h-7 text-xs cursor-pointer ${
        disabled
          ? 'opacity-60'
          : 'bg-violet-600 hover:bg-violet-500 text-white'
      }`}
    >
      {disabled ? 'No session units' : 'Schedule session'}
    </Button>
  )
}
