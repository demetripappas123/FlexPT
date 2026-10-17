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
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      {loading || value === null ? (
        <div className="h-8 bg-muted rounded animate-pulse"></div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            {icon && <span className="text-primary shrink-0">{icon}</span>}
            <p className="text-2xl font-normal tracking-tight text-foreground">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          {detail && <p className="text-[11px] text-muted-foreground mt-1">{detail}</p>}
        </div>
      )}
    </div>
  )
}

