'use client'

import React from 'react'
import EditNutrition from '@/modules/clients/editnutrition'
import NutritionChart from '@/modules/clients/nutritionchart'
import CompactNutritionGoals from '@/modules/clients/compactnutritiongoals'
import { NutritionEntry } from '@/supabase/fetches/fetchnutrition'
import { NutritionGoal } from '@/supabase/fetches/fetchnutritiongoals'
import { fetchClientNutritionGoals } from '@/supabase/fetches/fetchnutritiongoals'

type NutritionOverviewProps = {
  clientId: string
  nutritionEntries: NutritionEntry[]
  nutritionGoals: NutritionGoal[]
  isEditingNutrition: boolean
  onEditClick: () => void
  onSave: (entries: Omit<NutritionEntry, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>
  onCancel: () => void
  onGoalsUpdate: (goals: NutritionGoal[]) => void
}

export default function NutritionOverview({
  clientId,
  nutritionEntries,
  nutritionGoals,
  isEditingNutrition,
  onEditClick,
  onSave,
  onCancel,
  onGoalsUpdate,
}: NutritionOverviewProps) {
  return (
    <>
      {/* Nutrition Goals */}
      <div className="p-3 bg-card border border-border rounded-md mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">Nutrition Goals</h2>
        </div>
        <CompactNutritionGoals
          clientId={clientId}
          initialGoals={nutritionGoals || []}
          onUpdate={async () => {
            try {
              const goalsData = await fetchClientNutritionGoals(clientId)
              onGoalsUpdate(goalsData || [])
            } catch (err) {
              console.error('Error refreshing nutrition goals:', err)
            }
          }}
        />
      </div>

      <div className="p-4 bg-card border border-border rounded-md">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-foreground">Nutrition</h2>
          {!isEditingNutrition && (
            <button
              onClick={onEditClick}
              className="px-3 py-1 bg-primary hover:bg-primary/90 rounded-md cursor-pointer text-primary-foreground text-sm"
            >
              Edit Nutrition Information
            </button>
          )}
        </div>

        {isEditingNutrition ? (
          <EditNutrition
            clientId={clientId}
            initialEntries={nutritionEntries || []}
            onSave={onSave}
            onCancel={onCancel}
          />
        ) : (
          <NutritionChart entries={nutritionEntries || []} goals={nutritionGoals || []} />
        )}
      </div>
    </>
  )
}


