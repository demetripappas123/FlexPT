'use client'

import React from 'react'
import AccountSettings from '@/modules/settings/account'

export default function SettingsPage() {
  return (
    <div className="w-full h-full bg-background text-foreground p-6">
      <h1 className="text-[26px] font-normal tracking-tight mb-6">Settings</h1>
      <AccountSettings />
    </div>
  )
}



