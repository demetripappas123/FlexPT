'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/supabase/auth/auth-helpers'
import { useAuth } from '@/context/authcontext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default function AccountSettings() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = React.useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      const { error } = await signOut()
      if (error) {
        console.error('Error signing out:', error)
        alert('Error signing out. Please try again.')
        setLoading(false)
      } else {
        // Redirect to login page
        router.push('/login')
      }
    } catch (err) {
      console.error('Unexpected error signing out:', err)
      alert('Error signing out. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Account</h2>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Email
            </label>
            <p className="text-foreground">{user?.email || 'N/A'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              User ID
            </label>
            <p className="text-sm text-muted-foreground font-mono">{user?.id || 'N/A'}</p>
          </div>

          <div className="pt-4 border-t border-border">
            <Button
              onClick={handleLogout}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {loading ? 'Signing out...' : 'Sign Out'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}



