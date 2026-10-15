import { supabase } from '@/src/api/supabase'
import { CheckinForm, CheckinFormField, CheckinFieldType, CheckinFormPurpose } from '@/src/api/fetches/fetchcheckinforms'

export type CheckinFormInput = {
  id?: string
  trainer_id: string | null
  name: string
  description?: string | null
  purpose?: CheckinFormPurpose
}

export type CheckinFormFieldInput = {
  id?: string
  form_id: string
  label: string
  field_type: CheckinFieldType
  required?: boolean
  position: number
}

export async function upsertCheckinForm(input: CheckinFormInput): Promise<CheckinForm> {
  const payload = {
    trainer_id: input.trainer_id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    purpose: input.purpose ?? 'checkin',
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('checkin_forms')
      .update(payload)
      .eq('id', input.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('checkin_forms')
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function replaceCheckinFormFields(
  formId: string,
  fields: Pick<CheckinFormFieldInput, 'label' | 'field_type' | 'required'>[]
): Promise<CheckinFormField[]> {
  const { error: deleteError } = await supabase
    .from('checkin_form_fields')
    .delete()
    .eq('form_id', formId)

  if (deleteError) throw deleteError

  if (fields.length === 0) return []

  const rows = fields.map((field, index) => ({
    form_id: formId,
    label: field.label.trim(),
    field_type: field.field_type,
    required: field.required ?? false,
    position: index,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('checkin_form_fields')
    .insert(rows)
    .select()
    .order('position', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function deleteCheckinForm(formId: string): Promise<void> {
  const { error } = await supabase.from('checkin_forms').delete().eq('id', formId)
  if (error) throw error
}
