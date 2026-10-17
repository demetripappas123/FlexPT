'use client'

import CheckinFormList from '@/modules/checkin-forms/checkinformlist'

export default function CheckinFormsPage() {
  return (
    <div className="w-full h-full bg-background text-foreground p-6">
      <h1 className="text-[26px] font-normal tracking-tight text-foreground mb-2">Check-in forms</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Templates for progress check-ins. Assign a form to a client from here or from the client Progress tab.
      </p>
      <CheckinFormList />
    </div>
  )
}
