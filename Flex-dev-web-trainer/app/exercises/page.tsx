'use client'

import ExerciseList from '@/modules/exercises/exerciselist'

export default function ExercisesPage() {
  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <div className="mb-6">
        <h1 className="text-[26px] font-normal tracking-tight text-foreground">Exercise Library</h1>
      </div>
      <ExerciseList />
    </div>
  )
}



