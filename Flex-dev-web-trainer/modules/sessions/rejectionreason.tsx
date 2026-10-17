'use client'

const REASONS = ['Price', 'Timing', 'Not a fit', 'Ghosted', 'No-show']

type RejectionReasonFieldProps = {
  value: string
  onChange: (value: string) => void
}

export default function RejectionReasonField({ value, onChange }: RejectionReasonFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">Rejection reason</label>
      <div className="flex flex-wrap gap-1.5">
        {REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={() => onChange(reason)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              value === reason
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {reason}
          </button>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Or write a reason"
        rows={2}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
      />
    </div>
  )
}
