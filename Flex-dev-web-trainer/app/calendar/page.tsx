// app/calendar/page.tsx
import Calendar from '@/modules/calendar/calendar'
import AddEventDialog from '@/modules/calendar/addevent'

export default function CalendarPage() {
  return (
    <div className="w-full h-full bg-background text-foreground p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-foreground">My Calendar</h1>
        <AddEventDialog />
      </div>
      <div className="w-full h-full">
        <Calendar />
      </div>
    </div>
  )
}
