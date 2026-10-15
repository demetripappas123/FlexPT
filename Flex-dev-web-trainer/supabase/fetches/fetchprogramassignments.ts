import { supabase } from '@/supabase/supabaseClient'

export type ProgramAssignmentStatus = 'planned' | 'active' | 'completed' | 'archived'
export type ProgramGoalKind = 'qualitative' | 'bodyweight' | 'body_comp' | 'lift' | 'other'

export const PROGRAM_ASSIGNMENT_STATUS_LABEL: Record<ProgramAssignmentStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
}

export const PROGRAM_GOAL_KIND_LABEL: Record<ProgramGoalKind, string> = {
  qualitative: 'Qualitative',
  bodyweight: 'Bodyweight',
  body_comp: 'Body composition',
  lift: 'Lift',
  other: 'Other',
}

export type ProgramAssignment = {
  id: string
  person_id: string
  trainer_id: string | null
  name: string
  source_program_id: string | null
  source_nutrition_program_id: string | null
  start_date: string
  status: ProgramAssignmentStatus
  kickoff_form_id: string | null
  checkin_form_id: string | null
  habit_form_id: string | null
  created_at: string
  updated_at: string
}

export type ProgramGoal = {
  id: string
  assignment_id: string
  person_id: string
  kind: ProgramGoalKind
  label: string
  notes: string | null
  baseline_value: number | null
  target_value: number | null
  current_value: number | null
  unit: string | null
  created_at: string
  updated_at: string
}

function mapAssignment(row: ProgramAssignment): ProgramAssignment {
  return {
    ...row,
    status: (['planned', 'active', 'completed', 'archived'] as ProgramAssignmentStatus[]).includes(
      row.status
    )
      ? row.status
      : 'active',
  }
}

export async function fetchProgramAssignments(personId: string): Promise<ProgramAssignment[]> {
  const { data, error } = await supabase
    .from('program_assignments')
    .select('*')
    .eq('person_id', personId)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching program assignments:', error)
    throw error
  }

  return (data ?? []).map(mapAssignment)
}

export async function fetchProgramGoals(assignmentId: string): Promise<ProgramGoal[]> {
  const { data, error } = await supabase
    .from('program_goals')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching program goals:', error)
    throw error
  }

  return (data ?? []) as ProgramGoal[]
}
