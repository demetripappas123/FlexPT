'use client'

import React, { useState, useEffect } from 'react'
import { NutritionGoal } from '@/supabase/fetches/fetchnutritiongoals'
import { upsertNutritionGoal } from '@/supabase/upserts/upsertnutritiongoals'
import { deleteNutritionGoal } from '@/supabase/deletions/deletenutritiongoal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type CompactNutritionGoalsProps = {
  clientId: string
  initialGoals: NutritionGoal[]
  onUpdate: () => void
}

export default function CompactNutritionGoals({ 
  clientId, 
  initialGoals, 
  onUpdate 
}: CompactNutritionGoalsProps) {
  const [goals, setGoals] = useState<NutritionGoal[]>(initialGoals)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })

  // Update goals when initialGoals change
  useEffect(() => {
    setGoals(initialGoals)
  }, [initialGoals])

  const currentGoal = goals.find(g => g.goal_month === selectedMonth)

  const [formData, setFormData] = useState({
    calorie_goal: currentGoal?.calorie_goal ?? null,
    protein_goal: currentGoal?.protein_goal ?? null,
    carbs_goal: currentGoal?.carbs_goal ?? null,
    fats_goal: currentGoal?.fats_goal ?? null,
  })

  // Update form when selected month changes
  useEffect(() => {
    const goal = goals.find(g => g.goal_month === selectedMonth)
    setFormData({
      calorie_goal: goal?.calorie_goal ?? null,
      protein_goal: goal?.protein_goal ?? null,
      carbs_goal: goal?.carbs_goal ?? null,
      fats_goal: goal?.fats_goal ?? null,
    })
  }, [selectedMonth, goals])

  const formatMonthDisplay = (monthStr: string) => {
    const date = new Date(monthStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const date = new Date(selectedMonth + 'T00:00:00')
    const currentYear = date.getFullYear()
    const currentMonth = date.getMonth()
    
    let newYear = currentYear
    let newMonth = currentMonth
    
    if (direction === 'prev') {
      if (currentMonth === 0) {
        newMonth = 11
        newYear = currentYear - 1
      } else {
        newMonth = currentMonth - 1
      }
    } else {
      if (currentMonth === 11) {
        newMonth = 0
        newYear = currentYear + 1
      } else {
        newMonth = currentMonth + 1
      }
    }
    
    setSelectedMonth(`${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`)
  }

  const handleSave = async () => {
    try {
      const result = await upsertNutritionGoal({
        client_id: clientId,
        goal_month: selectedMonth,
        calorie_goal: formData.calorie_goal,
        protein_goal: formData.protein_goal,
        carbs_goal: formData.carbs_goal,
        fats_goal: formData.fats_goal,
      })

      if (result) {
        const updatedGoals = [...goals]
        const existingIndex = updatedGoals.findIndex(g => g.goal_month === selectedMonth)
        if (existingIndex >= 0) {
          updatedGoals[existingIndex] = result
        } else {
          updatedGoals.push(result)
        }
        setGoals(updatedGoals)
        setIsDialogOpen(false)
        onUpdate()
      }
    } catch (err) {
      console.error('Failed to save nutrition goal:', err)
    }
  }

  const handleDelete = async () => {
    if (!currentGoal) return

    const confirmed = window.confirm('Are you sure you want to delete this month\'s goals?')
    if (!confirmed) return

    try {
      const success = await deleteNutritionGoal(currentGoal.id)
      if (success) {
        setGoals(goals.filter(g => g.id !== currentGoal.id))
        setFormData({
          calorie_goal: null,
          protein_goal: null,
          carbs_goal: null,
          fats_goal: null,
        })
        onUpdate()
      }
    } catch (err) {
      console.error('Failed to delete nutrition goal:', err)
    }
  }

  return (
    <>
      {/* Compact Display */}
      <div className="space-y-2">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md cursor-pointer text-foreground text-xs"
            >
              ←
            </button>
            <span className="text-sm text-muted-foreground">
              {formatMonthDisplay(selectedMonth)}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md cursor-pointer text-foreground text-xs"
            >
              →
            </button>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="px-3 py-1 bg-primary hover:bg-primary/90 rounded-md cursor-pointer text-primary-foreground text-sm"
          >
            {currentGoal ? 'Edit Goals' : 'Set Goals'}
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm p-2 bg-background rounded-md">
          <span className="text-muted-foreground">Calories:</span>
          <span className="text-foreground">{currentGoal?.calorie_goal ?? 'N/A'}</span>
          
          <span className="text-muted-foreground">Protein:</span>
          <span className="text-foreground">{currentGoal?.protein_goal ? `${currentGoal.protein_goal}g` : 'N/A'}</span>
          
          <span className="text-muted-foreground">Carbs:</span>
          <span className="text-foreground">{currentGoal?.carbs_goal ? `${currentGoal.carbs_goal}g` : 'N/A'}</span>
          
          <span className="text-muted-foreground">Fats:</span>
          <span className="text-foreground">{currentGoal?.fats_goal ? `${currentGoal.fats_goal}g` : 'N/A'}</span>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nutrition Goals</DialogTitle>
          </DialogHeader>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md cursor-pointer text-foreground"
            >
              ←
            </button>
            <span className="text-lg font-semibold">{formatMonthDisplay(selectedMonth)}</span>
            <button
              onClick={() => navigateMonth('next')}
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md cursor-pointer text-foreground"
            >
              →
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Calorie Goal
              </label>
              <input
                type="number"
                value={formData.calorie_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    calorie_goal: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g. 2000"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Protein Goal (g)
              </label>
              <input
                type="number"
                value={formData.protein_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    protein_goal: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g. 150"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Carbs Goal (g)
              </label>
              <input
                type="number"
                value={formData.carbs_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    carbs_goal: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g. 200"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Fats Goal (g)
              </label>
              <input
                type="number"
                value={formData.fats_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fats_goal: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g. 65"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 rounded-md cursor-pointer text-primary-foreground text-sm"
            >
              Save
            </button>
            <button
              onClick={() => setIsDialogOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-md cursor-pointer text-foreground text-sm"
            >
              Cancel
            </button>
            {currentGoal && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md cursor-pointer text-white text-sm"
              >
                Delete
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

