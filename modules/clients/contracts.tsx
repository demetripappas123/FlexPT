'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Contract, ContractStatus } from '@/supabase/fetches/fetchcontracts'
import { Package } from '@/supabase/fetches/fetchpackages'
import { fetchPackageServices, PackageService } from '@/supabase/fetches/fetchpackageservices'
import { fetchServices, Service } from '@/supabase/fetches/fetchservices'
import { upsertContract } from '@/supabase/upserts/upsertcontract'
import { deleteContract } from '@/supabase/deletions/deletecontract'
import {
  suggestedSessionsPerWeekFromRows,
  suggestedSessionsPerWeekLabel,
  snapSuggestedSessionsPerWeek,
  type SuggestedSessionsPerWeek,
} from '@/supabase/utils/suggestedSessionsPerWeek'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, X, Pencil, Trash } from 'lucide-react'

type ContractsProps = {
  contracts: Contract[]
  packages: Package[]
  personId: string
  trainerId: string | null
  onChanged?: () => void
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

function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function addWeeksToDate(dateStr: string, weeks: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + weeks * 7)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function statusClass(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'text-green-500'
    case 'cancelled':
      return 'text-red-500'
    case 'frozen':
      return 'text-yellow-500'
    default:
      return 'text-muted-foreground'
  }
}

const SESSION_CADENCE_OPTIONS: { value: SuggestedSessionsPerWeek; label: string }[] = [
  { value: 1, label: 'Once a week' },
  { value: 2, label: 'Twice a week' },
  { value: 3, label: '3× a week' },
]

const emptyForm = {
  name: '',
  selectedPackageId: '',
  startDate: new Date().toISOString().split('T')[0],
  renewalDate: '',
  untilCancelled: false,
  pif: false,
  pifCost: '',
  costPerCycle: '',
  billCycleWeeks: '',
  suggestedSessionsPerWeek: null as SuggestedSessionsPerWeek | null,
  status: 'active' as ContractStatus,
}

