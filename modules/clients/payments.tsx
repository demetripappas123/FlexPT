'use client'

import React, { useState, useEffect } from 'react'
import { Payment } from '@/supabase/fetches/fetchpayments'
import { PersonPackage } from '@/supabase/fetches/fetchpersonpackages'
import { Package } from '@/supabase/fetches/fetchpackages'
import { Contract } from '@/supabase/fetches/fetchcontracts'
import { upsertPayment } from '@/supabase/upserts/upsertpayment'
import { validatePaymentAmountForPackage, applyPaymentToPersonPackages } from '@/supabase/utils/applyPaymentToPersonPackages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Pencil, Trash } from 'lucide-react'
import { deletePayment } from '@/supabase/deletions/deletepayment'

type PaymentsProps = {
  payments: Payment[]
  personPackages: PersonPackage[]
  packages: Package[]
  /** Contracts for this client (person_id) – options for which contract the payment goes to */
  contracts: Contract[]
  personId: string
  onPaymentAdded?: () => void
}

export default function Payments({ payments, personPackages, packages, contracts, personId, onPaymentAdded }: PaymentsProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)

  // Only contracts with a package_id can receive payments
  const contractsWithPackage = contracts.filter((c) => c.package_id != null)

  useEffect(() => {
    if (showAddForm && !editingPaymentId && contractsWithPackage.length === 1 && !selectedContractId) {
      setSelectedContractId(contractsWithPackage[0].id)
    }
  }, [showAddForm, editingPaymentId, contractsWithPackage, selectedContractId])

  const validSelectedContractId = contractsWithPackage.some((c) => c.id === selectedContractId) ? selectedContractId : ''
  const selectedContract = validSelectedContractId ? contractsWithPackage.find((c) => c.id === validSelectedContractId) : null

  const resetForm = () => {
    setSelectedContractId('')
    setAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setMethod('')
    setNotes('')
    setAmountError(null)
    setEditingPaymentId(null)
    setShowAddForm(false)
  }

  const handleEdit = (payment: Payment) => {
    setEditingPaymentId(payment.id)
    setAmount(payment.amount.toString())
    setPaymentDate(new Date(payment.payment_date).toISOString().split('T')[0])
    setMethod(payment.method || '')
    setNotes(payment.notes || '')
    setShowAddForm(true)
  }

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) {
      return
    }

    try {
      await deletePayment(paymentId)
      if (onPaymentAdded) {
        onPaymentAdded()
      }
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

    if (!editingPaymentId && !validSelectedContractId) {
      setAmountError('Please select a contract for this payment')
      return
    }

    if (!editingPaymentId && selectedContract) {
      const validation = validatePaymentAmountForPackage(
        amountNum,
        selectedContract.pif,
        selectedContract.pif_cost,
        selectedContract.default_cost_per_cycle
      )
      if (!validation.valid) {
        setAmountError(validation.error ?? 'Invalid amount for this contract')
        return
      }
    }

    setAmountError(null)
    setSaving(true)
    try {
      const paymentDateTimestamp = new Date(paymentDate).toISOString()

      const trainerId = selectedContract?.trainer_id ?? null

      if (editingPaymentId) {
        const existing = payments.find((p) => p.id === editingPaymentId)
        await upsertPayment({
          id: editingPaymentId,
          person_package_id: existing?.person_package_id ?? null,
          trainer_id: existing?.trainer_id ?? trainerId,
          amount: amountNum,
          payment_date: paymentDateTimestamp,
          method: method || null,
          notes: notes || null,
        })
      } else {
        const newPayment = await upsertPayment({
          person_package_id: null,
          trainer_id: trainerId,
          amount: amountNum,
          payment_date: paymentDateTimestamp,
          method: method || null,
          notes: notes || null,
        })

        const associatedPersonPackageId = await applyPaymentToPersonPackages(
          personId,
          selectedContract!.package_id!,
          amountNum
        )

        await upsertPayment({
          id: newPayment.id,
          person_package_id: associatedPersonPackageId,
          trainer_id: trainerId,
          amount: newPayment.amount,
          payment_date: newPayment.payment_date,
          method: newPayment.method,
          notes: newPayment.notes,
        })
      }

      resetForm()
      if (onPaymentAdded) {
        onPaymentAdded()
      }
    } catch (err) {
      console.error('Error saving payment:', err)
      setAmountError(err instanceof Error ? err.message : 'Failed to save payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-foreground">Payments</h2>
        <Button
          onClick={() => {
            resetForm()
            setShowAddForm(true)
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Payment
        </Button>
      </div>

      {/* Add/Edit Payment Form */}
      {showAddForm && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-foreground">
              {editingPaymentId ? 'Edit Payment' : 'Add New Payment'}
            </h3>
            <button
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            {!editingPaymentId && (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Payments are linked to a package. <strong>PIF</strong>: enter the PIF cost to mark all obligation cycles as paid. <strong>Recurring</strong>: enter a multiple of the cycle cost to pay one or more cycles in advance.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    Package (assigned to this client) *
                  </label>
                  <select
                    value={validSelectedPackageId}
                    onChange={(e) => {
                      setSelectedPackageId(e.target.value)
                      setAmountError(null)
                    }}
                    className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    aria-label="Select a package assigned to this client"
                  >
                    <option value="">Select a package assigned to this client</option>
                    {availablePackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.pif && p.pif_cost != null ? ` (PIF $${Number(p.pif_cost).toFixed(2)})` : ''}
                        {!p.pif && p.default_cost_per_cycle != null ? ` ($${Number(p.default_cost_per_cycle).toFixed(2)}/cycle)` : ''}
                      </option>
                    ))}
                  </select>
                  {availablePackages.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No packages assigned to this client. Assign a contract first.</p>
                  )}
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Amount ($) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setAmountError(null) }}
                  placeholder="0.00"
                  className="bg-input text-foreground border-border placeholder-muted-foreground [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  required
                />
                {!editingPaymentId && validSelectedPackageId && (() => {
                  const pkg = availablePackages.find((p) => p.id === validSelectedPackageId)
                  if (!pkg) return null
                  if (pkg.pif && pkg.pif_cost != null) {
                    return <p className="text-xs text-muted-foreground mt-1">PIF: enter exactly ${Number(pkg.pif_cost).toFixed(2)} to activate all obligation cycles.</p>
                  }
                  if (!pkg.pif && pkg.default_cost_per_cycle != null) {
                    const c = Number(pkg.default_cost_per_cycle)
                    return <p className="text-xs text-muted-foreground mt-1">Recurring: enter multiple of ${c.toFixed(2)} (e.g. ${c.toFixed(2)}, ${(c * 2).toFixed(2)}) to pay cycles in advance.</p>
                  }
                  return null
                })()}
                {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Payment Date *
                </label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-input text-foreground border-border cursor-pointer"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">
                Payment Method
              </label>
              <Input
                type="text"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="e.g., Credit Card, Cash, Bank Transfer"
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">
                Notes
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this payment"
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white cursor-pointer disabled:bg-green-400"
                size="sm"
              >
                {saving ? 'Saving...' : editingPaymentId ? 'Update Payment' : 'Save Payment'}
              </Button>
              <Button
                onClick={resetForm}
                variant="outline"
                className="bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payments List */}
      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No payments recorded for this client.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-4 text-sm font-semibold text-muted-foreground pb-2 border-b border-border">
            <div>Date</div>
            <div>Amount</div>
            <div>Method</div>
            <div>Package</div>
            <div>Notes</div>
            <div>Actions</div>
          </div>
          {payments.map((payment) => {
            const associatedPackage = personPackages.find(pp => pp.id === payment.person_package_id)
            const packageData = associatedPackage ? packages.find(pkg => pkg.id === associatedPackage.package_id) : null
            
            return (
              <div key={payment.id} className="grid grid-cols-6 gap-4 text-sm text-muted-foreground py-2 border-b border-border items-center">
                <div>
                  {new Date(payment.payment_date).toLocaleDateString()}
                </div>
                <div className="font-medium text-green-500">
                  ${Number(payment.amount).toFixed(2)}
                </div>
                <div>
                  {payment.method || '-'}
                </div>
                <div className="text-xs">
                  {packageData?.name || '-'}
                </div>
                <div className="text-xs truncate">
                  {payment.notes || '-'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(payment)}
                    className="text-muted-foreground hover:text-primary cursor-pointer"
                    title="Edit payment"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(payment.id)}
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                    title="Delete payment"
                  >
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

