// app/programs/page.tsx
'use client'

import React from 'react'
import AddProgramDialog from '@/modules/programs/addprogram'
import ShowPrograms from '@/modules/programs/showprograms'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ProgramsPage() {
  return (
    <div className="w-full h-full bg-background text-foreground p-6">
      <h1 className="text-3xl font-bold text-foreground mb-4">
        Programs
      </h1>
      <div className="mb-4 flex justify-start">
        <AddProgramDialog>
          <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
            <Plus className="h-4 w-4" />
            <span>Add Program</span>
          </Button>
        </AddProgramDialog>
      </div>
      <ShowPrograms />
    </div>
  )
}
