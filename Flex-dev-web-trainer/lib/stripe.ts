import Stripe from 'stripe'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add your Stripe test secret key to Flex-dev-web-trainer/.env.local'
    )
  }
  if (!stripe) {
    stripe = new Stripe(key)
  }
  return stripe
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}
