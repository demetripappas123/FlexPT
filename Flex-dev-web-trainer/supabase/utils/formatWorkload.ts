import { formatRangeDisplay } from '@/supabase/utils/rangeparse'

export function formatAssignedLine(input: {
  prescribed_weight?: string | null
  prescribed_reps?: string | null
  prescribed_sets?: string | null
  prescribed_rpe?: string | null
  prescribed_rir?: string | null
}): string | null {
  const weight = formatRangeDisplay(input.prescribed_weight)
  const sets = formatRangeDisplay(input.prescribed_sets)
  const reps = formatRangeDisplay(input.prescribed_reps)
  const rpe = formatRangeDisplay(input.prescribed_rpe)
  const rir = formatRangeDisplay(input.prescribed_rir)

  const parts: string[] = []
  if (weight) parts.push(weight)
  if (rpe) parts.push(`RPE ${rpe}`)
  if (rir) parts.push(`RIR ${rir}`)
  if (sets && reps) parts.push(`${sets}×${reps}`)
  else if (sets) parts.push(`${sets} sets`)
  else if (reps) parts.push(`${reps} reps`)

  return parts.length > 0 ? parts.join(', ') : null
}

export function formatLoggedSetLine(input: {
  weight?: string | null
  reps?: string | null
  rpe?: string | null
  rir?: string | null
}): string | null {
  const weight = formatRangeDisplay(input.weight)
  const reps = formatRangeDisplay(input.reps)
  const rpe = formatRangeDisplay(input.rpe)
  const rir = formatRangeDisplay(input.rir)
  if (!weight && !reps && !rpe && !rir) return null
  const parts: string[] = []
  if (weight) parts.push(weight)
  if (rpe) parts.push(`RPE ${rpe}`)
  if (rir) parts.push(`RIR ${rir}`)
  if (reps) parts.push(reps)
  return parts.join(', ')
}

export function formatAssignedMealFood(food: {
  prescribed_food_name?: string | null
  prescribed_amount?: number | null
  prescribed_unit?: string | null
  food_name?: string | null
}): string | null {
  const name = food.prescribed_food_name || food.food_name
  if (!name && food.prescribed_amount == null) return null
  const amount = food.prescribed_amount != null ? String(food.prescribed_amount) : ''
  const unit = food.prescribed_unit || ''
  return `${name || 'Food'} ${amount} ${unit}`.trim()
}

export function formatEatenMealFood(food: {
  food_name?: string | null
  amount?: number | null
  unit?: string | null
  prescribed_food_name?: string | null
}): string | null {
  if (food.amount == null && !food.unit && !food.food_name) return null
  const name = food.food_name || food.prescribed_food_name || 'Food'
  const amount = food.amount != null ? String(food.amount) : ''
  const unit = food.unit || ''
  return `${name} ${amount} ${unit}`.trim()
}
