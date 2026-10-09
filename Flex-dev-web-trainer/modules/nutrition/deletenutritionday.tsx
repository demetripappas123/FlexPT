import { useState } from "react"
import { deleteNutritionDay } from "@/supabase/upserts/upsertnutritionday"
import { Trash2 } from "lucide-react"

type DeleteNutritionDayDialogProps = {
  dayId: string
  dayTitle: string
  onDeleted: (dayId: string) => void
  children?: React.ReactNode
}

export default function DeleteNutritionDayDialog({
  dayId,
  dayTitle,
  onDeleted,
  children,
}: DeleteNutritionDayDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${dayTitle}"? This will also delete all meals in this day.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const success = await deleteNutritionDay(dayId)
      if (success) {
        onDeleted(dayId)
      } else {
        alert("Failed to delete day")
      }
    } catch (err) {
      console.error("Error deleting day:", err)
      alert("Error deleting day. Please try again.")
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
      title="Delete day"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

