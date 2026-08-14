import { fetchPeople } from './fetchpeople'
import { fetchContractsByPersonId, Contract } from './fetchcontracts'
import { fetchPersonPackagesByPersonId } from './fetchpersonpackages'
import { fetchPaymentsByPersonId } from './fetchpayments'
import {
  personPackagesOverlapRange,
  uniqueCycleStartDates,
} from '../utils/dashboardMetrics'

/**
 * EOM projected revenue per client with an active contract:
 * payments already made this month + expected cost_per_bill_cycle per pending entitlement in month.
 */
export async function fetchProjectedRevenue(trainerId?: string | null): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const clients = await fetchPeople({ isClient: true, trainerId })

  if (clients.length === 0) return 0

  let totalMRR = 0

  for (const client of clients) {
    try {
      const [contracts, personPackages, allPayments] = await Promise.all([
        fetchContractsByPersonId(client.id),
        fetchPersonPackagesByPersonId(client.id),
        fetchPaymentsByPersonId(client.id),
      ])

      const activeContract = contracts.find((c) => {
        if (c.status !== 'active') return false
        if (trainerId && c.trainer_id !== trainerId) return false
        return true
      })

      if (!activeContract) continue

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
        (pp) =>
          (pp.contract_id === activeContract.id ||
            (packageId != null && pp.package_id === packageId)) &&
          personPackagesOverlapRange(pp, startOfMonth, endOfMonth)
      )

      const cycleCost = getExpectedCyclePayment(activeContract)
      if (cycleCost <= 0) {
        if (expectedRevenue > 0) totalMRR += expectedRevenue
        continue
      }

      const pendingDates = packageId
        ? uniqueCycleStartDates(inMonth, packageId, 'pending')
        : [
            ...new Set(
              inMonth
                .filter((pp) => pp.status === 'pending')
                .map((pp) => pp.payment_date ?? pp.next_payment_date)
                .filter((d): d is string => d != null)
            ),
          ]

      if (activeContract.pif) {
        if (pendingDates.length > 0 && paymentsThisMonth.length === 0) {
          expectedRevenue += cycleCost
        }
      } else {
        expectedRevenue += pendingDates.length * cycleCost
      }

      // Estimate remaining cycles in month from next_payment_date when nothing pending yet
      if (pendingDates.length === 0) {
        const cycleWeeks = Number(activeContract.bill_cycle_length_weeks) || 0
        if (cycleWeeks > 0) {
          const latestNext = inMonth
            .map((pp) => (pp.next_payment_date ? new Date(pp.next_payment_date).getTime() : 0))
            .sort((a, b) => b - a)[0]

          if (latestNext) {
            const latestNextDate = new Date(latestNext)
            if (latestNextDate < endOfMonth) {
              const cycleDays = cycleWeeks * 7
              const daysAfter = Math.max(
                0,
                (endOfMonth.getTime() - latestNextDate.getTime()) / (1000 * 60 * 60 * 24)
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

function getExpectedCyclePayment(contract: Contract): number {
  if (contract.pif) {
    const pif = Number(contract.pif_cost)
    return !isNaN(pif) && pif > 0 ? pif : 0
  }
  const perCycle = Number(contract.cost_per_bill_cycle)
  return !isNaN(perCycle) && perCycle > 0 ? perCycle : 0
}
