// lib/events.ts
import { supabase } from '../supabaseClient'

export type EventFormData = {
  id?: string               // optional, for updating
  title: string
  type: string
  person_id?: string | null
  start_time: string
  duration_minutes: number
  status?: 'pending' | 'completed' | 'canceled_with_charge' | 'canceled_no_charge'
  created_at?: string       // optional, defaults to now() in DB
}

/**
 * Upserts an event into the "events" table.
 * If id is provided, updates existing event; otherwise creates new one.
 * For updates, only provided fields are updated (preserves existing values).
 */
export async function upsertEvent(event: Partial<EventFormData>) {
  if (event.id) {
    // Update existing event - only update provided fields
    const updateData: any = {}
    if (event.title !== undefined) updateData.title = event.title
    if (event.type !== undefined) updateData.type = event.type
    if (event.person_id !== undefined) updateData.person_id = event.person_id
    if (event.start_time !== undefined) updateData.start_time = event.start_time
    if (event.duration_minutes !== undefined) updateData.duration_minutes = event.duration_minutes
    if (event.status !== undefined) updateData.status = event.status
    if (event.created_at !== undefined) updateData.created_at = event.created_at

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', event.id)
      .select()

    if (error) {
      console.error('Error updating event:', error)
      throw error
    }

    return data
  } else {
    // Create new event - fill in defaults for missing fields
    const fullEvent: EventFormData = {
      title: event.title ?? 'Untitled Event',
      type: event.type ?? 'Client Session',
      person_id: event.person_id ?? null,
      start_time: event.start_time ?? new Date().toISOString(),
      duration_minutes: event.duration_minutes ?? 60,
      status: event.status ?? 'pending',
      created_at: event.created_at ?? new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('events')
      .insert([fullEvent])
      .select()

    if (error) {
      console.error('Error creating event:', error)
      throw error
    }

    return data
  }
}
