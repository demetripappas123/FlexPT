import { supabase } from '../supabaseClient'
import { Service } from '../fetches/fetchservices'

export interface ServiceFormData {
  id?: string
  name: string
  service_type: string
  variant?: any | null
  requires_form?: boolean
  is_recurring?: boolean
}

/**
 * Create or update a service
 */
export async function upsertService(serviceData: ServiceFormData): Promise<Service> {
  const data: any = {
    name: serviceData.name,
    service_type: serviceData.service_type,
    variant: serviceData.variant ?? null,
    requires_form: serviceData.requires_form ?? false,
    is_recurring: serviceData.is_recurring ?? false,
  }

  if (serviceData.id) {
    // Update existing service
    const { data: updatedService, error } = await supabase
      .from('services')
      .update(data)
      .eq('id', serviceData.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating service:', error)
      throw error
    }

    return updatedService
  } else {
    // Create new service
    const { data: newService, error } = await supabase
      .from('services')
      .insert([data])
      .select()
      .single()

    if (error) {
      console.error('Error creating service:', error)
      throw error
    }

    return newService
  }
}


