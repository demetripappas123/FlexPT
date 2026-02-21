import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash } from "lucide-react"
import { Food } from "@/supabase/fetches/fetchfoods"
import { NutritionDay } from "@/supabase/fetches/fetchnutritionweeks"
import { fetchFoodUnits, FoodUnit } from "@/supabase/fetches/fetchfoodunits"
import { fetchMealTemplates, MealTemplate } from "@/supabase/fetches/fetchmealtemplates"
import { supabase } from "@/supabase/supabaseClient"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

type LocalFood = {
  food_id: string | null // Food id from foods table (string)
  food_name: string | null
  amount: number | null
  unit: string | null // food_unit id
}

type LocalMeal = {
  meal_time: string | null
  name: string | null
  foods: LocalFood[] // Multiple foods per meal
  notes: string | null
}

type AddNutritionDayDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    dayTitle: string
    dayOfWeek: string
    date: string | null
    meals: LocalMeal[]
    dayId?: string
  }) => void
  weekId: string
  foodLibrary: Food[]
  dayId?: string // If provided, dialog is in edit mode
  initialDayData?: NutritionDay // Day data for edit mode
}

export default function AddNutritionDayDialog({
  open,
  onOpenChange,
  onSubmit,
  weekId,
  foodLibrary,
  dayId,
  initialDayData,
}: AddNutritionDayDialogProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [dayOfWeek, setDayOfWeek] = useState<string>("Monday")
  const [meals, setMeals] = useState<LocalMeal[]>([])
  const [openCombobox, setOpenCombobox] = useState<{ [mealIndex: number]: { [foodIndex: number]: boolean } }>({})
  const [searchValue, setSearchValue] = useState<{ [mealIndex: number]: { [foodIndex: number]: string } }>({})
  const [foodUnits, setFoodUnits] = useState<FoodUnit[]>([])
  const [templates, setTemplates] = useState<MealTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    getUser()
  }, [])

  // Fetch food units and templates when dialog opens
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        const units = await fetchFoodUnits()
        setFoodUnits(units)
        
        if (userId) {
          setLoadingTemplates(true)
          const fetchedTemplates = await fetchMealTemplates(userId)
          setTemplates(fetchedTemplates)
          setLoadingTemplates(false)
        }
      }
      loadData()
    }
  }, [open, userId])

  // Reset form state when dialog opens, or load existing data if editing
  useEffect(() => {
    if (open) {
      if (dayId && initialDayData) {
        // Edit mode: load existing data
        setDayOfWeek(initialDayData.day_of_week)
        const mappedMeals: LocalMeal[] = initialDayData.meals.map(meal => ({
          meal_time: meal.meal_time || null,
          name: meal.name,
          foods: meal.foods.map(food => ({
            food_id: null, // We don't store food.id, only fdc_id
            food_name: food.food_name,
            amount: food.amount || null, // Already a number (int4)
            unit: food.unit,
          })),
          notes: meal.description || null, // Use description field
        }))
        setMeals(mappedMeals)
      } else {
        // Add mode: reset all form state
        setDayOfWeek("Monday")
        setMeals([])
      }
      setOpenCombobox({})
      setSearchValue({})
    }
  }, [open, dayId, initialDayData])

  const addMeal = () => {
    setMeals(prev => [
      ...prev,
      {
        meal_time: null,
        name: null,
        foods: [],
        notes: null,
      },
    ])
  }

  const removeMeal = (index: number) => {
    setMeals(prev => prev.filter((_, i) => i !== index))
  }

  const addFoodToMeal = (mealIndex: number) => {
    setMeals(prev => prev.map((meal, i) => 
      i === mealIndex 
        ? { ...meal, foods: [...meal.foods, { food_id: null, food_name: null, amount: null, unit: null }] }
        : meal
    ))
  }

  const removeFoodFromMeal = (mealIndex: number, foodIndex: number) => {
    setMeals(prev => prev.map((meal, i) => 
      i === mealIndex 
        ? { ...meal, foods: meal.foods.filter((_, fi) => fi !== foodIndex) }
        : meal
    ))
  }

  const updateMeal = <K extends keyof LocalMeal>(
    mealIndex: number,
    key: K,
    value: LocalMeal[K]
  ) => {
    setMeals(prev => prev.map((meal, i) => (i === mealIndex ? { ...meal, [key]: value } : meal)))
  }

  const updateFood = (
    mealIndex: number,
    foodIndex: number,
    key: keyof LocalFood,
    value: LocalFood[keyof LocalFood]
  ) => {
    setMeals(prev => prev.map((meal, i) => 
      i === mealIndex 
        ? {
            ...meal,
            foods: meal.foods.map((food, fi) => 
              fi === foodIndex ? { ...food, [key]: value } : food
            )
          }
        : meal
    ))
  }

  const addMealFromTemplate = async (mealIndex: number, templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return

    // Add all foods from template to the meal
    const templateFoods: LocalFood[] = template.foods.map(food => ({
      food_id: null, // We'll need to find the food by name or fdc_id
      food_name: food.food_name,
      amount: food.amount,
      unit: food.unit,
    }))

    setMeals(prev => prev.map((meal, i) => 
      i === mealIndex 
        ? { 
            ...meal, 
            name: template.name || meal.name,
            foods: [...meal.foods, ...templateFoods]
          }
        : meal
    ))
  }

  const handleSubmit = () => {
    onSubmit({
      dayTitle: "",
      dayOfWeek,
      date: null,
      meals,
      dayId: dayId,
    })
    onOpenChange(false)
  }

  const getFoodName = (foodId: string | null): string => {
    if (!foodId) return ""
    const food = foodLibrary.find(f => f.id === foodId)
    return food?.description || ""
  }

  // Default dialog rendering
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[70vh] max-h-[70vh] overflow-hidden bg-card border-border text-card-foreground flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-foreground">
            {dayId ? "Edit Nutrition Day" : "Add Nutrition Day"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Day info */}
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
          </div>

          {/* Meals */}
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            <div className="flex items-center justify-between flex-shrink-0">
              <label className="text-sm font-medium text-foreground">Meals</label>
              <Button
                type="button"
                onClick={addMeal}
                variant="outline"
                size="sm"
                className="bg-muted text-foreground border-border hover:bg-muted/80"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Meal
              </Button>
            </div>

            <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 flex-1 min-h-0">
              {meals.map((meal, mealIndex) => (
                <div key={mealIndex} className="border border-border p-3 rounded-md bg-background min-w-[280px] max-w-[280px] flex-shrink-0 relative flex flex-col">
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => removeMeal(mealIndex)}
                  className="text-destructive hover:text-destructive/80 cursor-pointer"
                  title="Remove meal"
                >
                  <Trash size={16} />
                </button>
              </div>

              <div className="space-y-3 pr-6">
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-foreground">Meal Name</label>
                    <Input
                      value={meal.name || ""}
                      onChange={(e) => {
                        const value = e.target.value || null
                        updateMeal(mealIndex, "name", value)
                      }}
                      placeholder="e.g. Breakfast, Lunch, Dinner"
                      className="bg-input text-foreground border-border placeholder-muted-foreground text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Meal Time (optional)</label>
                    <Input
                      type="time"
                      value={meal.meal_time || ""}
                      onChange={(e) => {
                        const value = e.target.value || null
                        updateMeal(mealIndex, 'meal_time', value)
                      }}
                      className="bg-input text-foreground border-border placeholder-muted-foreground text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Add from Template</label>
                    {loadingTemplates ? (
                      <p className="text-xs text-muted-foreground">Loading templates...</p>
                    ) : templates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No templates found</p>
                    ) : (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addMealFromTemplate(mealIndex, e.target.value)
                            e.target.value = ""
                          }
                        }}
                        className="w-full px-2 py-1.5 bg-input text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      >
                        <option value="">Select template...</option>
                        {templates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name || 'Unnamed Template'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Foods for this meal */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Foods</label>
                    <Button
                      type="button"
                      onClick={() => addFoodToMeal(mealIndex)}
                      variant="outline"
                      size="sm"
                      className="bg-muted text-foreground border-border hover:bg-muted/80"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Food
                    </Button>
                  </div>

                  {meal.foods.map((food, foodIndex) => (
                    <div key={foodIndex} className="border border-border p-3 rounded-md bg-muted/30 relative">
                      <button
                        onClick={() => removeFoodFromMeal(mealIndex, foodIndex)}
                        className="absolute right-2 top-2 text-destructive hover:text-destructive/80 cursor-pointer"
                      >
                        <Trash size={14} />
                      </button>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="relative col-span-2">
                          <label className="text-xs text-foreground">Food</label>
                          <Input
                            value={getFoodName(food.food_id) || food.food_name || ""}
                            onChange={(e) => {
                              const value = e.target.value
                              setSearchValue(prev => ({
                                ...prev,
                                [mealIndex]: { ...(prev[mealIndex] || {}), [foodIndex]: value }
                              }))
                              setOpenCombobox(prev => ({
                                ...prev,
                                [mealIndex]: { ...(prev[mealIndex] || {}), [foodIndex]: value.length > 0 }
                              }))
                            }}
                            onFocus={() => {
                              setOpenCombobox(prev => ({
                                ...prev,
                                [mealIndex]: { ...(prev[mealIndex] || {}), [foodIndex]: true }
                              }))
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setOpenCombobox(prev => ({
                                  ...prev,
                                  [mealIndex]: { ...(prev[mealIndex] || {}), [foodIndex]: false }
                                }))
                              }, 200)
                            }}
                            placeholder="Search foods..."
                            className="bg-input text-foreground border-border placeholder-muted-foreground text-sm"
                          />
                          {openCombobox[mealIndex]?.[foodIndex] && (
                            <div
                              className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              <Command>
                                <CommandInput
                                  placeholder="Search foods..."
                                  value={searchValue[mealIndex]?.[foodIndex] || ""}
                                  onValueChange={(value) => {
                                    setSearchValue(prev => ({
                                      ...prev,
                                      [mealIndex]: { ...(prev[mealIndex] || {}), [foodIndex]: value }
                                    }))
                                  }}
                                />
                                <CommandList>
                                  <CommandEmpty>No foods found.</CommandEmpty>
                                  <CommandGroup>
                                    {foodLibrary
                                      .filter(f =>
                                        f.description.toLowerCase().includes((searchValue[mealIndex]?.[foodIndex] || "").toLowerCase())
                                      )
                                      .slice(0, 50)
                                      .map((f) => (
                                        <CommandItem
                                          key={f.id}
                                          value={f.description}
                                          onSelect={() => {
                                            updateFood(mealIndex, foodIndex, "food_id", f.id)
                                            updateFood(mealIndex, foodIndex, "food_name", f.description)
                                            setOpenCombobox(prev => ({
                                              ...prev,
                                              [mealIndex]: { ...(prev[mealIndex] || {}), [foodIndex]: false }
                                            }))
                                            setSearchValue(prev => ({
                                              ...prev,
                                              [mealIndex]: { ...(prev[mealIndex] || {}), [foodIndex]: f.description }
                                            }))
                                          }}
                                        >
                                          {f.description}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-foreground">Amount</label>
                          <Input
                            type="number"
                            value={food.amount || ""}
                            onChange={(e) => updateFood(mealIndex, foodIndex, "amount", e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="100"
                            className="bg-input text-foreground border-border placeholder-muted-foreground text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-foreground">Unit</label>
                          <select
                            value={food.unit || ""}
                            onChange={(e) => updateFood(mealIndex, foodIndex, "unit", e.target.value || null)}
                            className="w-full px-2 py-1.5 bg-input text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          >
                            <option value="">Select unit</option>
                            {foodUnits.map(unit => (
                              <option key={unit.id} value={unit.id}>
                                {unit.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {meal.foods.length === 0 && (
                    <p className="text-xs text-muted-foreground">No foods added. Click "Add Food" to add foods to this meal.</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-foreground">Notes</label>
                  <Textarea
                    value={meal.notes || ""}
                    onChange={(e) => updateMeal(mealIndex, "notes", e.target.value || null)}
                    placeholder="Optional notes..."
                    className="bg-input text-foreground border-border placeholder-muted-foreground"
                    rows={2}
                  />
                </div>
              </div>
            </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-border pt-4 mt-4">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {dayId ? "Update Day" : "Add Day"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
