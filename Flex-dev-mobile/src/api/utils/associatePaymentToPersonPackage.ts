import { upsertPersonPackage } from '../upserts/upsertpersonpackage'
import { fetchPersonPackagesByPersonId } from '../fetches/fetchpersonpackages'
import { fetchPackageById } from '../fetches/fetchpackages'
import { fetchPersonById } from '../fetches/fetchpeople'

/**
 * Associates a payment with a person_package using a 3-step approach:
 * 1. Check if payment date is in range of a billing cycle with status = 'pending'
 * 2. If not, check for the earliest future person_packages row with status = 'pending'
 * 3. Only if that doesn't exist, create a new row
 * Returns the person_package_id that was associated
 * DISABLED: person_packages table has been removed for architecture rework
 */
export async function associatePaymentToPersonPackage(
  personId: string,
  paymentDate: string,
  amount: number
): Promise<string> {
  // DISABLED: person_packages table removed - throwing error
  console.warn('associatePaymentToPersonPackage is disabled - person_packages table has been removed for architecture rework')
  throw new Error('Payment association functionality is temporarily disabled - architecture rework in progress')
  
  /* ORIGINAL CODE - KEPT FOR REFERENCE
  // Convert payment date to Date object
  const paymentDateObj = new Date(paymentDate)
  paymentDateObj.setHours(0, 0, 0, 0) // Normalize to start of day

  // Fetch all person_packages for this person
  const personPackages = await fetchPersonPackagesByPersonId(personId)

  // Step 1: Check if payment date is in range of a billing cycle with status = 'pending'
  const pendingInRange = personPackages.find((pp) => {
    if (pp.status !== 'pending') return false
    
    const startDate = new Date(pp.start_date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(pp.end_date)
    endDate.setHours(23, 59, 59, 999)
    
    return paymentDateObj >= startDate && paymentDateObj <= endDate
  })

  if (pendingInRange) {
    // Activate the pending person_package
    await upsertPersonPackage({
      id: pendingInRange.id,
      person_id: pendingInRange.person_id,
      package_id: pendingInRange.package_id,
      start_date: pendingInRange.start_date,
      end_date: pendingInRange.end_date,
      total_units: pendingInRange.total_units,
      used_units: pendingInRange.used_units,
      status: 'active',
    })

    return pendingInRange.id
  }

  // Step 2: Check for the earliest future person_packages row with status = 'pending'
  const futurePendingPackages = personPackages
    .filter((pp) => {
      if (pp.status !== 'pending') return false
      
      const startDate = new Date(pp.start_date)
      startDate.setHours(0, 0, 0, 0)
      
      return startDate > paymentDateObj
    })
    .sort((a, b) => {
      // Sort by start_date ascending (earliest first)
      const aStart = new Date(a.start_date).getTime()
      const bStart = new Date(b.start_date).getTime()
      return aStart - bStart
    })

  if (futurePendingPackages.length > 0) {
    const earliestFuturePending = futurePendingPackages[0]
    
    // Activate the earliest future pending person_package
    await upsertPersonPackage({
      id: earliestFuturePending.id,
      person_id: earliestFuturePending.person_id,
      package_id: earliestFuturePending.package_id,
      start_date: earliestFuturePending.start_date,
      end_date: earliestFuturePending.end_date,
      total_units: earliestFuturePending.total_units,
      used_units: earliestFuturePending.used_units,
      status: 'active',
    })

    return earliestFuturePending.id
  }

  // Step 3: No pending package found - create a new one
  // Get the latest person_package (any status) to determine the next billing cycle
  const sortedPackages = [...personPackages].sort((a, b) => {
    const aEndDate = new Date(a.end_date).getTime()
    const bEndDate = new Date(b.end_date).getTime()
    if (bEndDate !== aEndDate) {
      return bEndDate - aEndDate
    }
    const aCreated = new Date(a.created_at).getTime()
    const bCreated = new Date(b.created_at).getTime()
    return bCreated - aCreated
  })

  const latestPackage = sortedPackages[0]

  let packageId: string
  let nextStartDate: Date
  let billingCycleWeeks: number
  let unitsPerCycle: number

  if (latestPackage) {
    // Use the latest package to determine next billing cycle
    packageId = latestPackage.package_id
    const packageData = await fetchPackageById(packageId)
    if (!packageData) {
      throw new Error(`Package ${packageId} not found`)
    }

    billingCycleWeeks = packageData.billing_cycle_weeks
    unitsPerCycle = packageData.units_per_cycle

    // Calculate next period dates based on latest package's end_date
    const currentEndDate = new Date(latestPackage.end_date)
    nextStartDate = new Date(currentEndDate)
    nextStartDate.setDate(nextStartDate.getDate() + 1) // Start the day after current period ends
  } else {
    // No existing person_packages - need to get package from person
    const person = await fetchPersonById(personId)
    if (!person) {
      throw new Error(`Person ${personId} not found`)
    }
    if (!person.package_id) {
      throw new Error(`Person ${personId} does not have a package_id`)
    }

    packageId = person.package_id
    const packageData = await fetchPackageById(packageId)
    if (!packageData) {
      throw new Error(`Package ${packageId} not found`)
    }

    billingCycleWeeks = packageData.billing_cycle_weeks
    unitsPerCycle = packageData.units_per_cycle

    // Use payment date as start date if no existing packages
    nextStartDate = new Date(paymentDate)
    nextStartDate.setHours(0, 0, 0, 0)
  }

  // Calculate end date
  const nextEndDate = new Date(nextStartDate)
  nextEndDate.setDate(nextEndDate.getDate() + (billingCycleWeeks * 7))

  // Create new person_package with status = 'active'
  const newPersonPackage = await upsertPersonPackage({
    person_id: personId,
    package_id: packageId,
    start_date: nextStartDate.toISOString().split('T')[0],
    end_date: nextEndDate.toISOString().split('T')[0],
    total_units: unitsPerCycle,
    used_units: 0,
    status: 'active',
  })

  return newPersonPackage.id
  */
}

