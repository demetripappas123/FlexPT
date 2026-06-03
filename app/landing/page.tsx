'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Menu, X } from 'lucide-react'
import { useAuth } from '@/context/authcontext'
import { Button } from '@/components/ui/button'
import { HeroMockupCarousel } from '@/components/landing/hero-mockup-carousel'
import { LandingContactForm } from '@/components/landing/landing-contact-form'
import {
  HeroEntrance,
  HeroEntranceItem,
  HeroSlideIn,
  ScrollReveal,
  StaggerItem,
  StaggerReveal,
} from '@/components/landing/scroll-reveal'
import { cn } from '@/lib/utils'

const HERO_BG = '#fafafa'

const HERO_LINK_ROWS = [
  'Hands-off lead generation',
  'Lead Nurturing Automations',
  'Proven client retention systems',
  'Automated and accelerated coaching workflows',
] as const

const SECTION_BELOW_HERO = 'features'

const features = [
  {
    headline: 'Capture Leads',
    bullets: [
      'Auto generate your custom conversion page',
      'Link to this site from your Instagram, TikTok, Google reviews, and more',
      'Use this link in your ManyChats automation to auto respond to comments and DMs on social media',
      'Prospects can book consultations directly, fill out forms, or purchase services all from your conversion page',
      'Actively source incoming leads so you know highest yield platforms',
    ],
  },
  {
    headline: 'Nurture Leads',
    bullets: [
      'See show rates, and close rates',
      'Display top revenue and deals from each marketing source',
      'Create contact automations for new lead followups, consultation reminders, no-show recovery, and client onboarding',
      'See revenue trends and set booking goals to reach your desired income',
    ],
  },
  {
    headline: 'Keep Clients',
    bullets: [
      '3000+ exercises, including powerlifting, calisthenics, combat-sports based, HIIT training, and corrective exercises',
      'Upload your existing regimens into FlexPT workouts or build new ones with our advanced AI workout and nutrition program editors',
      'Assign meals from our 2000+ food database',
      'Gain granular access to RPE, RIR, volume per muscle group, and advanced progress metrics',
      'See client compliance scores',
      'Customize your own version of the client app',
    ],
  },
  {
    headline: 'Train Smarter',
    bullets: [
      'Automate workout prescriptions, meal prescriptions',
      'Generate workouts from history with our advanced AI workout and nutrition program editors',
      'Automate client check-in messages, session reminders, progress forms, and more,"',
    ],
  },
]

