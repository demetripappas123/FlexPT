'use client'

import { useAuth } from '@/context/authcontext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/modules/sidebar'

export default function AuthProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicPage = pathname === '/login' || pathname === '/landing'

  useEffect(() => {
    if (isPublicPage) return

    if (!loading && !user) {
      router.push('/landing')
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
  if (!user) {
    return null
  }

  // Render protected content with sidebar
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}

