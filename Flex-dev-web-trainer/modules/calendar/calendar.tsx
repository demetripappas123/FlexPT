'use client'

import { supabase } from '@/supabase/supabaseClient'
import React, { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput, DateSelectArg } from '@fullcalendar/core'
import { useRouter } from 'next/navigation'
import { fetchSessions, Session } from '@/supabase/fetches/fetchsessions'
import { fetchClients } from '@/supabase/fetches/fetchpeople'
import { fetchProspects } from '@/supabase/fetches/fetchpeople'
import { useTheme } from '@/context/themecontext'
import { useAuth } from '@/context/authcontext'

export default function Calendar() {
  const [events, setEvents] = useState<EventInput[]>([])
  const router = useRouter()
  const { variables } = useTheme()
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    const loadSessions = async () => {
      // Batch fetch all data in parallel
      const [sessions, clients, prospects] = await Promise.all([
        fetchSessions(user.id),
        fetchClients(user.id),
        fetchProspects(user.id),
      ])
      
      // Create a map for quick lookup
      const clientMap = new Map(clients.map(c => [c.id, c.name]))
      const prospectMap = new Map(prospects.map(p => [p.id, p.name]))
      
      setEvents(
        sessions
          .filter((s: Session) => 
            s.start_time && 
            s.status !== 'canceled_with_charge' && 
            s.status !== 'canceled_no_charge' &&
            s.trainer_id === user.id // Only show sessions for the logged-in trainer
          ) // Only include non-cancelled sessions with start times and matching trainer_id
          .map((s: Session) => {
            // Generate title from person name (primary), with session type as secondary info
            let personName = 'Unknown'
            if (s.person_id) {
              // Check if it's a client or prospect by looking up in the appropriate map
              personName = clientMap.get(s.person_id) || prospectMap.get(s.person_id) || 'Unknown'
            }
            
            return {
              id: s.id,
              title: personName, // Display person's name as the header
              start: s.start_time!,
              end: s.end_time || new Date(
                new Date(s.start_time!).getTime() + 60 * 60000 // Default 60 minutes if no end_time
              ).toISOString(),
              extendedProps: {
                sessionType: s.type, // Store session type in extended props if needed for tooltips/details
              },
            }
          })
      )
    }

    loadSessions()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    console.log('Selected date range:', selectInfo.startStr, selectInfo.endStr)
    // Trigger Add Event dialog here
  }

  const bgColor = variables.background
  const cardColor = variables.card
  const textColor = variables.foreground
  const borderColor = variables.border
  const mutedColor = variables.muted
  const mutedHoverColor = variables.muted
  const mutedActiveColor = variables.muted
  const mutedTextColor = variables.mutedForeground
  const disabledBgColor = variables.muted
  const disabledTextColor = variables.mutedForeground
  const eventBorderColor = variables.border
  const scrollbarThumbColor = variables.muted
  const scrollbarThumbHoverColor = variables.mutedForeground
  const primaryColor = variables.primary
  const primaryForegroundColor = variables.primaryForeground

  return (
    <div className="p-4 bg-card rounded shadow text-foreground h-full">
      <style jsx global>{`
        /* Calendar container */
        .fc {
          background-color: ${bgColor} !important;
          color: ${textColor} !important;
        }
        
        /* Header toolbar */
        .fc-header-toolbar {
          background-color: ${cardColor} !important;
          color: ${textColor} !important;
          border-color: ${borderColor} !important;
          padding: 1rem !important;
          margin-bottom: 1rem !important;
        }
        
        .fc-toolbar-title {
          color: ${textColor} !important;
          font-weight: 600 !important;
        }
        
        /* Buttons */
        .fc-button {
          background-color: ${mutedColor} !important;
          border-color: ${borderColor} !important;
          color: ${textColor} !important;
        }
        
        .fc-button:hover {
          background-color: ${mutedHoverColor} !important;
          border-color: ${borderColor} !important;
        }
        
        .fc-button-active {
          background-color: ${primaryColor} !important;
          border-color: ${primaryColor} !important;
          color: ${primaryForegroundColor} !important;
        }
        
        .fc-button:disabled {
          background-color: ${disabledBgColor} !important;
          border-color: ${borderColor} !important;
          color: ${disabledTextColor} !important;
        }
        
        /* Calendar grid */
        .fc-daygrid {
          background-color: ${cardColor} !important;
        }
        
        .fc-col-header {
          background-color: ${cardColor} !important;
        }
        
        .fc-col-header-cell {
          background-color: ${cardColor} !important;
          color: ${textColor} !important;
          border-color: ${borderColor} !important;
        }
        
        .fc-col-header-cell-cushion {
          color: ${textColor} !important;
        }
        
        /* Day cells */
        .fc-daygrid-day {
          background-color: ${cardColor} !important;
          border-color: ${borderColor} !important;
        }
        
        .fc-daygrid-day-frame {
          background-color: ${cardColor} !important;
        }
        
        .fc-daygrid-day-top {
          color: ${textColor} !important;
        }
        
        .fc-daygrid-day-number {
          color: ${textColor} !important;
        }
        
        .fc-day-today {
          background-color: ${cardColor} !important;
        }
        
        /* Events */
        .fc-event {
          cursor: pointer;
          border-color: ${eventBorderColor} !important;
        }
        
        .fc-event:hover {
          opacity: 0.8;
        }
        
        .fc-event-title {
          color: ${textColor} !important;
        }
        
        .fc-event-time {
          color: ${mutedTextColor} !important;
        }
        
        /* Time grid */
        .fc-timegrid {
          background-color: ${cardColor} !important;
        }
        
        .fc-timegrid-slot {
          border-color: ${borderColor} !important;
        }
        
        .fc-timegrid-slot-label {
          color: ${textColor} !important;
          border-color: ${borderColor} !important;
        }
        
        .fc-timegrid-axis {
          border-color: ${borderColor} !important;
          color: ${textColor} !important;
          background-color: ${cardColor} !important;
        }
        
        .fc-timegrid-col {
          border-color: ${borderColor} !important;
        }
        
        .fc-timegrid-col-frame {
          background-color: ${cardColor} !important;
        }
        
        /* Selected/highlighted */
        .fc-highlight {
          background-color: ${mutedColor} !important;
        }
        
        /* Scrollbar styling */
        .fc-scroller::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .fc-scroller::-webkit-scrollbar-track {
          background: ${bgColor};
        }
        
        .fc-scroller::-webkit-scrollbar-thumb {
          background: ${scrollbarThumbColor};
          border-radius: 4px;
        }
        
        .fc-scroller::-webkit-scrollbar-thumb:hover {
          background: ${scrollbarThumbHoverColor};
        }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        selectable
        selectMirror
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        select={handleDateSelect}
        eventClick={(info) => {
          if (info.event.id) {
            router.push(`/events/${info.event.id}`)
          }
        }}
        height="auto"
        themeSystem="standard"
      />
    </div>
  )
}
