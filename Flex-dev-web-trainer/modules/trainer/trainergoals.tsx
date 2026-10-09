'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/supabase/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type TrainerGoal = {
  id: string
  trainer_id: string | null // UUID - will be set when auth is implemented
  monthly_revenue_goal: number | null
  commission_percentage: number | null
  client_goal: number | null
  trained_hours_goal: number | null
  daily_booking_goal: number | null
  created_at: string
  updated_at: string
}

type TrainerGoalsProps = {
  trainerId: string
}

export default function TrainerGoals({ trainerId }: TrainerGoalsProps) {
  const [trainerGoal, setTrainerGoal] = useState<TrainerGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const [formData, setFormData] = useState({
    monthly_revenue_goal: null as number | null,
    client_goal: null as number | null,
    trained_hours_goal: null as number | null,
    daily_booking_goal: null as number | null,
  })

  // Load trainer on mount and when trainerId changes
  useEffect(() => {
    loadTrainer()
  }, [trainerId])

  const loadTrainer = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('trainer_goals')
        .select('*')
        .eq('id', trainerId)
        .single()

      if (error) {
        console.error('Error loading trainer goals:', error)
        setTrainerGoal(null)
      } else {
        setTrainerGoal(data)
        setFormData({
          monthly_revenue_goal: data.monthly_revenue_goal,
          client_goal: data.client_goal,
          trained_hours_goal: data.trained_hours_goal,
          daily_booking_goal: data.daily_booking_goal,
        })
      }
    } catch (err) {
      console.error('Error loading trainer goals:', err)
      setTrainerGoal(null)
    } finally {
      setLoading(false)
    }
  }

  // Update form when trainer goal data changes
  useEffect(() => {
    if (trainerGoal) {
      setFormData({
        monthly_revenue_goal: trainerGoal.monthly_revenue_goal,
        client_goal: trainerGoal.client_goal,
        trained_hours_goal: trainerGoal.trained_hours_goal,
        daily_booking_goal: trainerGoal.daily_booking_goal,
      })
    }
  }, [trainerGoal])

  const handleSave = async () => {
    if (!trainerGoal) return

    try {
      const updateData = {
        monthly_revenue_goal: formData.monthly_revenue_goal,
        client_goal: formData.client_goal,
        trained_hours_goal: formData.trained_hours_goal,
        daily_booking_goal: formData.daily_booking_goal,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('trainer_goals')
        .update(updateData)
        .eq('id', trainerId)
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        setTrainerGoal(data)
        setIsDialogOpen(false)
      }
    } catch (err) {
      console.error('Failed to save trainer goals:', err)
      alert('Failed to save goals. Please try again.')
    }
  }

  const handleReset = () => {
    if (trainerGoal) {
      setFormData({
        monthly_revenue_goal: trainerGoal.monthly_revenue_goal,
        client_goal: trainerGoal.client_goal,
        trained_hours_goal: trainerGoal.trained_hours_goal,
        daily_booking_goal: trainerGoal.daily_booking_goal,
      })
    }
    setIsDialogOpen(false)
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading goals...</p>
  }

  if (!trainerGoal) {
    return <p className="text-muted-foreground">Trainer goals not found.</p>
  }

  return (
    <>
      {/* Compact Display */}
      <div className="space-y-4">
        {/* Goals Display */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-card rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Monthly Revenue Goal</div>
            <div className="text-lg font-semibold text-foreground">
              {trainerGoal.monthly_revenue_goal ? `$${trainerGoal.monthly_revenue_goal.toLocaleString()}` : 'N/A'}
            </div>
          </div>

          <div className="p-3 bg-card rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Client Goal</div>
            <div className="text-lg font-semibold text-foreground">
              {trainerGoal.client_goal ?? 'N/A'}
            </div>
          </div>

          <div className="p-3 bg-card rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Trained Hours Goal</div>
            <div className="text-lg font-semibold text-foreground">
              {trainerGoal.trained_hours_goal ?? 'N/A'} hrs
            </div>
          </div>

          <div className="p-3 bg-card rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Daily Booking Goal</div>
            <div className="text-lg font-semibold text-foreground">
              {trainerGoal.daily_booking_goal ?? 'N/A'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-md cursor-pointer text-primary-foreground text-sm"
        >
          Edit Goals
        </button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Trainer Goals</DialogTitle>
          </DialogHeader>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Monthly Revenue Goal ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monthly_revenue_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    monthly_revenue_goal: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="e.g. 10000"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Client Goal
              </label>
              <input
                type="number"
                value={formData.client_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    client_goal: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g. 20"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Trained Hours Goal
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.trained_hours_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    trained_hours_goal: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="e.g. 100"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Daily Booking Goal
              </label>
              <input
                type="number"
                value={formData.daily_booking_goal ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    daily_booking_goal: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="e.g. 5"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 rounded-md cursor-pointer text-primary-foreground text-sm"
            >
              Save
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-md cursor-pointer text-foreground text-sm"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
