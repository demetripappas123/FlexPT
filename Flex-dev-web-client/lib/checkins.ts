import { supabase } from './supabase'

export type CheckinFieldType = 'text' | 'long_text' | 'number' | 'scale' | 'yes_no'
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
  assigned_date: string
  status: CheckinAssignmentStatus
  completed_at: string | null
  completed_by: string | null
  created_at?: string
  updated_at?: string
  fields?: CheckinAssignmentField[]
  answers?: CheckinAssignmentAnswer[]
}

function mapAssignment(row: CheckinFormAssignment): CheckinFormAssignment {
  return {
    ...row,
    status: row.status === 'completed' ? 'completed' : 'assigned',
  }
}

export async function listCheckinAssignments(personId: string): Promise<CheckinFormAssignment[]> {
  const { data, error } = await supabase
    .from('checkin_form_assignments')
    .select('*')
    .eq('person_id', personId)
    .order('assigned_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapAssignment)
}

export async function getCheckinAssignment(assignmentId: string): Promise<CheckinFormAssignment | null> {
  const { data: assignment, error: assignmentError } = await supabase
    .from('checkin_form_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle()

  if (assignmentError) throw assignmentError
  if (!assignment) return null

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

  if (fieldsError) throw fieldsError
  if (answersError) throw answersError

  return {
    ...mapAssignment(assignment),
    fields: fields ?? [],
    answers: answers ?? [],
  }
}

export async function saveCheckinAnswers(input: {
  assignmentId: string
  completedBy: string | null
  answers: { fieldId: string; valueText: string | null }[]
}): Promise<void> {
  const { error: deleteError } = await supabase
    .from('checkin_form_answers')
    .delete()
    .eq('assignment_id', input.assignmentId)

  if (deleteError) throw deleteError

  const rows = input.answers
    .map((answer) => ({
      assignment_id: input.assignmentId,
      field_id: answer.fieldId,
      value_text: answer.valueText?.trim() ? answer.valueText.trim() : null,
      updated_at: new Date().toISOString(),
    }))
    .filter((row) => row.value_text != null)

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('checkin_form_answers').insert(rows)
    if (insertError) throw insertError
  }

  const now = new Date().toISOString()
  const { error: statusError } = await supabase
    .from('checkin_form_assignments')
    .update({
      status: 'completed' as CheckinAssignmentStatus,
      completed_at: now,
      completed_by: input.completedBy,
      updated_at: now,
    })
    .eq('id', input.assignmentId)

  if (statusError) throw statusError
}

export async function clearCheckinAnswers(assignmentId: string): Promise<void> {
  const { error: deleteError } = await supabase
    .from('checkin_form_answers')
    .delete()
    .eq('assignment_id', assignmentId)

  if (deleteError) throw deleteError

  const now = new Date().toISOString()
  const { error: statusError } = await supabase
    .from('checkin_form_assignments')
    .update({
      status: 'assigned' as CheckinAssignmentStatus,
      completed_at: null,
      completed_by: null,
      updated_at: now,
    })
    .eq('id', assignmentId)

  if (statusError) throw statusError
}
