'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth-context'
import { isClientRole, signOut } from '@/lib/auth'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!isClientRole(user)) {
      signOut().then(() => router.replace('/login'))
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-700">
        Loading...
      </div>
    )
  }

  if (!user || !isClientRole(user)) return null

  return <>{children}</>
}
