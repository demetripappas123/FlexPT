import { supabase } from '../supabaseClient'

export type TaskStatus = 'open' | 'done' | 'cancelled'
export type TaskKind = 'session' | 'workout' | 'meal' | 'checkin' | 'habit' | 'other'

export interface Task {
  id: string
  person_id: string
  trainer_id: string | null
  person_package_id: string
  service_id: string
  kind: TaskKind
  status: TaskStatus
  fulfillment_id: string | null
  due_date: string | null
  created_at: string
  completed_at: string | null
  person_name?: string | null
  service_name?: string | null
}

export function taskActionLabel(kind: TaskKind): string {
  switch (kind) {
    case 'session':
      return 'Schedule session'
    case 'workout':
      return 'Assign workout'
    case 'meal':
      return 'Program meals'
    case 'checkin':
      return 'Send check-in'
    case 'habit':
      return 'Habit form'
    default:
      return 'Provide deliverable'
  }
}

export async function fetchOpenTasks(trainerId: string, limit = 50): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      person_id,
      trainer_id,
      person_package_id,
      service_id,
      kind,
      status,
      fulfillment_id,
      due_date,
      created_at,
      completed_at,
      people:person_id ( name ),
      services:service_id ( name )
    `)
    .eq('trainer_id', trainerId)
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching tasks:', error)
    throw error
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const people = row.people as { name?: string } | { name?: string }[] | null
    const services = row.services as { name?: string } | { name?: string }[] | null
    const personName = Array.isArray(people) ? people[0]?.name : people?.name
    const serviceName = Array.isArray(services) ? services[0]?.name : services?.name
    return {
      id: String(row.id),
      person_id: String(row.person_id),
      trainer_id: row.trainer_id ? String(row.trainer_id) : null,
      person_package_id: String(row.person_package_id),
      service_id: String(row.service_id),
      kind: row.kind as TaskKind,
      status: row.status as TaskStatus,
      fulfillment_id: row.fulfillment_id ? String(row.fulfillment_id) : null,
      due_date: row.due_date ? String(row.due_date) : null,
      created_at: String(row.created_at),
      completed_at: row.completed_at ? String(row.completed_at) : null,
      person_name: personName ?? null,
      service_name: serviceName ?? null,
    }
  })
}

export async function syncOpenTasksForPersonPackage(personPackageId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_open_tasks_for_person_package', {
    pp_id: personPackageId,
  })
  if (error) {
    console.error('Error syncing tasks for person_package:', error)
    throw error
  }
}