export default function Contracts({
  contracts,
  packages,
  personId,
  trainerId,
  onChanged,
}: ContractsProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [packageServices, setPackageServices] = useState<PackageService[]>([])
  const [services, setServices] = useState<Service[]>([])

  const packageMap = useMemo(() => new Map(packages.map((pkg) => [pkg.id, pkg])), [packages])
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchPackageServices(), fetchServices()])
      .then(([rows, svc]) => {
        if (cancelled) return
        setPackageServices(rows)
        setServices(svc)
      })
      .catch((err) => {
        console.error('Error loading package session cadence:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cadenceFromPackage = (packageId: string | null | undefined): SuggestedSessionsPerWeek | null => {
    if (!packageId) return null
    const rows = packageServices
      .filter((ps) => ps.package_id === packageId)
      .map((ps) => ({ ...ps, service: serviceMap.get(ps.service_id) }))
    return suggestedSessionsPerWeekFromRows(rows)
  }

  const sortedContracts = [...contracts].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (a.status !== 'active' && b.status === 'active') return 1
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
    return bDate - aDate
  })

  const applyPackageDefaults = (pkg: Package, startDate: string) => {
    const untilCancelled = pkg.until_cancelled === true
    let renewalDate = ''
    if (!untilCancelled && pkg.package_length_weeks && startDate) {
      renewalDate = addWeeksToDate(startDate, pkg.package_length_weeks)
    }
    const isPif = pkg.pif === true
    setForm((prev) => ({
      ...prev,
      selectedPackageId: pkg.id,
      name: pkg.name ?? '',
      untilCancelled,
      pif: isPif,
      pifCost: pkg.pif_cost != null ? String(pkg.pif_cost) : '',
      costPerCycle: pkg.cost_per_bill_cycle != null ? String(pkg.cost_per_bill_cycle) : '',
      billCycleWeeks: pkg.bill_cycle_length_weeks != null ? String(pkg.bill_cycle_length_weeks) : '',
      suggestedSessionsPerWeek: isPif ? cadenceFromPackage(pkg.id) ?? 2 : null,
      renewalDate,
    }))
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  const handleAdd = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      startDate: new Date().toISOString().split('T')[0],
    })
    setError(null)
    setShowForm(true)
  }

  const handleEdit = (contract: Contract) => {
    setEditingId(contract.id)
    setForm({
      name: contract.name ?? '',
      selectedPackageId: contract.package_id ?? '',
      startDate: toDateInput(contract.start_date) || new Date().toISOString().split('T')[0],
      renewalDate: toDateInput(contract.renewal_date),
      untilCancelled: contract.until_cancelled === true,
      pif: contract.pif === true,
      pifCost: contract.pif_cost != null ? String(contract.pif_cost) : '',
      costPerCycle: contract.cost_per_bill_cycle != null ? String(contract.cost_per_bill_cycle) : '',
      billCycleWeeks: contract.bill_cycle_length_weeks != null ? String(contract.bill_cycle_length_weeks) : '',
      suggestedSessionsPerWeek: contract.pif
        ? snapSuggestedSessionsPerWeek(Number(contract.suggested_sessions_per_week)) ??
          cadenceFromPackage(contract.package_id) ??
          2
        : null,
      status: (contract.status ?? 'active') as ContractStatus,
    })
    setError(null)
    setShowForm(true)
  }

  const handleDeleteClick = (contract: Contract, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setContractToDelete(contract)
    setError(null)
  }

  const handleConfirmDelete = async () => {
    if (!contractToDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteContract(contractToDelete.id)
      if (editingId === contractToDelete.id) resetForm()
      setContractToDelete(null)
      onChanged?.()
    } catch (err) {
      console.error('Error deleting contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete contract')
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    if (!form.startDate) {
      setError('Start date is required')
      return
    }
    if (!editingId && !form.selectedPackageId) {
      setError('Select a package to copy from')
      return
    }
    if (!form.untilCancelled && !form.renewalDate) {
      setError('Renewal date is required unless this contract runs until cancelled')
      return
    }

    const selectedPackage = packages.find((p) => p.id === form.selectedPackageId)
    if (!editingId && !selectedPackage) {
      setError('Selected package not found')
      return
    }

    const pifCost = form.pifCost === '' ? null : Number(form.pifCost)
    const costPerCycle = form.costPerCycle === '' ? null : Number(form.costPerCycle)
    const billCycleWeeks = form.billCycleWeeks === '' ? null : Number(form.billCycleWeeks)
    if (form.pif && pifCost != null && Number.isNaN(pifCost)) {
      setError('PIF cost must be a number')
      return
    }
    if (!form.pif && costPerCycle != null && Number.isNaN(costPerCycle)) {
      setError('Cycle cost must be a number')
      return
    }
    if (form.pif && form.suggestedSessionsPerWeek == null) {
      setError('Choose how often sessions should be scheduled')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        const existing = contracts.find((c) => c.id === editingId)
        if (!existing) throw new Error('Contract not found')
        await upsertContract({
          id: editingId,
          person_id: existing.person_id,
          trainer_id: existing.trainer_id,
          start_date: form.startDate,
          status: form.status,
          package_id: existing.package_id,
          name: form.name.trim(),
          description: existing.description,
          bill_cycle_length_weeks: form.pif ? null : billCycleWeeks,
          cost_per_bill_cycle: form.pif ? null : costPerCycle,
          pif: form.pif,
          pif_cost: form.pif ? pifCost : existing.pif_cost,
          until_cancelled: form.untilCancelled,
          renewal_date: form.untilCancelled ? null : form.renewalDate,
          suggested_sessions_per_week: form.pif ? form.suggestedSessionsPerWeek : null,
        })
      } else if (selectedPackage) {
        await upsertContract({
          person_id: personId,
          trainer_id: trainerId,
          start_date: form.startDate,
          package: selectedPackage,
          name: form.name.trim(),
          until_cancelled: form.untilCancelled,
          bill_cycle_length_weeks: form.pif ? null : billCycleWeeks,
          cost_per_bill_cycle: form.pif ? null : costPerCycle,
          pif: form.pif,
          pif_cost: form.pif ? pifCost : selectedPackage.pif_cost,
          renewal_date: form.untilCancelled ? null : form.renewalDate,
          suggested_sessions_per_week: form.pif ? form.suggestedSessionsPerWeek : null,
        })
      }
      resetForm()
      onChanged?.()
    } catch (err) {
      console.error('Error saving contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to save contract')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-foreground">Contracts</h2>
        <Button
          onClick={handleAdd}
          className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Contract
        </Button>
      </div>

      {showForm && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-foreground">
              {editingId ? 'Edit Contract' : 'Add Contract'}
            </h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            {!editingId && (
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Package *</label>
                <select
                  value={form.selectedPackageId}
                  onChange={(e) => {
                    const pkg = packages.find((p) => p.id === e.target.value)
                    if (pkg) applyPackageDefaults(pkg, form.startDate)
                    else setForm((prev) => ({ ...prev, selectedPackageId: '' }))
                  }}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="">Select a package</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.pif && p.pif_cost != null ? ` — PIF $${Number(p.pif_cost).toFixed(2)}` : ''}
                      {!p.pif && p.cost_per_bill_cycle != null
                        ? ` — $${Number(p.cost_per_bill_cycle).toFixed(2)}/cycle`
                        : ''}
                    </option>
                  ))}
                </select>
                {packages.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No packages yet. Create a package first, then assign it here.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-input text-foreground border-border"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Start date *</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => {
                    const startDate = e.target.value
                    const pkg = packages.find((p) => p.id === form.selectedPackageId)
                    setForm((prev) => {
                      let renewalDate = prev.renewalDate
                      if (!prev.untilCancelled && !editingId && pkg?.package_length_weeks && startDate) {
                        renewalDate = addWeeksToDate(startDate, pkg.package_length_weeks)
                      }
                      return { ...prev, startDate, renewalDate }
                    })
                  }}
                  className="bg-input text-foreground border-border cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Renewal date</label>
                <Input
                  type="date"
                  value={form.renewalDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, renewalDate: e.target.value }))}
                  disabled={form.untilCancelled}
                  className="bg-input text-foreground border-border cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="contract-until-cancelled"
                checked={form.untilCancelled}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    untilCancelled: e.target.checked,
                    renewalDate: e.target.checked ? '' : prev.renewalDate,
                  }))
                }
                className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="contract-until-cancelled" className="text-sm font-medium text-foreground cursor-pointer">
                Until cancelled
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="contract-pif"
                checked={form.pif}
                onChange={(e) => {
                  const pif = e.target.checked
                  setForm((prev) => {
                    const packageId =
                      prev.selectedPackageId ||
                      (editingId ? contracts.find((c) => c.id === editingId)?.package_id : null)
                    return {
                      ...prev,
                      pif,
                      suggestedSessionsPerWeek: pif
                        ? prev.suggestedSessionsPerWeek ?? cadenceFromPackage(packageId) ?? 2
                        : null,
                    }
                  })
                }}
                className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="contract-pif" className="text-sm font-medium text-foreground cursor-pointer">
                Pay in full
              </label>
            </div>

            {form.pif ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">PIF cost ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.pifCost}
                    onChange={(e) => setForm((prev) => ({ ...prev, pifCost: e.target.value }))}
                    className="bg-input text-foreground border-border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">
                    Suggested session schedule
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SESSION_CADENCE_OPTIONS.map((option) => {
                      const selected = form.suggestedSessionsPerWeek === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, suggestedSessionsPerWeek: option.value }))
                          }
                          className={`p-3 border-2 rounded-md text-sm transition-colors cursor-pointer ${
                            selected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          <span className="font-medium">{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">Cost per cycle ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costPerCycle}
                    onChange={(e) => setForm((prev) => ({ ...prev, costPerCycle: e.target.value }))}
                    className="bg-input text-foreground border-border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">Cycle length (weeks)</label>
                  <Input
                    type="number"
                    min="1"
                    value={form.billCycleWeeks}
                    onChange={(e) => setForm((prev) => ({ ...prev, billCycleWeeks: e.target.value }))}
                    className="bg-input text-foreground border-border"
                  />
                </div>
              </div>
            )}

            {editingId && (
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ContractStatus }))}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="frozen">Frozen</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            {error && !contractToDelete && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create contract'}
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              {editingId && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const existing = contracts.find((c) => c.id === editingId)
                    if (existing) handleDeleteClick(existing)
                  }}
                  className="ml-auto cursor-pointer text-destructive border-destructive/50 hover:bg-destructive/10"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {contracts.length === 0 && !showForm ? (
        <p className="text-muted-foreground text-sm">No contracts yet. Add one to assign a package to this client.</p>
      ) : (
        <div className="space-y-4">
          {sortedContracts.map((contract) => {
            const pkg = contract.package_id ? packageMap.get(contract.package_id) : undefined
            const billingLabel = contract.pif
              ? `PIF ${formatMoney(contract.pif_cost)}`
              : `${formatMoney(contract.cost_per_bill_cycle)} / ${contract.bill_cycle_length_weeks ?? '—'} wk cycle`

            return (
              <div
                key={contract.id}
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(contract)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleEdit(contract)
                  }
                }}
                className={`w-full text-left bg-background border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors ${
                  contract.status === 'active' ? 'border-green-500/50' : 'border-border'
                } ${editingId === contract.id ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {contract.name || pkg?.name || 'Untitled contract'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-sm font-medium rounded ${statusClass(contract.status)}`}>
                      {contract.status
                        ? contract.status.charAt(0).toUpperCase() + contract.status.slice(1)
                        : 'Unknown'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(contract, e)}
                      className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Delete contract"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">Package:</span>{' '}
                    {pkg?.name || '—'}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Billing:</span> {billingLabel}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Start:</span>{' '}
                    {formatDate(contract.start_date)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Renewal:</span>{' '}
                    {contract.until_cancelled ? 'Until cancelled' : formatDate(contract.renewal_date)}
                  </div>
                  {contract.pif && (
                    <div>
                      <span className="font-semibold text-foreground">Schedule:</span>{' '}
                      {suggestedSessionsPerWeekLabel(
                        snapSuggestedSessionsPerWeek(Number(contract.suggested_sessions_per_week)) ??
                          cadenceFromPackage(contract.package_id)
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog
        open={contractToDelete != null}
        onOpenChange={(open) => {
          if (!open) {
            setContractToDelete(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Delete contract</DialogTitle>
            <DialogDescription>
              Delete &quot;{contractToDelete?.name || 'this contract'}&quot; for this client? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && contractToDelete && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setContractToDelete(null)
                setError(null)
              }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="cursor-pointer disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
