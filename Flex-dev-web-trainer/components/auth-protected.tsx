'use client'

import { useAuth } from '@/context/authcontext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/modules/sidebar'
import { isClientRole, signOut } from '@/supabase/auth/auth-helpers'

export default function AuthProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicPage = pathname === '/login' || pathname === '/landing'

  useEffect(() => {
    if (isPublicPage) return

    if (!loading && !user) {
      router.push('/landing')
      return
    }

    if (!loading && isClientRole(user)) {
      signOut().then(() => router.push('/login'))
    }
  }, [user, loading, router, isPublicPage])

  if (loading && !isPublicPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    )
  }

  if (isPublicPage) {
    return <>{children}</>
  }

  // If not logged in and not on a public page, don't render (redirect will happen)
  if (!user || isClientRole(user)) {
    return null
  }

  // Render protected content with sidebar
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 min-h-0 min-w-0 overflow-y-auto p-8 bg-background">
        {children}
      </main>
    </div>
  )
}

