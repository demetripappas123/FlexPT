'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/authcontext'
import { fetchContracts, Contract } from '@/supabase/fetches/fetchcontracts'
import { fetchPackages, Package } from '@/supabase/fetches/fetchpackages'
import { fetchClients } from '@/supabase/fetches/fetchpeople'
import { upsertContract } from '@/supabase/upserts/upsertcontract'
import { deleteContract } from '@/supabase/deletions/deletecontract'
import { createPersonPackagesForContract } from '@/supabase/utils/createPersonPackagesForContract'
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
import { Plus, Snowflake, Trash2, Play } from 'lucide-react'
import Link from 'next/link'

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [clients, setClients] = useState<Awaited<ReturnType<typeof fetchClients>>>([])
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Assign form state
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [duration, setDuration] = useState('')
  const [firstBillingDate, setFirstBillingDate] = useState('')
  const [autoRenew, setAutoRenew] = useState(false)

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [contractsData, packagesData, clientsData] = await Promise.all([
        fetchContracts(user.id),
        fetchPackages(),
        fetchClients(user.id),
      ])
      setContracts(contractsData)
      setPackages(packagesData)
      setClients(clientsData)
    } catch (err) {
      console.error('Error loading contracts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const handleOpenAssign = () => {
    setSelectedClientId('')
    setSelectedPackageId('')
    setStartDate('')
    setDuration('')
    setFirstBillingDate('')
    setAutoRenew(false)
    setError(null)
    setAssignOpen(true)
  }

  const handleFreeze = async (c: Contract) => {
    setActionLoadingId(c.id)
    setError(null)
    try {
      await upsertContract({
        id: c.id,
        person_id: c.person_id,
        trainer_id: c.trainer_id,
        start_date: c.start_date,
        status: 'frozen',
        package_id: c.package_id ?? null,
        name: c.name,
        description: c.description,
        cycle_length_weeks: c.cycle_length_weeks,
        package_length_weeks: c.package_length_weeks,
        default_cost_per_cycle: c.default_cost_per_cycle,
        is_active: c.is_active,
        notes: c.notes,
        pif: c.pif,
        pif_cost: c.pif_cost,
        'until cancelled': c['until cancelled'],
      })
      await loadData()
    } catch (err) {
      console.error('Error freezing contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to freeze contract')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleUnfreeze = async (c: Contract) => {
    setActionLoadingId(c.id)
    setError(null)
    try {
      await upsertContract({
        id: c.id,
        person_id: c.person_id,
        trainer_id: c.trainer_id,
        start_date: c.start_date,
        status: 'active',
        package_id: c.package_id ?? null,
        name: c.name,
        description: c.description,
        cycle_length_weeks: c.cycle_length_weeks,
        package_length_weeks: c.package_length_weeks,
        default_cost_per_cycle: c.default_cost_per_cycle,
        is_active: c.is_active,
        notes: c.notes,
        pif: c.pif,
        pif_cost: c.pif_cost,
        'until cancelled': c['until cancelled'],
      })
      await loadData()
    } catch (err) {
      console.error('Error unfreezing contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to unfreeze contract')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteClick = (c: Contract) => {
    setContractToDelete(c)
    setDeleteDialogOpen(true)
    setError(null)
  }

  const handleConfirmDelete = async () => {
    if (!contractToDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteContract(contractToDelete.id)
      setDeleteDialogOpen(false)
      setContractToDelete(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting contract:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete contract')
    } finally {
      setDeleting(false)
    }
  }

  const handleAssignSubmit = async () => {
    if (!user) return
    if (!selectedClientId) {
      setError('Please select a client')
      return
    }
    if (!selectedPackageId) {
      setError('Please select a package')
      return
    }
    const selectedPackage = packages.find((p) => p.id === selectedPackageId)
    if (!selectedPackage) {
      setError('Selected package not found')
      return
    }
    const untilCancelled = selectedPackage['until cancelled'] === true
    const durationNum = parseInt(duration, 10)
    if (!untilCancelled && (!duration || isNaN(durationNum) || durationNum <= 0)) {
      setError('Duration (months) must be greater than 0 for fixed-duration packages')
      return
    }
    if (!firstBillingDate) {
      setError('First billing date is required')
      return
    }
    if (!startDate) {
      setError('Start date is required')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await upsertContract({
        person_id: selectedClientId,
        trainer_id: user.id,
        start_date: startDate,
        package: selectedPackage,
      })
      try {
        await createPersonPackagesForContract({
          personId: selectedClientId,
          packageId: selectedPackageId,
          trainerId: user.id,
          contractStartDate: startDate,
          durationMonths: untilCancelled ? 0 : durationNum,
          untilCancelled,
        })
      } catch (ppErr: unknown) {
        const msg = ppErr && typeof ppErr === 'object' && 'message' in ppErr ? String((ppErr as { message: unknown }).message) : 'Unknown error'
        console.error('Error creating person_packages rows:', ppErr)
        setError(`Contract created, but billing rows failed: ${msg}`)
        setSaving(false)
        return
      }
      setAssignOpen(false)
      loadData()
    } catch (err: unknown) {
      // Supabase/PostgREST errors can have message, code, details; sometimes message is empty or in another key
      const obj = err && typeof err === 'object' ? (err as Record<string, unknown>) : null
      const message =
        (obj?.message && String(obj.message)) ||
        (obj?.error_description && String(obj.error_description)) ||
        (obj?.msg && String(obj.msg)) ||
        (obj?.details && String(obj.details)) ||
        (err instanceof Error ? err.message : null) ||
        (err != null ? String(err) : 'Unknown error')
      const code = obj?.code != null ? ` [${obj.code}]` : ''
      const details = obj?.details != null && obj.details !== message ? ` — ${String(obj.details)}` : ''
      console.error('Error creating contract:', err)
      console.error('Error details (full):', obj ? JSON.stringify(obj, null, 2) : err)
      setError(`Failed to create contract: ${message}${code}${details}`.trim() || 'Server returned 400. Check console for details.')
    } finally {
      setSaving(false)
    }
  }

  const clientMap = new Map(clients.map((c) => [c.id, c]))

  if (loading) {
    return (
      <div className="p-8 bg-background text-foreground min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Contracts</h1>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contracts</h1>
          <p className="text-muted-foreground mt-2">Assign packages to clients and view active contracts</p>
        </div>
        <Button
          onClick={handleOpenAssign}
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 cursor-pointer flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Assign package to client
        </Button>
      </div>

      {error && !assignOpen && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="p-8 bg-card border border-border rounded-md text-center">
          <p className="text-muted-foreground">No contracts yet. Assign a package to a client to get started.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-foreground px-4 py-3">Client</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Name</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Start date</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Package length</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Cycle length</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">Status</th>
                  <th className="text-left font-medium text-foreground px-4 py-3">PIF</th>
                  <th className="text-right font-medium text-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const client = clientMap.get(c.person_id)
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/people/${c.person_id}`}
                          className="font-medium text-foreground hover:underline cursor-pointer"
                        >
                          {client?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-foreground">{c.name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground">{c.package_length_weeks} wk</td>
                      <td className="px-4 py-3 text-foreground">
                        {c.cycle_length_weeks != null ? `${c.cycle_length_weeks} wk` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={
                          (c.status ?? 'active') === 'active' ? 'text-green-500 font-medium' :
                          (c.status ?? '') === 'frozen' ? 'text-amber-500 font-medium' :
                          'text-muted-foreground'
                        }>
                          {(c.status ?? 'active') === 'active' ? 'Active' : (c.status ?? '') === 'frozen' ? 'Frozen' : 'Cancelled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{c.pif ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end items-center">
                          {!c.pif && (c.status ?? 'active') === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFreeze(c)}
                              disabled={actionLoadingId === c.id}
                              className="cursor-pointer text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
                              title="Freeze contract"
                            >
                              <Snowflake className="h-4 w-4 mr-1" />
                              {actionLoadingId === c.id ? '…' : 'Freeze'}
                            </Button>
                          )}
                          {!c.pif && (c.status ?? '') === 'frozen' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnfreeze(c)}
                              disabled={actionLoadingId === c.id}
                              className="cursor-pointer text-green-600 border-green-600/50 hover:bg-green-600/10"
                              title="Unfreeze contract"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              {actionLoadingId === c.id ? '…' : 'Unfreeze'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(c)}
                            className="cursor-pointer text-destructive border-destructive/50 hover:bg-destructive/10"
                            title="Delete contract"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Assign package to client</DialogTitle>
            <DialogDescription>
              Select a client and a package to create a new contract. The contract will be active and linked to you as the trainer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Client *</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Package *</label>
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="">Select a package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.default_cost_per_cycle != null && ` — $${Number(p.default_cost_per_cycle).toFixed(2)}/cycle`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Start date *</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border-border cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Duration (months) *</label>
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 12"
                className="bg-background border-border [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">First billing date *</label>
              <Input
                type="date"
                value={firstBillingDate}
                onChange={(e) => setFirstBillingDate(e.target.value)}
                className="bg-background border-border cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="assign-auto-renew"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="assign-auto-renew" className="text-sm font-medium text-foreground cursor-pointer">
                Auto renew
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignOpen(false)}
              className="bg-secondary text-secondary-foreground border-border cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignSubmit}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) setContractToDelete(null); setDeleteDialogOpen(open) }}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Delete contract</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the contract &quot;{contractToDelete?.name}&quot; for this client? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setContractToDelete(null) }}
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
