'use client'

import React from 'react'
import { Utensils } from 'lucide-react'

type NutritionSubTabsProps = {
  activeTab: 'overview' | 'meals'
  onTabChange: (tab: 'overview' | 'meals') => void
}

export default function NutritionSubTabs({ activeTab, onTabChange }: NutritionSubTabsProps) {
  return (
    <div className="flex gap-2 mb-4 border-b border-border">
      <button
        onClick={() => onTabChange('overview')}
        className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
          activeTab === 'overview'
            ? 'text-orange-500 border-b-2 border-orange-500'
            : 'text-muted-foreground hover:text-foreground'
        } cursor-pointer`}
      >
        Overview
      </button>
      <button
        onClick={() => onTabChange('meals')}
        className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
          activeTab === 'meals'
            ? 'text-orange-500 border-b-2 border-orange-500'
            : 'text-muted-foreground hover:text-foreground'
        } cursor-pointer`}
      >
        <Utensils className="h-4 w-4" />
        Meals
      </button>
    </div>
  )
}


