'use client'

import React from 'react'
import { PersonPackage } from '@/supabase/fetches/fetchpersonpackages'
import { Package } from '@/supabase/fetches/fetchpackages'

type PackagesProps = {
  personPackages: PersonPackage[]
  packages: Package[]
}

export default function Packages({ personPackages, packages }: PackagesProps) {
  // DISABLED: Packages functionality temporarily disabled for architecture rework
  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <h2 className="text-lg font-semibold text-foreground mb-4">Packages</h2>
      <p className="text-muted-foreground text-sm">
        Packages functionality is temporarily disabled - architecture rework in progress
      </p>
    </div>
  )
  
  /* ORIGINAL CODE - KEPT FOR REFERENCE
  if (personPackages.length === 0) {
    return (
      <div className="p-4 bg-card border border-border rounded-md">
        <h2 className="text-lg font-semibold text-foreground mb-4">Packages</h2>
        <p className="text-muted-foreground text-sm">No packages assigned to this client.</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-card border border-border rounded-md">
      <h2 className="text-lg font-semibold text-foreground mb-4">Packages</h2>
      <div className="space-y-4">
        {personPackages.map((personPackage) => {
          const packageData = packages.find(pkg => pkg.id === personPackage.package_id)
          const remainingUnits = personPackage.total_units - personPackage.used_units
          
          return (
            <div key={personPackage.id} className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {packageData?.name || 'Unknown Package'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Status: <span className={`font-medium ${
                      personPackage.status === 'active' ? 'text-green-500' :
                      personPackage.status === 'pending' ? 'text-yellow-500' :
                      'text-muted-foreground'
                    }`}>
                      {personPackage.status}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="text-foreground font-medium">
                    {new Date(personPackage.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Date</p>
                  <p className="text-foreground font-medium">
                    {new Date(personPackage.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Units Used</p>
                  <p className="text-foreground font-medium">
                    {personPackage.used_units} / {personPackage.total_units}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining</p>
                  <p className={`font-medium ${
                    remainingUnits > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {remainingUnits}
                  </p>
                </div>
              </div>

              {packageData && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Unit Cost</p>
                      <p className="text-foreground font-medium">
                        ${Number(packageData.unit_cost).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Units per Cycle</p>
                      <p className="text-foreground font-medium">
                        {packageData.units_per_cycle}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Billing Cycle</p>
                      <p className="text-foreground font-medium">
                        {packageData.billing_cycle_weeks} weeks
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="text-white font-medium">
                        {packageData.session_duration_minutes ? `${packageData.session_duration_minutes} min` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
  */
}





