'use client'

import React from 'react'

type ChartSkeletonProps = {
  type?: 'circular' | 'bar' | 'line' | 'number'
  title?: string
}

export default function ChartSkeleton({ type = 'number', title }: ChartSkeletonProps) {
  if (type === 'circular') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        {title && <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>}
        <div className="relative w-full max-w-[280px] h-[280px]">
          <div className="w-full h-full rounded-full border-8 border-border animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2 mx-auto" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse mx-auto" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'bar' || type === 'line') {
    return (
      <div className="w-full h-full flex flex-col p-4">
        {title && <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '100%' }} />
          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '85%' }} />
          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '70%' }} />
          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '90%' }} />
          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    )
  }

  // Default: number display
  return (
    <div className="w-full h-full flex flex-col p-4">
      {title && <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-32 bg-muted rounded animate-pulse mb-2 mx-auto" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  )
}

