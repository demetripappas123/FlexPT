import { supabase } from '../supabaseClient'

export interface Service {
  id: string // uuid
  name: string
  service_type: string
  variant: any | null // json
  requires_form: boolean
  is_recurring: boolean
  created_at: string
  updated_at: string
}

/**
 * Fetch all services
 */
export async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching services:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch a single service by ID
 */
export async function fetchServiceById(serviceId: string): Promise<Service | null> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching service:', error)
    throw error
  }

  return data
}

/**
 * Fetch services by service type
 */
export async function fetchServicesByType(serviceType: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('service_type', serviceType)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching services by type:', error)
    throw error
  }

  return data ?? []
}


