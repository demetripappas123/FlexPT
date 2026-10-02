'use client'

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import ChartSkeleton from './chartskeleton'
import { useTheme } from '@/context/themecontext'

type LeadSource = {
  source: string
  count: number
}

type LeadSourcesChartProps = {
  sources: LeadSource[]
  prospects?: Array<{ created_at: string; lead_source: string | null }>
  loading?: boolean
  dateRange?: 'today' | 'yesterday' | 'weekly' | 'monthly'
}

export default function LeadSourcesChart({ sources, loading }: LeadSourcesChartProps) {
  const { theme, variables } = useTheme()

  const chartData = useMemo(() => {
    if (!sources || sources.length === 0) return []

    return [...sources]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((source) => ({
        name: source.source || 'Unknown',
        count: source.count,
      }))
  }, [sources])

  const colors = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        text: variables.mutedForeground || '#9ca3af',
        bar: variables.primary || '#7c3aed',
        border: variables.border || '#2a2a2a',
      }
    }
    const computed = getComputedStyle(document.documentElement)
    return {
      text: computed.getPropertyValue('--muted-foreground').trim() || '#9ca3af',
      bar: computed.getPropertyValue('--primary').trim() || '#7c3aed',
      border: computed.getPropertyValue('--border').trim() || '#2a2a2a',
    }
  }, [theme, variables.mutedForeground, variables.primary, variables.border])

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string }; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
          <p className="text-xs font-medium">{payload[0].payload.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{payload[0].value} leads</p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 min-h-[300px]">
        <ChartSkeleton type="bar" title="Lead Sources" />
      </div>
    )
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 min-h-[300px] flex flex-col">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Lead sources</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No lead source data yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 min-h-[300px] flex flex-col">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Lead sources</h3>
      <div className="flex-1 min-h-[220px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
              barCategoryGap="28%"
            >
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.text, fontSize: 11 }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: colors.text, fontSize: 11 }}
                width={96}
              />
              <Tooltip
                cursor={{ fill: colors.border, opacity: 0.35 }}
                content={<CustomTooltip />}
              />
              <Bar
                dataKey="count"
                fill={colors.bar}
                fillOpacity={0.7}
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            No data available
          </div>
        )}
      </div>
    </div>
  )
}
