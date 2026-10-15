import { supabase } from '@/src/api/supabase'
import { fetchCheckinFormWithFields } from '@/src/api/fetches/fetchcheckinforms'
import {
  CheckinFormAssignment,
  CheckinAssignmentStatus,
} from '@/src/api/fetches/fetchcheckinformassignments'

export type AssignCheckinFormInput = {
  personId: string
  trainerId: string | null
  formId: string
  assignedDate: string
}

export async function assignCheckinForm(input: AssignCheckinFormInput): Promise<CheckinFormAssignment> {
  const form = await fetchCheckinFormWithFields(input.formId)
  if (!form) {
    throw new Error('Check-in form not found')
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('checkin_form_assignments')
    .insert([
      {
        person_id: input.personId,
        trainer_id: input.trainerId,
        form_id: form.id,
        name: form.name,
        description: form.description,
        assigned_date: input.assignedDate,
        status: 'assigned',
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single()

  if (assignmentError) throw assignmentError

  const fields = form.fields ?? []
  if (fields.length > 0) {
    const { error: fieldsError } = await supabase.from('checkin_form_assignment_fields').insert(
      fields.map((field, index) => ({
        assignment_id: assignment.id,
        source_field_id: field.id,
        label: field.label,
        field_type: field.field_type,
        required: field.required,
        position: field.position ?? index,
        updated_at: new Date().toISOString(),
      }))
    )
    if (fieldsError) throw fieldsError
  }

  return assignment
}

export async function saveCheckinFormAnswers(input: {
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

export async function deleteCheckinFormAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.from('checkin_form_assignments').delete().eq('id', assignmentId)
  if (error) throw error
}
