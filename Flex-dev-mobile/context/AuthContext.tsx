import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { getSession, onAuthStateChange } from '@/src/api/auth/auth-helpers'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSession().then(({ session, error }) => {
      if (error) console.error('Error getting session:', error)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = onAuthStateChange((_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, session, loading }}>{children}</AuthContext.Provider>
}
