'use client'

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import ChartSkeleton from './chartskeleton'
import { DateRange, getDateRangeBounds } from '@/supabase/utils/daterange'
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

export default function LeadSourcesChart({ sources, prospects = [], loading, dateRange = 'monthly' }: LeadSourcesChartProps) {
  const { theme } = useTheme()

  // Prepare bar chart data from sources
  const chartData = useMemo(() => {
    if (!sources || sources.length === 0) return []

    // Sort by count descending and take top sources
    return sources
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Show top 10 sources
      .map((source) => ({
        name: source.source || 'Unknown',
        count: source.count,
      }))
  }, [sources])

  // Get theme colors
  const getThemeColors = () => {
    if (typeof window === 'undefined') {
      return {
        textPrimary: '#d1d5db',
        textSecondary: '#9ca3af',
        border: '#2a2a2a',
        bg: '#1f1f1f',
        barColor: '#f97316',
      }
    }
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)
    return {
      textPrimary: computedStyle.getPropertyValue('--text-primary').trim() || '#d1d5db',
      textSecondary: computedStyle.getPropertyValue('--text-secondary').trim() || '#9ca3af',
      border: computedStyle.getPropertyValue('--border-primary').trim() || '#2a2a2a',
      bg: computedStyle.getPropertyValue('--bg-secondary').trim() || '#1f1f1f',
      barColor: '#f97316', // Orange color
    }
  }

  const colors = getThemeColors()

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
            padding: '8px 12px',
          }}
        >
          <p style={{ color: colors.textPrimary, margin: 0, fontSize: '12px' }}>
            <strong>{payload[0].payload.name}</strong>
          </p>
          <p style={{ color: colors.textSecondary, margin: '4px 0 0 0', fontSize: '12px' }}>
            Leads: {payload[0].value}
          </p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4 min-h-[300px]">
        <ChartSkeleton type="bar" title="Lead Sources" />
      </div>
    )
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4 min-h-[300px] flex flex-col">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Lead Sources</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[var(--text-secondary)] text-sm mb-2">No lead source data available</p>
            <p className="text-[var(--text-tertiary)] text-xs">Add prospects with lead sources to see data</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4 min-h-[300px] flex flex-col">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Lead Sources</h3>
      <div className="flex-1 min-h-[250px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250} minWidth={0}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis
                type="number"
                stroke={colors.textSecondary}
                tick={{ fill: colors.textSecondary, fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke={colors.textSecondary}
                tick={{ fill: colors.textSecondary, fontSize: 12 }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={colors.barColor} radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors.barColor} />
                ))}
              </Bar>
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
