'use client'

import React, { useState } from 'react'
import { deleteWeek } from '@/supabase/deletions/deleteweek'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type DeleteWeekDialogProps = {
  weekId: string
  weekNumber: number
  onDeleted?: () => void
  children: React.ReactNode
}

export default function DeleteWeekDialog({
  weekId,
  weekNumber,
  onDeleted,
  children,
}: DeleteWeekDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteWeek(weekId)
      setIsDialogOpen(false)
      if (onDeleted) onDeleted()
    } catch (error) {
      console.error('Error deleting week:', error)
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
            <DialogTitle className="text-foreground">Delete Week</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this week?
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
