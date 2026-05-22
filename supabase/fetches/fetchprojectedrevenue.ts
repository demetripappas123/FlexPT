import { fetchPeople } from './fetchpeople'
import { fetchContractsByPersonId } from './fetchcontracts'
import { fetchPersonPackagesByPersonId } from './fetchpersonpackages'
import { fetchPackages, Package } from './fetchpackages'
import { fetchPaymentsByPersonId } from './fetchpayments'
import { getPaymentTimestamp } from './paymentSchema'
import {
  personPackagesOverlapRange,
  uniqueCycleStartDates,
} from '../utils/dashboardMetrics'

/**
 * EOM projected revenue per client with an active contract:
 * payments already made this month + expected default_cost_per_cycle per pending billing cycle in month.
 */
export async function fetchProjectedRevenue(trainerId?: string | null): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [clients, packages] = await Promise.all([
    fetchPeople({ isClient: true, trainerId }),
    fetchPackages(),
  ])

  if (clients.length === 0) return 0

  const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]))
  let totalMRR = 0

  for (const client of clients) {
    try {
      const [contracts, personPackages, allPayments] = await Promise.all([
        fetchContractsByPersonId(client.id),
        fetchPersonPackagesByPersonId(client.id),
        fetchPaymentsByPersonId(client.id),
      ])

      const activeContract = contracts.find((c) => {
        if (c.status !== 'active' || !c.package_id) return false
        if (trainerId && c.trainer_id !== trainerId) return false
        return true
      })

      if (!activeContract?.package_id) continue

      const pkg = packageMap.get(activeContract.package_id)
      if (!pkg) continue

      const paymentsThisMonth = allPayments.filter((payment) => {
        const d = new Date(payment.payment_date)
        return d >= startOfMonth && d <= endOfMonth
      })

      let expectedRevenue = paymentsThisMonth.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      )

      const packageId = activeContract.package_id
      const inMonth = personPackages.filter(
        (pp) => pp.package_id === packageId && personPackagesOverlapRange(pp, startOfMonth, endOfMonth)
      )

      const cycleCost = getExpectedCyclePayment(pkg)
      if (cycleCost <= 0) {
        if (expectedRevenue > 0) totalMRR += expectedRevenue
        continue
      }

      const pendingCycleStarts = uniqueCycleStartDates(inMonth, packageId, 'pending')
      if (pkg.pif) {
        if (pendingCycleStarts.length > 0 && paymentsThisMonth.length === 0) {
          expectedRevenue += cycleCost
        }
      } else {
        expectedRevenue += pendingCycleStarts.length * cycleCost
      }

      // If no pending rows but active/paid cycles end before month end, estimate extra cycles
      if (pendingCycleStarts.length === 0) {
        const cycleWeeks = Number(pkg.cycle_length_weeks) || 0
        if (cycleWeeks > 0) {
          const latestEnd = inMonth
            .map((pp) => new Date(pp.end_date).getTime())
            .sort((a, b) => b - a)[0]

          if (latestEnd) {
            const latestEndDate = new Date(latestEnd)
            if (latestEndDate < endOfMonth) {
              const cycleDays = cycleWeeks * 7
              const daysAfter = Math.max(
                0,
                (endOfMonth.getTime() - latestEndDate.getTime()) / (1000 * 60 * 60 * 24)
              )
              const extraCycles = Math.ceil(daysAfter / cycleDays)
              expectedRevenue += extraCycles * cycleCost
            }
          }
        }
      }

      if (!isNaN(expectedRevenue) && isFinite(expectedRevenue) && expectedRevenue > 0) {
        totalMRR += expectedRevenue
      }
    } catch (err) {
      console.error(`Error calculating projected revenue for client ${client.id}:`, err)
    }
  }

  return totalMRR || 0
}

function getExpectedCyclePayment(pkg: Package): number {
  if (pkg.pif) {
    const pif = Number(pkg.pif_cost)
    return !isNaN(pif) && pif > 0 ? pif : 0
  }
  const perCycle = Number(pkg.default_cost_per_cycle)
  return !isNaN(perCycle) && perCycle > 0 ? perCycle : 0
}
