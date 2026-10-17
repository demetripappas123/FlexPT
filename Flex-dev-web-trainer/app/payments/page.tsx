'use client'

import { useEffect, useState } from 'react'
import { fetchPayments } from '@/supabase/fetches/fetchpayments'
import { fetchContracts } from '@/supabase/fetches/fetchcontracts'
import { fetchClients } from '@/supabase/fetches/fetchpeople'
import { upsertPayment } from '@/supabase/upserts/upsertpayment'
import { applyPaymentToPersonPackages } from '@/supabase/utils/applyPaymentToPersonPackages'
import { Payment } from '@/supabase/fetches/fetchpayments'
import { Contract, contractAllowsManualPayment } from '@/supabase/fetches/fetchcontracts'
import { Person } from '@/supabase/fetches/fetchpeople'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [clients, setClients] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPersonId, setSelectedPersonId] = useState<string>('')
  const [selectedContractId, setSelectedContractId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [paymentsData, contractsData, clientsData] = await Promise.all([
          fetchPayments(),
          fetchContracts(),
          fetchClients(),
        ])
        setPayments(paymentsData)
        setContracts(contractsData)
        setClients(clientsData)
      } catch (err) {
        console.error('Error loading data:', err)
        alert('Error loading data. Please check the console for details.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const clientMap = new Map(clients.map((c) => [c.id, c]))
  const contractMap = new Map(contracts.map((c) => [c.id, c]))

  const contractsForPerson = selectedPersonId
    ? contracts.filter(
        (c) =>
          c.person_id === selectedPersonId &&
          c.package_id != null &&
          contractAllowsManualPayment(c)
      )
    : []

  const handleAddPayment = async () => {
    if (!selectedContractId || !amount || !paymentDate) {
      alert('Please fill in all required fields')
      return
    }

    const contract = contractMap.get(selectedContractId)
    if (!contract?.package_id) {
      alert('Selected contract has no package')
      return
    }
    if (!contractAllowsManualPayment(contract)) {
      alert('Record payment is only for organization-billed contracts.')
      return
    }

    setSaving(true)
    try {
      const processedAt = new Date(paymentDate).toISOString()
      const amountNum = parseFloat(amount)

      if (!contract.person_id) {
        throw new Error('Selected contract has no person')
      }

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
        contract.person_id,
        contract.id,
        amountNum,
        created.id != null ? String(created.id) : null,
        paymentDate
      )

      const paymentsData = await fetchPayments()
      setPayments(paymentsData)

      setShowAddForm(false)
      setSelectedPersonId('')
      setSelectedContractId('')
      setAmount('')
      setPaymentDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      console.error('Error creating payment:', err)
      alert('Error creating payment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-foreground">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="text-foreground">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[26px] font-normal tracking-tight">Payments Test UI</h1>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" />
          Record payment
        </Button>
      </div>

      {showAddForm && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-normal tracking-tight mb-4">Record organization payment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Client *</label>
              <select
                value={selectedPersonId}
                onChange={(e) => {
                  setSelectedPersonId(e.target.value)
                  setSelectedContractId('')
                }}
                className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Contract *</label>
              <select
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                disabled={!selectedPersonId}
                className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                required
              >
                <option value="">Select contract</option>
                {contractsForPerson.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Amount ($) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-card text-foreground border-border placeholder:text-muted-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Processed date *</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-card text-foreground border-border"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleAddPayment}
                disabled={saving}
                className="cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Payment'}
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedPersonId('')
                  setSelectedContractId('')
                  setAmount('')
                  setPaymentDate(new Date().toISOString().split('T')[0])
                }}
                variant="outline"
                className="cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-normal tracking-tight mb-4">All Payments ({payments.length})</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground">No payments found.</p>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              const contract = payment.contract_id ? contractMap.get(payment.contract_id) : null
              const client = contract ? clientMap.get(contract.person_id) : null

              return (
                <div key={payment.id} className="bg-background border border-border rounded-lg p-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">Amount:</span> $
                      {Number(payment.amount).toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">Date:</span>{' '}
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">Status:</span>{' '}
                      {payment.status ?? '-'}
                    </p>
                    {contract && (
                      <p>
                        <span className="font-semibold text-foreground">Contract:</span> {contract.name}
                      </p>
                    )}
                    {client && (
                      <p>
                        <span className="font-semibold text-foreground">Client:</span> {client.name}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
