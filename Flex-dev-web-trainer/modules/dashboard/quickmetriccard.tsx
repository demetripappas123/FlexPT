'use client'

import React from 'react'

type QuickMetricCardProps = {
  title: string
  value: number | string | null
  detail?: string
  icon?: React.ReactNode
  loading?: boolean
}

export default function QuickMetricCard({ title, value, detail, icon, loading }: QuickMetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      {loading || value === null ? (
        <div className="h-8 bg-muted rounded animate-pulse"></div>
      ) : (
        <div>
          <p className="text-2xl font-normal tracking-tight text-foreground">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {detail && <p className="text-[11px] text-muted-foreground mt-1">{detail}</p>}
        </div>
      )}
    </div>
  )
}

