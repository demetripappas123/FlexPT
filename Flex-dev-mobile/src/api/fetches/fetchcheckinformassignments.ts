import { supabase } from '@/src/api/supabase'
import { CheckinFieldType, CheckinFormPurpose } from '@/src/api/fetches/fetchcheckinforms'

export type CheckinAssignmentStatus = 'assigned' | 'completed'

export type CheckinAssignmentField = {
  id: string
  assignment_id: string
  source_field_id: string | null
  label: string
  field_type: CheckinFieldType
  required: boolean
  position: number
}

export type CheckinAssignmentAnswer = {
  id: string
  assignment_id: string
  field_id: string
  value_text: string | null
}

export type CheckinFormAssignment = {
  id: string
  person_id: string
  trainer_id: string | null
  form_id: string | null
  name: string
  description: string | null
  purpose: CheckinFormPurpose
  assigned_date: string
  status: CheckinAssignmentStatus
  completed_at: string | null
  completed_by: string | null
  program_assignment_id?: string | null
  created_at?: string
  updated_at?: string
  fields?: CheckinAssignmentField[]
  answers?: CheckinAssignmentAnswer[]
}

function mapAssignment(row: CheckinFormAssignment): CheckinFormAssignment {
  return {
    ...row,
    status: row.status === 'completed' ? 'completed' : 'assigned',
    purpose: row.purpose ?? 'checkin',
  }
}

export async function fetchCheckinFormAssignments(personId: string): Promise<CheckinFormAssignment[]> {
  const { data, error } = await supabase
    .from('checkin_form_assignments')
    .select('*')
    .eq('person_id', personId)
    .order('assigned_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching assigned check-in forms:', error)
    throw error
  }

  return (data ?? []).map(mapAssignment)
}

export async function fetchCheckinFormAssignmentWithData(
  assignmentId: string
): Promise<CheckinFormAssignment | null> {
  const { data: assignment, error: assignmentError } = await supabase
    .from('checkin_form_assignments')
    .select('*')
    .eq('id', assignmentId)
    .single()

  if (assignmentError) {
    if (assignmentError.code === 'PGRST116') return null
    console.error('Error fetching check-in assignment:', assignmentError)
    throw assignmentError
  }

  const [{ data: fields, error: fieldsError }, { data: answers, error: answersError }] = await Promise.all([
    supabase
      .from('checkin_form_assignment_fields')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('position', { ascending: true }),
    supabase
      .from('checkin_form_answers')
      .select('*')
      .eq('assignment_id', assignmentId),
  ])

  if (fieldsError) {
    console.error('Error fetching assignment fields:', fieldsError)
    throw fieldsError
  }
  if (answersError) {
    console.error('Error fetching assignment answers:', answersError)
    throw answersError
  }

  return {
    ...mapAssignment(assignment),
    fields: fields ?? [],
    answers: answers ?? [],
  }
}
