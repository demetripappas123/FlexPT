'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { WorkoutWithData } from '@/supabase/fetches/fetchpersonworkoutswithdata'
import {
  canScheduleSessionOnWorkout,
  workoutDeliveryLabel,
} from '@/supabase/utils/workoutDelivery'

export function WorkoutDeliveryBadge({ workout }: { workout: WorkoutWithData }) {
  return (
    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-foreground">
      {workoutDeliveryLabel(workout)}
    </span>
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
      variant="outline"
      disabled={disabled}
      title={disabled ? 'No session units remaining. Record a payment first.' : 'Book this assigned workout as a coached session'}
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return
        onSchedule(workout)
      }}
      className={`h-8 text-xs cursor-pointer ${disabled ? 'opacity-60' : ''}`}
    >
      {disabled ? 'No session units' : 'Schedule session'}
    </Button>
  )
}
