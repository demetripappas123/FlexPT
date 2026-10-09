'use client'

import { useEffect, useState } from 'react'
import { fetchPackages, Package } from '@/supabase/fetches/fetchpackages'
import PackageList from '@/modules/packages/packagelist'
import { useAuth } from '@/context/authcontext'

export default function PackagesPage() {
  const { user } = useAuth()
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadPackages()
    }
  }, [user])

  const loadPackages = async () => {
    setLoading(true)
    try {
      // DISABLED: Packages table has been removed for architecture rework
      const packagesData = await fetchPackages()
      setPackages(packagesData)
    } catch (error) {
      console.error('Error loading packages:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-background text-foreground min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Packages</h1>
        </div>
        <p className="text-muted-foreground">Loading packages...</p>
      </div>
    )
  }

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Packages</h1>
        <p className="text-muted-foreground mt-2">Manage your training packages</p>
      </div>
      <PackageList packages={packages} onPackagesUpdate={loadPackages} />
    </div>
  )
}

