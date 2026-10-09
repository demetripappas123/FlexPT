'use client'

import React, { useState } from 'react'
import { deleteDay } from '@/supabase/deletions/deleteday'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type DeleteDayDialogProps = {
  dayId: string
  dayName: string
  onDeleted?: () => void
  children: React.ReactNode
}

export default function DeleteDayDialog({
  dayId,
  dayName,
  onDeleted,
  children,
}: DeleteDayDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteDay(dayId)
      setIsDialogOpen(false)
      if (onDeleted) onDeleted()
    } catch (error) {
      console.error('Error deleting day:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div onClick={() => setIsDialogOpen(true)}>
        {children}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Day</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{dayName}"? This will also delete all exercises in this day.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
              className="cursor-pointer bg-muted text-foreground border-border hover:bg-muted/80 hover:text-foreground"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="cursor-pointer bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}










