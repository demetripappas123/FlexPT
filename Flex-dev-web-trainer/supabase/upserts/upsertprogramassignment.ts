import { supabase } from '@/supabase/supabaseClient'
import {
  ProgramAssignment,
  ProgramAssignmentStatus,
  ProgramGoal,
  ProgramGoalKind,
} from '@/supabase/fetches/fetchprogramassignments'

export type ProgramAssignmentInput = {
  id?: string
  person_id: string
  trainer_id?: string | null
  name: string
  source_program_id?: string | null
  source_nutrition_program_id?: string | null
  start_date: string
  status?: ProgramAssignmentStatus
  kickoff_form_id?: string | null
  checkin_form_id?: string | null
  habit_form_id?: string | null
}

export async function upsertProgramAssignment(
  input: ProgramAssignmentInput
): Promise<ProgramAssignment> {
  const row = {
    person_id: input.person_id,
    trainer_id: input.trainer_id ?? null,
    name: input.name.trim(),
    source_program_id: input.source_program_id ?? null,
    source_nutrition_program_id: input.source_nutrition_program_id ?? null,
    start_date: input.start_date,
    status: input.status ?? 'active',
    kickoff_form_id: input.kickoff_form_id ?? null,
    checkin_form_id: input.checkin_form_id ?? null,
    habit_form_id: input.habit_form_id ?? null,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('program_assignments')
      .update(row)
      .eq('id', input.id)
      .select()
      .single()
    if (error) throw error
    return data as ProgramAssignment
  }

  const { data, error } = await supabase.from('program_assignments').insert([row]).select().single()
  if (error) throw error
  return data as ProgramAssignment
}

export async function updateProgramAssignmentStatus(
  assignmentId: string,
  status: ProgramAssignmentStatus
): Promise<void> {
  const { error } = await supabase
    .from('program_assignments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
  if (error) throw error
}

export type ProgramGoalInput = {
  id?: string
  assignment_id: string
  person_id: string
  kind: ProgramGoalKind
  label: string
  notes?: string | null
  baseline_value?: number | null
  target_value?: number | null
  current_value?: number | null
  unit?: string | null
}

export async function upsertProgramGoal(input: ProgramGoalInput): Promise<ProgramGoal> {
  const row = {
    assignment_id: input.assignment_id,
    person_id: input.person_id,
    kind: input.kind,
    label: input.label.trim(),
    notes: input.notes?.trim() || null,
    baseline_value: input.baseline_value ?? null,
    target_value: input.target_value ?? null,
    current_value: input.current_value ?? null,
    unit: input.unit?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('program_goals')
      .update(row)
      .eq('id', input.id)
      .select()
      .single()
    if (error) throw error
    return data as ProgramGoal
  }

  const { data, error } = await supabase.from('program_goals').insert([row]).select().single()
  if (error) throw error
  return data as ProgramGoal
}

export async function deleteProgramGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('program_goals').delete().eq('id', goalId)
  if (error) throw error
}
