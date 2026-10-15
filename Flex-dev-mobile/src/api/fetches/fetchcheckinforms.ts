import { supabase } from '@/src/api/supabase'

export type CheckinFieldType = 'text' | 'long_text' | 'number' | 'scale' | 'yes_no'

export type CheckinFormField = {
  id: string
  form_id: string
  label: string
  field_type: CheckinFieldType
  required: boolean
  position: number
  created_at?: string
  updated_at?: string
}

export type CheckinForm = {
  id: string
  trainer_id: string | null
  name: string
  description: string | null
  created_at?: string
  updated_at?: string
  fields?: CheckinFormField[]
}

export async function fetchCheckinForms(trainerId: string): Promise<CheckinForm[]> {
  const { data, error } = await supabase
    .from('checkin_forms')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching check-in forms:', error)
    throw error
  }

  return data ?? []
}

export async function fetchCheckinFormWithFields(formId: string): Promise<CheckinForm | null> {
  const { data: form, error: formError } = await supabase
    .from('checkin_forms')
    .select('*')
    .eq('id', formId)
    .single()

  if (formError) {
    if (formError.code === 'PGRST116') return null
    console.error('Error fetching check-in form:', formError)
    throw formError
  }

  const { data: fields, error: fieldsError } = await supabase
    .from('checkin_form_fields')
    .select('*')
    .eq('form_id', formId)
    .order('position', { ascending: true })

  if (fieldsError) {
    console.error('Error fetching check-in form fields:', fieldsError)
    throw fieldsError
  }

  return { ...form, fields: fields ?? [] }
}
