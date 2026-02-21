import { supabase } from '../supabaseClient'
import { Service } from './fetchservices'
import { Package } from './fetchpackages'

export interface PackageService {
  id: string // uuid
  package_id: string // uuid
  service_id: string // uuid
  units_per_obligation_cycle: number
  obligation_cycle_length_weeks: number
  unit_cost: number | null
  is_included: boolean
  created_at: string
  updated_at: string
}

export interface PackageServiceWithDetails extends PackageService {
  service?: Service
  package?: Package
}

/**
 * Fetch all package_services
 */
export async function fetchPackageServices(): Promise<PackageService[]> {
  const { data, error } = await supabase
    .from('package_services')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching package_services:', error)
    throw error
  }

  return data ?? []
}

/**
 * Fetch package_services for a specific package
 */
export async function fetchPackageServicesByPackageId(packageId: string): Promise<PackageServiceWithDetails[]> {
  const { data, error } = await supabase
    .from('package_services')
    .select(`
      *,
      service:services(*),
      package:packages(*)
    `)
    .eq('package_id', packageId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching package_services by package_id:', error)
    throw error
  }

  return (data ?? []).map((item: any) => ({
    ...item,
    service: item.service,
    package: item.package,
  }))
}

/**
 * Fetch package_services for a specific service
 */
export async function fetchPackageServicesByServiceId(serviceId: string): Promise<PackageServiceWithDetails[]> {
  const { data, error } = await supabase
    .from('package_services')
    .select(`
      *,
      service:services(*),
      package:packages(*)
    `)
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching package_services by service_id:', error)
    throw error
  }

  return (data ?? []).map((item: any) => ({
    ...item,
    service: item.service,
    package: item.package,
  }))
}

/**
 * Fetch a single package_service by ID
 */
export async function fetchPackageServiceById(packageServiceId: string): Promise<PackageServiceWithDetails | null> {
  const { data, error } = await supabase
    .from('package_services')
    .select(`
      *,
      service:services(*),
      package:packages(*)
    `)
    .eq('id', packageServiceId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching package_service:', error)
    throw error
  }

  return {
    ...data,
    service: data.service,
    package: data.package,
  }
}

/**
 * Fetch package_services with details (service and package info) for a specific package
 * This is a convenience function that returns the same as fetchPackageServicesByPackageId
 */
export async function fetchPackageServicesWithDetails(packageId: string): Promise<PackageServiceWithDetails[]> {
  return fetchPackageServicesByPackageId(packageId)
}

