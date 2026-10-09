import { supabase } from '../supabaseClient'
import { Person } from './fetchpeople'
import { NutritionEntry } from './fetchnutrition'
import { NutritionGoal } from './fetchnutritiongoals'
import { PersonPackage } from './fetchpersonpackages'
import { Payment } from './fetchpayments'
import { Contract } from './fetchcontracts'
import { Package } from './fetchpackages'
import { Session } from './fetchsessions'
import { WorkoutWithData } from './fetchpersonworkoutswithdata'
import { fetchClientNutritionEntries } from './fetchnutrition'
import { fetchClientNutritionGoals } from './fetchnutritiongoals'
import { fetchPersonPackagesByPersonId } from './fetchpersonpackages'
import { fetchPaymentsByPersonId } from './fetchpayments'
import { fetchContractsByPersonId } from './fetchcontracts'
import { fetchPackages } from './fetchpackages'
import { fetchClientSessions } from './fetchsessions'
import { fetchPersonWorkoutsWithData } from './fetchpersonworkoutswithdata'

export interface PersonWithData {
  person: Person | null
  nutritionEntries: NutritionEntry[]
  nutritionGoals: NutritionGoal[]
  personPackages: PersonPackage[]
  payments: Payment[]
  contracts: Contract[]
  packages: Package[]
  sessions: Session[]
  workouts: WorkoutWithData[]
}

export interface PersonWithWorkouts {
  person: Person | null
  sessions: Session[]
  workouts: WorkoutWithData[]
}

/**
 * Batch fetch all data for a person (client or prospect)
 * This replaces multiple sequential calls with parallel execution
 */
export async function fetchPersonWithData(
  personId: string,
  trainerId?: string | null
): Promise<PersonWithData> {
  // First, fetch the person to check if they're a client
  const { data: personData, error: personError } = await supabase
    .from('people')
    .select('*')
    .eq('id', personId)
    .single()

  if (personError) {
    console.error('Error loading person:', personError)
    return {
      person: null,
      nutritionEntries: [],
      nutritionGoals: [],
      personPackages: [],
      payments: [],
      contracts: [],
      packages: [],
      sessions: [],
      workouts: [],
    }
  }

  const isClient = personData.converted_at !== null

  // Prepare all fetch promises
  const fetchPromises: {
    nutritionEntries?: Promise<NutritionEntry[]>
    nutritionGoals?: Promise<NutritionGoal[]>
    personPackages?: Promise<PersonPackage[]>
    payments?: Promise<Payment[]>
    contracts?: Promise<Contract[]>
    packages: Promise<Package[]>
    sessions: Promise<Session[]>
    workouts: Promise<WorkoutWithData[]>
  } = {
    packages: fetchPackages(),
    sessions: fetchClientSessions(personId),
    workouts: fetchPersonWorkoutsWithData(personId, trainerId),
  }

  // Only fetch client-specific data if this is a client
  if (isClient) {
    fetchPromises.nutritionEntries = fetchClientNutritionEntries(personData.id, trainerId)
    fetchPromises.nutritionGoals = fetchClientNutritionGoals(personData.id, trainerId)
    fetchPromises.personPackages = fetchPersonPackagesByPersonId(personData.id)
    fetchPromises.payments = fetchPaymentsByPersonId(personData.id)
    fetchPromises.contracts = fetchContractsByPersonId(personData.id)
  }

  // Execute all fetches in parallel
  try {
    const results = await Promise.allSettled([
      fetchPromises.nutritionEntries || Promise.resolve([]),
      fetchPromises.nutritionGoals || Promise.resolve([]),
      fetchPromises.personPackages || Promise.resolve([]),
      fetchPromises.payments || Promise.resolve([]),
      fetchPromises.contracts || Promise.resolve([]),
      fetchPromises.packages,
      fetchPromises.sessions,
      fetchPromises.workouts,
    ])

    // Extract results with error handling
    const nutritionEntries = results[0].status === 'fulfilled' ? results[0].value : []
    const nutritionGoals = results[1].status === 'fulfilled' ? results[1].value : []
    const personPackages = results[2].status === 'fulfilled' ? results[2].value : []
    const payments = results[3].status === 'fulfilled' ? results[3].value : []
    const contracts = results[4].status === 'fulfilled' ? results[4].value : []
    const packages = results[5].status === 'fulfilled' ? results[5].value : []
    const sessions = results[6].status === 'fulfilled' ? results[6].value : []
    const workouts = results[7].status === 'fulfilled' ? results[7].value : []

    // Log any errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = [
          'nutritionEntries',
          'nutritionGoals',
          'personPackages',
          'payments',
          'contracts',
          'packages',
          'sessions',
          'workouts',
        ]
        console.error(`Error loading ${names[index]}:`, result.reason)
      }
    })

    return {
      person: personData,
      nutritionEntries: nutritionEntries as NutritionEntry[],
      nutritionGoals: nutritionGoals as NutritionGoal[],
      personPackages: personPackages as PersonPackage[],
      payments: payments as Payment[],
      contracts: contracts as Contract[],
      packages: packages as Package[],
      sessions: sessions as Session[],
      workouts: workouts as WorkoutWithData[],
    }
  } catch (err) {
    console.error('Unexpected error in batch fetch:', err)
    return {
      person: personData,
      nutritionEntries: [],
      nutritionGoals: [],
      personPackages: [],
      payments: [],
      contracts: [],
      packages: [],
      sessions: [],
      workouts: [],
    }
  }
}

/**
 * Minimal fetch for person page initial load
 * Only fetches person, sessions, and workouts (for progress tab)
 * Other tab data is fetched on-demand by each tab component
 */
export async function fetchPersonWithWorkouts(
  personId: string,
  trainerId?: string | null
): Promise<PersonWithWorkouts> {
  // Fetch person
  const { data: personData, error: personError } = await supabase
    .from('people')
    .select('*')
    .eq('id', personId)
    .single()

  if (personError) {
    console.error('Error loading person:', personError)
    return {
      person: null,
      sessions: [],
      workouts: [],
    }
  }

  // Batch fetch sessions and workouts in parallel
  try {
    const [sessions, workouts] = await Promise.all([
      fetchClientSessions(personId),
      fetchPersonWorkoutsWithData(personId, trainerId),
    ])

    // Sort sessions by date (most recent first)
    const sortedSessions = sessions.sort((a, b) => {
      const dateA = a.start_time ? new Date(a.start_time).getTime() : 0
      const dateB = b.start_time ? new Date(b.start_time).getTime() : 0
      return dateB - dateA
    })

    return {
      person: personData,
      sessions: sortedSessions,
      workouts: workouts,
    }
  } catch (err) {
    console.error('Unexpected error in minimal fetch:', err)
    return {
      person: personData,
      sessions: [],
      workouts: [],
    }
  }
}

