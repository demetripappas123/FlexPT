'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fetchPersonById } from '@/supabase/fetches/fetchpeople'
import { upsertClient } from '@/supabase/upserts/upsertperson'
import { Person } from '@/supabase/fetches/fetchpeople'
import { fetchPackages, Package } from '@/supabase/fetches/fetchpackages'
import { upsertPackage } from '@/supabase/upserts/upsertpackage'
import { upsertContract } from '@/supabase/upserts/upsertcontract'
import { createPersonPackagesForContract } from '@/supabase/utils/createPersonPackagesForContract'
import { useAuth } from '@/context/authcontext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ConversionPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const id = params.id as string
  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Package selection state
  const [packages, setPackages] = useState<Package[]>([])
  const [packageSelectionMode, setPackageSelectionMode] = useState<'existing' | 'new'>('existing')
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  
  // Contract form state
  const [contractDuration, setContractDuration] = useState<string>('')
  const [firstBillingDate, setFirstBillingDate] = useState<string>('')
  const [autoRenew, setAutoRenew] = useState<boolean>(false)
  
  // New package form state (when creating new package)
  const [packageName, setPackageName] = useState('')
  const [unitCost, setUnitCost] = useState<string>('')
  const [unitsPerCycle, setUnitsPerCycle] = useState<string>('')
  const [billingCycleWeeks, setBillingCycleWeeks] = useState<string>('')
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<string>('')

  useEffect(() => {
    const loadPerson = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      try {
        // Batch fetch person and packages in parallel
        const [personData, packagesData] = await Promise.all([
          fetchPersonById(id),
          fetchPackages(),
        ])

        if (!personData) {
          setError('Person not found')
          setLoading(false)
          return
        }

        // Check if person is already a client
        if (personData.converted_at !== null) {
          setError('This person is already a client')
          setLoading(false)
          return
        }

        setPerson(personData)
        setPackages(packagesData)
      } catch (err) {
        console.error('Error loading person:', err)
        setError('Failed to load person data')
      } finally {
        setLoading(false)
      }
    }

    loadPerson()
  }, [id])

  const handleConvertToClient = async () => {
    if (!person) return

    // Validate contract fields
    if (!contractDuration || parseInt(contractDuration) <= 0) {
      setError('Contract duration is required and must be greater than 0')
      return
    }
    if (!firstBillingDate) {
      setError('First billing date is required')
      return
    }

    let packageToUse: Package

    // Handle package selection or creation
    if (packageSelectionMode === 'new') {
      // Validate new package fields
      if (!packageName.trim()) {
        setError('Package name is required')
        return
      }
      if (!unitCost || parseFloat(unitCost) <= 0) {
        setError('Unit cost must be greater than 0')
        return
      }
      if (!unitsPerCycle || parseInt(unitsPerCycle) <= 0) {
        setError('Units per cycle must be greater than 0')
        return
      }
      if (!billingCycleWeeks || parseInt(billingCycleWeeks) <= 0) {
        setError('Billing cycle weeks must be greater than 0')
        return
      }

      // Create the new package
      packageToUse = await upsertPackage({
        name: packageName.trim(),
        unit_cost: parseFloat(unitCost),
        units_per_cycle: parseInt(unitsPerCycle),
        billing_cycle_weeks: parseInt(billingCycleWeeks),
        session_duration_minutes: sessionDurationMinutes ? parseInt(sessionDurationMinutes) : null,
      })
    } else {
      // Use existing package
      if (!selectedPackageId) {
        setError('Please select a package')
        return
      }
      const selectedPackage = packages.find(p => p.id === selectedPackageId)
      if (!selectedPackage) {
        setError('Selected package not found')
        return
      }
      packageToUse = selectedPackage
    }

    setConverting(true)
    setError(null)
    
    try {
      // Create the contract (copies package fields into contract row)
      await upsertContract({
        person_id: person.id,
        trainer_id: user?.id ?? null,
        start_date: firstBillingDate,
        package: packageToUse,
      })

      // Convert prospect to client and link the package
      await upsertClient({
        id: person.id,
        name: person.name,
        number: person.number || undefined,
        notes: person.notes || undefined,
        program_id: person.program_id || undefined,
        package_id: packageToUse.id,
        converted_at: new Date().toISOString(),
      })

      // Create person_packages rows (one per service per obligation cycle) with status 'payment pending'
      await createPersonPackagesForContract({
        personId: person.id,
        packageId: packageToUse.id,
        trainerId: user?.id ?? null,
        contractStartDate: firstBillingDate,
        durationMonths: parseInt(contractDuration),
      })

      // Redirect to the person's page
      router.push(`/people/${person.id}`)
    } catch (err) {
      console.error('Error converting prospect to client:', err)
      setError('Failed to convert prospect to client. Please try again.')
      setConverting(false)
    }
  }

  if (loading) {
    return (
      <main className="p-8 text-foreground bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="p-8 text-foreground bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/people')}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  if (!person) {
    return (
      <main className="p-8 text-foreground bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Person not found</p>
          <button
            onClick={() => router.push('/people')}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="p-8 text-foreground bg-background min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Convert Prospect to Client</h1>

        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Prospect Information</h2>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Name:</span> {person.name}
            </p>
            {person.number && (
              <p>
                <span className="font-semibold text-foreground">Number:</span> {person.number}
              </p>
            )}
            {person.notes && (
              <p>
                <span className="font-semibold text-foreground">Notes:</span> {person.notes}
              </p>
            )}
          </div>
        </div>

        <div className="bg-green-600/20 border border-green-600/50 rounded-lg p-4 mb-6">
          <p className="text-green-400">
            <strong>Info:</strong> Converting this prospect to a client will enable nutrition tracking and full client features. 
            Please create a contract and select or create a package below.
          </p>
        </div>

        {/* Contract Form */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Contract Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Contract Duration (Months) *
              </label>
              <Input
                type="number"
                min="1"
                value={contractDuration}
                onChange={(e) => setContractDuration(e.target.value)}
                placeholder="e.g., 12"
                className="bg-background text-foreground border-border placeholder-muted-foreground [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                First Billing Date *
              </label>
              <Input
                type="date"
                value={firstBillingDate}
                onChange={(e) => setFirstBillingDate(e.target.value)}
                className="bg-background text-foreground border-border placeholder-muted-foreground cursor-pointer"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRenew"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-2 cursor-pointer"
              />
              <label htmlFor="autoRenew" className="text-sm font-medium text-muted-foreground cursor-pointer">
                Auto Renew
              </label>
            </div>
          </div>
        </div>

        {/* Package Selection */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Package Selection</h2>
          
          <div className="mb-4">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setPackageSelectionMode('existing')}
                className={`px-4 py-2 rounded-md transition-colors cursor-pointer ${
                  packageSelectionMode === 'existing'
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Use Existing Package
              </button>
              <button
                onClick={() => setPackageSelectionMode('new')}
                className={`px-4 py-2 rounded-md transition-colors cursor-pointer ${
                  packageSelectionMode === 'new'
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Create New Package
              </button>
            </div>

            {packageSelectionMode === 'existing' ? (
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Select Package *
                </label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer"
                  required
                >
                  <option value="">Select a package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - ${pkg.unit_cost} per unit
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-muted-foreground">
                    Package Name *
                  </label>
                  <Input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="e.g., Standard Package"
                    className="bg-background text-foreground border-border placeholder-muted-foreground"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Unit Cost ($) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                      placeholder="0.00"
                      className="bg-background text-foreground border-border placeholder-muted-foreground [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Units Per Cycle *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={unitsPerCycle}
                      onChange={(e) => setUnitsPerCycle(e.target.value)}
                      placeholder="e.g., 12"
                      className="bg-background text-foreground border-border placeholder-muted-foreground [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Billing Cycle (Weeks) *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={billingCycleWeeks}
                      onChange={(e) => setBillingCycleWeeks(e.target.value)}
                      placeholder="e.g., 4"
                      className="bg-background text-foreground border-border placeholder-muted-foreground [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted-foreground">
                      Session Duration (Minutes)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={sessionDurationMinutes}
                      onChange={(e) => setSessionDurationMinutes(e.target.value)}
                      placeholder="e.g., 60"
                      className="bg-background text-foreground border-border placeholder-muted-foreground [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <Button
            onClick={() => router.push(`/people/${person.id}`)}
            variant="outline"
            className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvertToClient}
            disabled={converting}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white cursor-pointer disabled:bg-green-400 disabled:cursor-not-allowed"
          >
            {converting ? 'Converting...' : 'Convert to Client'}
          </Button>
        </div>
      </div>
    </main>
  )
}

