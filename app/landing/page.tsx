'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Dumbbell,
  LayoutDashboard,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'See your business at a glance with sessions, revenue, and client activity in one place.',
  },
  {
    icon: Users,
    title: 'Clients & Prospects',
    description: 'Manage your roster from first inquiry through onboarding and long-term coaching.',
  },
  {
    icon: Calendar,
    title: 'Calendar',
    description: 'Schedule sessions, track events, and keep every appointment organized.',
  },
  {
    icon: Dumbbell,
    title: 'Programs & Workouts',
    description: 'Build training programs and maintain a workout library you can reuse with any client.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Nutrition',
    description: 'Plan nutrition guidance and keep meal resources in your library for quick assignment.',
  },
]

export default function LandingPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dash')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-2xl font-bold">TurboTrain</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-primary">
            Built for personal trainers
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Run your coaching business from one place
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            TurboTrain helps you manage clients, programs, scheduling, and nutrition so you can
            spend less time on admin and more time coaching.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">Create your account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in to your account</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-card/50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-center text-2xl font-bold md:text-3xl">
              Everything you need to coach at scale
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              From prospect to paying client — programs, sessions, and nutrition in a single
              workflow.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 inline-flex rounded-md bg-primary/10 p-3 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Ready to get started?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Sign up in minutes and start organizing your clients, calendar, and programs today.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/login">Get started free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} TurboTrain
        </div>
      </footer>
    </div>
  )
}
