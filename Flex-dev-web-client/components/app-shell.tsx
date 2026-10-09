'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const linkClass = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? 'bg-stone-900 text-white'
        : 'text-stone-700 hover:bg-stone-100'
    }`

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold text-stone-900">
              FlexPT
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/" className={linkClass('/')}>
                Home
              </Link>
              <Link href="/check-ins" className={linkClass('/check-ins')}>
                Check-ins
              </Link>
            </nav>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              router.replace('/login')
            }}
            className="cursor-pointer text-sm text-stone-600 hover:text-stone-900"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  )
}
