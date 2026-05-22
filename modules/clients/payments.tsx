'use client'

import React, { useState, useEffect } from 'react'
import { Payment } from '@/supabase/fetches/fetchpayments'
import { Contract } from '@/supabase/fetches/fetchcontracts'
import { upsertPayment } from '@/supabase/upserts/upsertpayment'
import { validatePaymentAmountForPackage, applyPaymentToPersonPackages } from '@/supabase/utils/applyPaymentToPersonPackages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Pencil, Trash } from 'lucide-react'
import { deletePayment } from '@/supabase/deletions/deletepayment'

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
  const [amountError, setAmountError] = useState<string | null>(null)

  const contractsWithPackage = contracts.filter((c) => c.package_id != null)
  const contractMap = new Map(contracts.map((c) => [c.id, c]))

  useEffect(() => {
    if (showAddForm && !editingPaymentId && contractsWithPackage.length === 1 && !selectedContractId) {
      setSelectedContractId(contractsWithPackage[0].id)
    }
  }, [showAddForm, editingPaymentId, contractsWithPackage, selectedContractId])

  const validSelectedContractId = contractsWithPackage.some((c) => c.id === selectedContractId)
    ? selectedContractId
    : ''
  const selectedContract = validSelectedContractId
    ? contractsWithPackage.find((c) => c.id === validSelectedContractId)
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

    if (!editingPaymentId) {
      const validation = validatePaymentAmountForPackage(
        amountNum,
        contract.pif,
        contract.pif_cost,
        contract.default_cost_per_cycle
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
          status: existing.status ?? 'completed',
          payment_type: existing.payment_type,
        })
      } else {
        await applyPaymentToPersonPackages(personId, contract.package_id, amountNum)

        await upsertPayment({
          contract_id: contract.id,
          trainer_id: contract.trainer_id,
          amount: amountNum,
          currency: 'USD',
          status: 'completed',
          payment_type: contract.pif ? 'pif' : 'recurring',
          processed_at: processedAt,
          generated_obligations: true,
        })
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

      {showAddForm && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-foreground">
              {editingPaymentId ? 'Edit Payment' : 'Add New Payment'}
            </h3>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            {!editingPaymentId && (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Payment is linked to a contract. <strong>PIF</strong>: enter the PIF cost to mark all
                  obligation cycles paid. <strong>Recurring</strong>: enter a multiple of the per-cycle cost.
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
                    {contractsWithPackage.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.pif && c.pif_cost != null ? ` (PIF $${Number(c.pif_cost).toFixed(2)})` : ''}
                        {!c.pif && c.default_cost_per_cycle != null
                          ? ` ($${Number(c.default_cost_per_cycle).toFixed(2)}/cycle)`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {contractsWithPackage.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No active contracts with a package.</p>
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

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No payments recorded for this client.</p>
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
