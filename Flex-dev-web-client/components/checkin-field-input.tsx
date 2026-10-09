import { CheckinAssignmentField, CheckinFieldType } from '@/lib/checkins'

const SCALE_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

export default function CheckinFieldInput({
  field,
  value,
  onChange,
}: {
  field: CheckinAssignmentField
  value: string
  onChange: (next: string) => void
}) {
  const type: CheckinFieldType = field.field_type

  if (type === 'long_text') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900"
        placeholder="Type an answer"
        rows={4}
      />
    )
  }

  if (type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900"
        placeholder="0"
      />
    )
  }

  if (type === 'scale') {
    return (
      <div className="flex flex-wrap gap-1">
        {SCALE_VALUES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-8 w-8 cursor-pointer rounded-md border text-sm ${
              value === n
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    )
  }

  if (type === 'yes_no') {
    return (
      <div className="flex gap-2">
        {['yes', 'no'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`cursor-pointer rounded-md border px-3 py-2 text-sm capitalize ${
              value === option
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900"
      placeholder="Type an answer"
    />
  )
}
