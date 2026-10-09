# Theme Migration Guide

## Overview
This document outlines the comprehensive theme system implementation for light/dark mode support.

## Completed Components

### ✅ Core Infrastructure
- **Theme Context** (`context/themecontext.tsx`): Theme provider with localStorage persistence
- **Theme Toggle** (`components/theme-toggle.tsx`): Toggle button component
- **CSS Variables** (`app/globals.css`): Extended theme variables for all colors
- **Theme Utils** (`lib/theme-utils.ts`): Helper utilities (created but can be expanded)

### ✅ Updated Components
- **Dashboard Page** (`app/dash/page.tsx`): Main dashboard with theme variables
- **Sidebar** (`modules/sidebar.tsx`): Navigation sidebar with theme toggle
- **Quick Metric Card** (`modules/dashboard/quickmetriccard.tsx`): Dashboard metric cards
- **Toggle Revenue Card** (`modules/dashboard/togglerevenuecard.tsx`): Revenue chart with theme-aware ECharts
- **Lead Sources Chart** (`modules/dashboard/leadsourceschart.tsx`): Scatter chart with theme-aware colors

## Color Mapping

### Background Colors
- `bg-[#111111]` → `bg-[var(--bg-primary)]`
- `bg-[#1f1f1f]` → `bg-[var(--bg-secondary)]`
- `bg-[#2a2a2a]` → `bg-[var(--bg-tertiary)]`
- `bg-[#262626]` → `bg-[var(--bg-hover)]`
- `bg-[#181818]` → `bg-[var(--bg-primary)]`

### Text Colors
- `text-white` → `text-[var(--text-primary)]`
- `text-gray-400` → `text-[var(--text-secondary)]`
- `text-gray-300` → `text-[var(--text-secondary)]`
- `text-gray-500` → `text-[var(--text-tertiary)]`

### Border Colors
- `border-[#2a2a2a]` → `border-[var(--border-primary)]`
- `border-[#3a3a3a]` → `border-[var(--border-secondary)]`

## Remaining Components to Update

### High Priority
1. **Calendar Components** (`modules/calendar/`)
   - `calendar.tsx`: FullCalendar styling (uses inline styles)
   - `addevent.tsx`: Event dialog forms

2. **Client Components** (`modules/clients/`)
   - All client detail pages and forms
   - Chart components (nutrition, weight, RPE/RIR)

3. **Prospect Components** (`modules/prospects/`)
   - Display and add prospect dialogs

4. **Session Components** (`modules/sessions/`)
   - Session detail pages
   - Workout assignment dialogs

5. **Chart Components** (`modules/dashboard/`)
   - `closeratechart.tsx`
   - `showratechart.tsx`
   - `hourlyaveragechart.tsx`
   - `averagebookingschart.tsx`
   - `averagebookingsperdaychart.tsx`

### Medium Priority
6. **Page Components** (`app/`)
   - All page.tsx files in subdirectories
   - Login page
   - Settings pages

7. **Program Components** (`modules/programs/`)
   - Program display and editing

## ECharts Theme Integration

For ECharts components, use this pattern:

```typescript
import { useTheme } from '@/context/themecontext'
import { useEffect, useState } from 'react'

const { theme } = useTheme()
const [chartColors, setChartColors] = useState({
  textPrimary: '#d1d5db',
  border: '#2a2a2a',
  bg: '#1f1f1f',
})

useEffect(() => {
  const root = document.documentElement
  const computedStyle = getComputedStyle(root)
  setChartColors({
    textPrimary: computedStyle.getPropertyValue('--text-secondary').trim() || '#d1d5db',
    border: computedStyle.getPropertyValue('--border-primary').trim() || '#2a2a2a',
    bg: computedStyle.getPropertyValue('--bg-secondary').trim() || '#1f1f1f',
  })
}, [theme])
```

Then use `chartColors` in ECharts options.

## Testing Checklist

- [ ] Toggle theme and verify all components update
- [ ] Check contrast ratios for accessibility
- [ ] Verify charts are readable in both modes
- [ ] Test form inputs and buttons
- [ ] Check calendar component styling
- [ ] Verify navigation and sidebar
- [ ] Test on mobile/responsive views

## Notes

- Orange accent color (`#f97316`) remains consistent across themes
- Chart colors (orange for revenue, blue for sessions) stay the same
- CSS variables are defined in `globals.css` with light/dark variants
- Theme preference is saved to localStorage
- System preference is used as default if no saved preference




