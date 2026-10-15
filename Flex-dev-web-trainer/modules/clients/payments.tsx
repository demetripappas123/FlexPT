'use client'

import React, { useState, useEffect } from 'react'
import { Payment } from '@/supabase/fetches/fetchpayments'
import { Contract, contractAllowsManualPayment, contractCollectsThroughFlex } from '@/supabase/fetches/fetchcontracts'
import { upsertPayment } from '@/supabase/upserts/upsertpayment'
import { validatePaymentAmountForPackage, applyPaymentToPersonPackages } from '@/supabase/utils/applyPaymentToPersonPackages'
import { resolveContractCycleCost } from '@/supabase/utils/packageCycleCost'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Pencil, Trash } from 'lucide-react'
import { deletePayment } from '@/supabase/deletions/deletepayment'
import { startStripeCheckout } from '@/supabase/billing/startStripeCheckout'

type PaymentsProps = {
  payments: Payment[]
  contracts: Contract[]
  personId: string
  onPaymentAdded?: () => void
}

export default function Payments({ payments, contracts, personId, onPaymentAdded }: PaymentsProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [chargingId, setChargingId] = useState<string | null>(null)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [resolvedCycleCosts, setResolvedCycleCosts] = useState<Record<string, number>>({})

  const contractsWithPackage = contracts.filter((c) => c.package_id != null)
  const recordableContracts = contractsWithPackage.filter(contractAllowsManualPayment)
  const stripeContracts = contractsWithPackage.filter(
    (c) => contractCollectsThroughFlex(c) && c.status === 'active'
  )
  const contractMap = new Map(contracts.map((c) => [c.id, c]))

  useEffect(() => {
    let cancelled = false
    const missing = contractsWithPackage.filter(
      (c) => !c.pif && !(Number(c.cost_per_bill_cycle) > 0) && c.package_id
    )
    if (missing.length === 0) return
    Promise.all(
      missing.map(async (c) => {
        const cost = await resolveContractCycleCost(c)
        return [c.id, cost] as const
      })
    ).then((entries) => {
      if (cancelled) return
      setResolvedCycleCosts((prev) => {
        const next = { ...prev }
        for (const [id, cost] of entries) {
          if (cost != null && cost > 0) next[id] = cost
        }
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [contracts])

  const cycleCostFor = (c: Contract): number | null => {
    if (c.cost_per_bill_cycle != null && Number(c.cost_per_bill_cycle) > 0) {
      return Number(c.cost_per_bill_cycle)
    }
    return resolvedCycleCosts[c.id] ?? null
  }

  useEffect(() => {
    if (showAddForm && !editingPaymentId && recordableContracts.length === 1 && !selectedContractId) {
      setSelectedContractId(recordableContracts[0].id)
    }
  }, [showAddForm, editingPaymentId, recordableContracts, selectedContractId])

  const validSelectedContractId = recordableContracts.some((c) => c.id === selectedContractId)
    ? selectedContractId
    : ''
  const selectedContract = validSelectedContractId
    ? recordableContracts.find((c) => c.id === validSelectedContractId)
    : null

  const resetForm = () => {
    setSelectedContractId('')
    setAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setAmountError(null)
    setEditingPaymentId(null)
    setShowAddForm(false)
  }

  const handleEdit = (payment: Payment) => {
    setEditingPaymentId(payment.id)
    setAmount(payment.amount.toString())
    setPaymentDate(new Date(payment.payment_date).toISOString().split('T')[0])
    if (payment.contract_id) setSelectedContractId(payment.contract_id)
    setShowAddForm(true)
  }

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return
    try {
      await deletePayment(paymentId)
      onPaymentAdded?.()
    } catch (err) {
      console.error('Error deleting payment:', err)
      alert('Error deleting payment. Please try again.')
    }
  }

  const handleSave = async () => {
    if (!amount || !paymentDate) {
      alert('Please fill in all required fields')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setAmountError('Enter a valid amount greater than 0')
      return
    }

    const contract =
      editingPaymentId && payments.find((p) => p.id === editingPaymentId)?.contract_id
        ? contractMap.get(payments.find((p) => p.id === editingPaymentId)!.contract_id!)
        : selectedContract

    if (!contract?.package_id) {
      setAmountError('Please select a contract for this payment')
      return
    }
    if (!editingPaymentId && !contractAllowsManualPayment(contract)) {
      setAmountError('Record payment is only for organization-billed contracts. FlexPT-billed contracts will charge through Flex.')
      return
    }

    if (!editingPaymentId) {
      const cycleCost = contract.pif
        ? contract.cost_per_bill_cycle
        : cycleCostFor(contract) ?? (await resolveContractCycleCost(contract))
      const validation = validatePaymentAmountForPackage(
        amountNum,
        contract.pif,
        contract.pif_cost,
        cycleCost
      )
      if (!validation.valid) {
        setAmountError(validation.error ?? 'Invalid amount for this contract')
        return
      }
    }

    setAmountError(null)
    setSaving(true)
    try {
      const processedAt = new Date(paymentDate).toISOString()

      if (editingPaymentId) {
        const existing = payments.find((p) => p.id === editingPaymentId)!
        await upsertPayment({
          id: editingPaymentId,
          contract_id: existing.contract_id,
          trainer_id: existing.trainer_id,
          amount: amountNum,
          processed_at: processedAt,
          status: existing.status ?? 'succeeded',
          payment_type: existing.payment_type || (contract.pif ? 'PIF' : 'recurring'),
        })
      } else {
        const created = await upsertPayment({
          contract_id: contract.id,
          trainer_id: contract.trainer_id,
          amount: amountNum,
          currency: 'USD',
          status: 'succeeded',
          payment_type: contract.pif ? 'PIF' : 'recurring',
          processed_at: processedAt,
          generated_obligations: true,
        })

        await applyPaymentToPersonPackages(
          personId,
          contract.id,
          amountNum,
          created.id != null ? String(created.id) : null,
          paymentDate
        )
      }

      resetForm()
      onPaymentAdded?.()
    } catch (err) {
      console.error('Error saving payment:', err)
      setAmountError(err instanceof Error ? err.message : 'Failed to save payment')
    } finally {
      setSaving(false)
    }
  }

  const handleStripeCharge = async (contractId: string) => {
    setStripeError(null)
    setChargingId(contractId)
    try {
      const { url } = await startStripeCheckout(contractId)
      window.location.href = url
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : 'Failed to start Stripe checkout')
      setChargingId(null)
    }
  }

  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <div className="flex justify-between items-center mb-4 gap-2">
        <h2 className="text-lg font-semibold text-foreground">Payments</h2>
        {recordableContracts.length > 0 && (
          <Button
            onClick={() => {
              resetForm()
              setShowAddForm(true)
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Record payment
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-foreground">
              {editingPaymentId ? 'Edit Payment' : 'Record organization payment'}
            </h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            {!editingPaymentId && (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  For organization-billed contracts only. Records that the gym/company collected this
                  cycle so FlexPT can grant sessions. <strong>PIF</strong>: enter the PIF cost.
                  <strong> Recurring</strong>: enter a multiple of the per-cycle cost.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">Contract *</label>
                  <select
                    value={validSelectedContractId}
                    onChange={(e) => {
                      setSelectedContractId(e.target.value)
                      setAmountError(null)
                    }}
                    className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="">Select contract</option>
                    {recordableContracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.pif && c.pif_cost != null ? ` (PIF $${Number(c.pif_cost).toFixed(2)})` : ''}
                        {!c.pif && cycleCostFor(c) != null
                          ? ` ($${Number(cycleCostFor(c)).toFixed(2)}/cycle)`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {recordableContracts.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No organization-billed contracts. FlexPT-billed contracts are charged in Flex, not recorded here.
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Amount ($) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setAmountError(null)
                  }}
                  className="bg-input text-foreground border-border"
                  required
                />
                {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Processed date *</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-input text-foreground border-border cursor-pointer"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? 'Saving...' : editingPaymentId ? 'Update' : 'Save Payment'}
              </Button>
              <Button onClick={resetForm} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {stripeContracts.length > 0 && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Charge with Stripe</p>
          <p className="text-xs text-muted-foreground">
            FlexPT-billed contracts. Opens Stripe Checkout for one cycle (or PIF). Test mode until live keys are set.
          </p>
          {stripeError && <p className="text-xs text-destructive">{stripeError}</p>}
          <div className="space-y-2">
            {stripeContracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground truncate">
                  {c.name}
                  {c.pif && c.pif_cost != null ? ` · PIF $${Number(c.pif_cost).toFixed(2)}` : ''}
                  {!c.pif && c.cost_per_bill_cycle != null
                    ? ` · $${Number(c.cost_per_bill_cycle).toFixed(2)}/cycle`
                    : ''}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={chargingId === c.id}
                  onClick={() => handleStripeCharge(c.id)}
                  className="cursor-pointer shrink-0"
                >
                  {chargingId === c.id ? 'Opening…' : 'Charge'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {recordableContracts.length === 0 && stripeContracts.length === 0
            ? 'No billable contracts yet.'
            : 'No payments recorded for this client.'}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-4 text-sm font-semibold text-muted-foreground pb-2 border-b border-border">
            <div>Date</div>
            <div>Amount</div>
            <div>Status</div>
            <div>Contract</div>
            <div>Actions</div>
          </div>
          {payments.map((payment) => {
            const contract = payment.contract_id ? contractMap.get(payment.contract_id) : null
            return (
              <div
                key={payment.id}
                className="grid grid-cols-5 gap-4 text-sm text-muted-foreground py-2 border-b border-border items-center"
              >
                <div>{new Date(payment.payment_date).toLocaleDateString()}</div>
                <div className="font-medium text-green-500">${Number(payment.amount).toFixed(2)}</div>
                <div className="text-xs capitalize">{payment.status ?? '-'}</div>
                <div className="text-xs">{contract?.name ?? '-'}</div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(payment)} className="hover:text-primary cursor-pointer">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(payment.id)} className="hover:text-destructive cursor-pointer">
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