export default function LandingPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.push('/dash')
    }
  }, [user, loading, router])

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('landing-page')
    return () => document.documentElement.classList.remove('landing-page')
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 400) setMobileNavOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div
      className="flex min-h-screen flex-col text-foreground"
      style={{ backgroundColor: HERO_BG }}
    >
      <main className="flex flex-col">
        <header
          className={cn(
            'landing-header text-stone-900',
            navScrolled && 'landing-header--scrolled'
          )}
        >
          <div className="landing-page-x relative mx-auto flex h-full w-full max-w-7xl flex-col px-3 sm:px-4">
            <div className="landing-header-inner flex w-full items-center gap-4 lg:gap-6">
              <Link
                href="#overview"
                className="landing-header-logo shrink-0 text-2xl font-bold"
                onClick={() => setMobileNavOpen(false)}
              >
                FlexPT
              </Link>
              <div className="ml-auto hidden min-[401px]:flex shrink-0 items-center gap-2 sm:gap-3">
                <Button asChild variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button
                  asChild
                  className="bg-brand text-brand-foreground hover:bg-[var(--brand-dark)]"
                >
                  <Link href="#contact">Join waitlist</Link>
                </Button>
              </div>
              <button
                type="button"
                className="ml-auto inline-flex min-[401px]:hidden size-10 shrink-0 items-center justify-center rounded-md text-stone-800 transition-colors hover:bg-stone-200/60"
                aria-expanded={mobileNavOpen}
                aria-controls="landing-mobile-nav"
                aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                {mobileNavOpen ? (
                  <X className="size-5" aria-hidden />
                ) : (
                  <Menu className="size-5" aria-hidden />
                )}
              </button>
            </div>
            <div
              id="landing-mobile-nav"
              className={cn(
                'absolute left-0 right-0 top-full z-30 min-[401px]:hidden border-b border-stone-200/80 px-3 py-3 shadow-sm',
                navScrolled
                  ? 'border-stone-200/50 bg-[rgb(250_250_249/0.92)] backdrop-blur-md'
                  : 'bg-[#fafafa]',
                mobileNavOpen ? 'flex flex-col gap-2' : 'hidden'
              )}
            >
              <Button asChild variant="outline" className="w-full">
                <Link href="/login" onClick={() => setMobileNavOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button
                asChild
                className="w-full bg-brand text-brand-foreground hover:bg-[var(--brand-dark)]"
              >
                <Link href="#contact" onClick={() => setMobileNavOpen(false)}>
                  Join waitlist
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero: full viewport below the fixed navbar strip */}
        <section
          id="overview"
          className="landing-hero relative z-0 flex w-full shrink-0 flex-col overflow-visible text-stone-900 max-[899px]:overflow-x-visible max-[899px]:overflow-y-visible min-[900px]:overflow-x-clip"
          style={{ backgroundColor: HERO_BG }}
        >
          <div className="landing-page-x mx-auto flex w-full max-w-7xl flex-col px-3 sm:px-4 min-[900px]:min-h-0 min-[900px]:flex-1">
            <div className="landing-hero-body relative flex w-full flex-col gap-0 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:flex-row min-[900px]:items-start min-[900px]:gap-8">
              <HeroEntrance className="relative z-30 flex w-full shrink-0 flex-col items-center justify-start text-center min-[900px]:min-w-0 min-[900px]:flex-[2] min-[900px]:basis-0 min-[900px]:items-start min-[900px]:text-left">
                <HeroEntranceItem>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-brand sm:text-sm">
                    built by personal trainers
                  </p>
                </HeroEntranceItem>
                <HeroEntranceItem>
                  <h1 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl md:text-3xl lg:text-[2.25rem] lg:leading-tight xl:text-4xl">
                    <span>Get Clients,</span> <span>Keep Clients,</span>{' '}
                    <span>and Automate Your Business Growth.</span>
                  </h1>
                </HeroEntranceItem>
                <HeroEntranceItem>
                  <p className="mt-4 max-w-lg text-base font-semibold leading-relaxed text-stone-800 sm:mt-5">
                    Join our Private Alpha! We&apos;re in early development and your
                    feedback will shape the evolution of our product!
                  </p>
                </HeroEntranceItem>
                <HeroEntranceItem>
                  <div className="my-6 mx-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-3 sm:gap-4 sm:my-7 min-[900px]:mx-0 min-[900px]:justify-start min-[900px]:pl-3">
                    <Button
                      asChild
                      className="bg-brand text-brand-foreground hover:bg-[var(--brand-dark)]"
                    >
                      <Link href="/login">Join Now!</Link>
                    </Button>
                    <Button
                      asChild
                      className="bg-brand text-brand-foreground hover:bg-[var(--brand-dark)]"
                    >
                      <Link
                        href={`#${SECTION_BELOW_HERO}`}
                        className="inline-flex items-center gap-1.5"
                      >
                        See More
                        <ChevronDown className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </HeroEntranceItem>
                <HeroEntranceItem>
                  <div className="mt-4 flex w-full max-w-md flex-col gap-2 sm:mt-5 min-[900px]:max-w-lg">
                    {HERO_LINK_ROWS.map((rowLabel) => (
                      <Link
                        key={rowLabel}
                        href={`#${SECTION_BELOW_HERO}`}
                        className="block rounded-lg border border-stone-200/90 bg-white/70 px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-stone-300 hover:bg-white sm:px-4 sm:py-3"
                      >
                        <span className="text-sm font-medium leading-snug text-stone-800 sm:text-base">
                          {rowLabel}
                        </span>
                      </Link>
                    ))}
                  </div>
                </HeroEntranceItem>
              </HeroEntrance>

              {/* Mockups: own block below the 4 rows until 900px */}
              <HeroSlideIn className="relative z-10 mt-14 w-full shrink-0 overflow-visible pb-4 pt-1 min-[900px]:mt-0 min-[900px]:min-h-0 min-[900px]:min-w-0 min-[900px]:flex-[3] min-[900px]:basis-0 min-[900px]:pb-0 min-[900px]:pt-0">
                <HeroMockupCarousel />
              </HeroSlideIn>
            </div>
          </div>
        </section>

        {/* Features — directly below hero */}
        <section
          id="features"
          className="relative z-10 flex min-h-[100dvh] w-full shrink-0 scroll-mt-[var(--landing-nav-height)] flex-col justify-center border-t border-stone-800 bg-[#1a1a1a] py-12 text-stone-100 sm:py-16"
        >
          <div className="relative z-10 mx-auto w-full max-w-7xl px-3 sm:px-4">
            <ScrollReveal>
              <h2 className="text-center text-2xl font-bold text-white md:text-3xl">
                Everything you need to coach at scale
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <p className="mx-auto mt-4 max-w-2xl text-center text-stone-400">
                From prospect to paying client — programs, sessions, and nutrition in a single
                workflow.
              </p>
            </ScrollReveal>
            <StaggerReveal className="mt-10 flex flex-col gap-4 lg:mt-12 lg:flex-row lg:items-stretch lg:gap-5">
              {features.map(({ headline, bullets }, index) => (
                <StaggerItem key={headline} className="flex min-w-0 flex-1">
                  <div className="flex min-w-0 flex-1 flex-col items-start rounded-lg border border-stone-700/80 bg-stone-900/50 p-5 shadow-sm sm:p-6">
                    <span className="text-sm font-semibold tabular-nums tracking-wide text-stone-500">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-2 shrink-0 text-lg font-semibold text-white">{headline}</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-stone-400">
                      {bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </StaggerItem>
              ))}
            </StaggerReveal>
          </div>
        </section>

        <section
          id="contact"
          className="shrink-0 scroll-mt-[var(--landing-nav-height)] border-t border-stone-200/80 bg-[#fafafa] py-14 text-stone-900 sm:py-16"
        >
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
            <ScrollReveal>
              <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
                Get in touch
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.08}>
              <p className="mx-auto mt-3 max-w-lg text-center text-stone-600">
                Join the private alpha or ask us a question — we&apos;ll reach out when we can.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.14} amount={0.1}>
              <div className="mt-10">
                <LandingContactForm />
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-border bg-background">
        <div className="mx-auto w-full max-w-7xl py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} FlexPT
        </div>
      </footer>
    </div>
  )
}
