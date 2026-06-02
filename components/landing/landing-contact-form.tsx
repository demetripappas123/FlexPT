'use client'

import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const labelClass = 'mb-1 block text-sm font-medium text-stone-700'
const inputClass =
  'border-stone-300 bg-white text-stone-900 placeholder:text-stone-400'

export function LandingContactForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState('')
  const [notes, setNotes] = useState('')
  const [receiveMessages, setReceiveMessages] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    // TODO: persist to CRM / database
    await new Promise((resolve) => setTimeout(resolve, 400))
    setSubmitted(true)
    setIsSubmitting(false)
  }

  if (submitted) {
    return (
      <p className="text-center text-base text-stone-600">
        Thanks — we&apos;ll be in touch soon.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="first-name" className={labelClass}>
            First name
          </label>
          <Input
            id="first-name"
            name="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
            className={inputClass}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="last-name" className={labelClass}>
            Last name
          </label>
          <Input
            id="last-name"
            name="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
            className={inputClass}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
          Phone number <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className={inputClass}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="business" className={labelClass}>
          Business <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <Input
          id="business"
          name="business"
          type="text"
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
          autoComplete="organization"
          className={inputClass}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <Textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything else you'd like us to know?"
          className={cn(inputClass, 'min-h-[6rem] resize-y')}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="receive-messages"
          name="receiveMessages"
          type="checkbox"
          checked={receiveMessages}
          onChange={(e) => setReceiveMessages(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-stone-300 text-brand focus:ring-brand"
        />
        <label
          htmlFor="receive-messages"
          className="cursor-pointer text-sm leading-snug text-stone-600"
        >
          I&apos;d like to receive messages from FlexPT
        </label>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full bg-brand text-brand-foreground hover:bg-[var(--brand-dark)] sm:w-auto"
      >
        {isSubmitting ? 'Submitting…' : 'Submit'}
      </Button>
    </form>
  )
}
