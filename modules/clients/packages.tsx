'use client'

import React, { useEffect, useState } from 'react'
import { PersonPackage } from '@/supabase/fetches/fetchpersonpackages'
import { Package } from '@/supabase/fetches/fetchpackages'
import { Contract } from '@/supabase/fetches/fetchcontracts'
import { fetchServices, Service } from '@/supabase/fetches/fetchservices'
import {
  attachRemainingToPersonPackages,
  PersonPackageWithRemaining,
} from '@/supabase/fetches/fetchpersonpackageswithremaining'
import AddEventDialog from '@/modules/calendar/addevent'

type PackagesProps = {
  personPackages: PersonPackage[]
  packages: Package[]
  contracts?: Contract[]
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

function statusClass(status: string | null | undefined): string {
  switch (status) {
    case 'paid':
    case 'active':
      return 'text-green-500'
    case 'pending':
      return 'text-yellow-500'
    default:
      return 'text-muted-foreground'
  }
}

type EntitlementGroup = {
  key: string
  paymentId: string | null
  contractId: string | null
  paymentDate: string | null
  rows: PersonPackage[]
}

function groupEntitlements(personPackages: PersonPackage[]): EntitlementGroup[] {
  const groups = new Map<string, EntitlementGroup>()
  for (const row of personPackages) {
    const key = `${row.payment_id ?? 'no-payment'}::${row.contract_id ?? 'no-contract'}`
    const existing = groups.get(key)
    if (existing) {
      existing.rows.push(row)
      if (!existing.paymentDate && row.payment_date) existing.paymentDate = row.payment_date
    } else {
      groups.set(key, {
        key,
        paymentId: row.payment_id,
        contractId: row.contract_id,
        paymentDate: row.payment_date,
        rows: [row],
      })
    }
  }
  return [...groups.values()].sort((a, b) => {
    const aTime = a.paymentDate ? new Date(a.paymentDate).getTime() : 0
    const bTime = b.paymentDate ? new Date(b.paymentDate).getTime() : 0
    return bTime - aTime
  })
}

export default function Packages({ personPackages, packages, contracts = [] }: PackagesProps) {
  const [services, setServices] = useState<Service[]>([])
  const [rowsWithRemaining, setRowsWithRemaining] = useState<PersonPackageWithRemaining[]>([])

  useEffect(() => {
    let cancelled = false
    fetchServices()
      .then((data) => {
        if (!cancelled) setServices(data)
      })
      .catch((err) => {
        console.error('Error fetching services:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (personPackages.length === 0) {
      setRowsWithRemaining([])
      return
    }
    attachRemainingToPersonPackages(personPackages, services.length ? services : undefined)
      .then((rows) => {
        if (!cancelled) setRowsWithRemaining(rows)
      })
      .catch((err) => {
        console.error('Error loading remaining units:', err)
        if (!cancelled) setRowsWithRemaining([])
      })
    return () => {
      cancelled = true
    }
  }, [personPackages, services])

  const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const contractMap = new Map(contracts.map((c) => [c.id, c]))
  const serviceMap = new Map(services.map((s) => [s.id, s]))

  if (personPackages.length === 0) {
    return (
      <div className="p-4 bg-card border border-border rounded-md">
        <h2 className="text-lg font-semibold text-foreground mb-4">Entitlements</h2>
        <p className="text-muted-foreground text-sm">
          No entitlements yet. Record a payment on a contract to grant services.
        </p>
      </div>
    )
  }

  const groups = groupEntitlements(rowsWithRemaining.length ? rowsWithRemaining : personPackages)

  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <h2 className="text-lg font-semibold text-foreground mb-4">Entitlements</h2>
      <div className="space-y-4">
        {groups.map((group) => {
          const contract = group.contractId ? contractMap.get(group.contractId) : undefined
          const pkg = group.rows[0]?.package_id
            ? packageMap.get(group.rows[0].package_id)
            : undefined
          const title = contract?.name || pkg?.name || 'Entitlement'

          return (
            <div key={group.key} className="bg-background border border-border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">
                  Paid {formatDate(group.paymentDate)}
                </p>
              </div>

              <div className="space-y-3">
                {group.rows.map((row) => {
                  const remainingRow = rowsWithRemaining.find((r) => r.id === row.id)
                  const service = serviceMap.get(row.service_id)
                  const isSession = (remainingRow?.service_type || service?.service_type) === 'SESSION'
                  const remaining = remainingRow?.remaining_units
                  const used = remainingRow?.used_units
                  const total = remainingRow?.total_units ?? row.units_per_obligation_cycle
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm border-t border-border pt-3 first:border-t-0 first:pt-0 items-end"
                    >
                      <div>
                        <p className="text-muted-foreground">Service</p>
                        <p className="text-foreground font-medium">
                          {service?.name || remainingRow?.service_name || 'Unknown service'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Units</p>
                        <p className="text-foreground font-medium">
                          {remaining != null && used != null
                            ? `${remaining} left of ${total}`
                            : total ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Included</p>
                        <p className="text-foreground font-medium">
                          {row.is_included ? 'Yes' : 'Extra'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Unit cost</p>
                        <p className="text-foreground font-medium">{formatMoney(row.unit_cost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Next payment</p>
                        <p className={`font-medium ${statusClass(row.status)}`}>
                          {formatDate(row.next_payment_date)}
                          {row.status ? ` · ${row.status}` : ''}
                        </p>
                      </div>
                      <div>
                        {isSession && row.person_id && remaining != null && remaining > 0 ? (
                          <AddEventDialog
                            initialPersonId={row.person_id}
                            initialType="Client Session"
                            initialPersonPackageId={row.id}
                            trigger={
                              <button
                                type="button"
                                className="text-sm text-primary hover:underline cursor-pointer"
                              >
                                Schedule session
                              </button>
                            }
                          />
                        ) : isSession ? (
                          <p className="text-xs text-muted-foreground">No sessions left</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
