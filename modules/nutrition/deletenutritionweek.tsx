import { useState } from "react"
import { deleteNutritionWeek } from "@/supabase/upserts/upsertnutritionweek"
import { Trash2 } from "lucide-react"

type DeleteNutritionWeekDialogProps = {
  weekId: number
  weekNumber: number
  onDeleted: (weekId: number) => void
  children?: React.ReactNode
}

export default function DeleteNutritionWeekDialog({
  weekId,
  weekNumber,
  onDeleted,
  children,
}: DeleteNutritionWeekDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete Week ${weekNumber}? This will also delete all days and meals in this week.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const success = await deleteNutritionWeek(weekId)
      if (success) {
        onDeleted(weekId)
      } else {
        alert("Failed to delete week")
      }
    } catch (err) {
      console.error("Error deleting week:", err)
      alert("Error deleting week. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  if (children) {
    return (
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="cursor-pointer disabled:opacity-50"
      >
        {children}
      </button>
    )
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-destructive hover:text-destructive/80 cursor-pointer disabled:opacity-50"
      title="Delete week"
    >
      <Trash2 className="h-5 w-5" />
    </button>
  )
}


