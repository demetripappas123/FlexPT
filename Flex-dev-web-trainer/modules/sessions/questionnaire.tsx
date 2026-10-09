'use client'

import React, { useState } from 'react'

type QuestionnaireProps = {
  sessionId: string
  prospectId: string | null
  onCompletionChange: (completed: boolean) => void
}

export default function Questionnaire({ sessionId, prospectId, onCompletionChange }: QuestionnaireProps) {
  const [completed, setCompleted] = useState(false)

  // This will be updated when questionnaire is actually implemented
  // For now, we'll track completion state
  const handleComplete = () => {
    setCompleted(true)
    onCompletionChange(true)
  }

  return (
    <div className="mt-8 bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-foreground">Questionnaire</h2>
        {completed && (
          <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-md">
            Completed
          </span>
        )}
      </div>
      {!completed ? (
        <div>
          <p className="text-muted-foreground mb-4">Questionnaire component will be implemented here.</p>
          {/* TODO: Implement questionnaire UI */}
          {/* For now, adding a temporary complete button for testing */}
          <button
            onClick={handleComplete}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md cursor-pointer"
          >
            Mark as Completed (Temporary)
          </button>
        </div>
      ) : (
        <p className="text-muted-foreground">Questionnaire has been completed.</p>
      )}
    </div>
  )
}

