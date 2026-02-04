'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/supabase/supabaseClient'
import { fetchNutritionPrograms } from '@/supabase/fetches/fetchnutritionprograms'
import { fetchNutritionWeeks, DayMeal } from '@/supabase/fetches/fetchnutritionweeks'
import { fetchMealTemplates } from '@/supabase/fetches/fetchmealtemplates'
import { fetchFoods } from '@/supabase/fetches/fetchfoods'
import { fetchUserFoods } from '@/supabase/fetches/fetchuserfoods'
import { fetchCommunityFoods } from '@/supabase/fetches/fetchcommunityfoods'
import { fetchFoodUnits, FoodUnit } from '@/supabase/fetches/fetchfoodunits'
import { upsertAssignedMeal } from '@/supabase/upserts/upsertassignedmeal'
import { upsertMealsTemplatesFood } from '@/supabase/upserts/upsertmealstemplatesfood'
import { upsertMealsOccurancesFood } from '@/supabase/upserts/upsertmealsoccurancesfood'
import { fetchMealsTemplatesFoods } from '@/supabase/fetches/fetchmealstemplatesfoods'
import { fetchDayMealFoods } from '@/supabase/fetches/fetchdaymealfoods'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash } from 'lucide-react'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Food } from '@/supabase/fetches/fetchfoods'

type AssignMealDialogContentProps = {
  personId: string
  initialDate?: string
  onMealAssigned: () => void
  onCancel: () => void
}

type MealOption = 'program' | 'template' | 'create'

type LocalFood = {
  food_id: string | null // Food id from foods table (string)
  food_name: string | null
  amount: number | null
  unit: string | null // food_unit id
}

export default function AssignMealDialogContent({
  personId,
  initialDate,
  onMealAssigned,
  onCancel,
}: AssignMealDialogContentProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [mealOption, setMealOption] = useState<MealOption>('program')
  const [mealDate, setMealDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  )
  const [assigning, setAssigning] = useState(false)

  // Program option state
  const [programs, setPrograms] = useState<any[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [allMeals, setAllMeals] = useState<DayMeal[]>([])
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)
  const [loadingPrograms, setLoadingPrograms] = useState(false)
  const [loadingMeals, setLoadingMeals] = useState(false)

  // Template option state
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Create option state
  const [mealName, setMealName] = useState<string>('')
  const [foods, setFoods] = useState<LocalFood[]>([])
  const [foodLibrary, setFoodLibrary] = useState<Food[]>([])
  const [foodUnits, setFoodUnits] = useState<FoodUnit[]>([])
  const [openCombobox, setOpenCombobox] = useState<{ [key: number]: boolean }>({})
  const [searchValue, setSearchValue] = useState<{ [key: number]: string }>({})

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    getUser()
  }, [])

  // Fetch programs when program option is selected
  useEffect(() => {
    if (mealOption === 'program' && userId) {
      const loadPrograms = async () => {
        setLoadingPrograms(true)
        try {
          const fetchedPrograms = await fetchNutritionPrograms(userId)
          setPrograms(fetchedPrograms)
        } catch (error) {
          console.error('Error fetching nutrition programs:', error)
          setPrograms([])
        } finally {
          setLoadingPrograms(false)
        }
      }
      loadPrograms()
    }
  }, [mealOption, userId])

  // Fetch weeks and meals when a program is selected
  useEffect(() => {
    if (selectedProgramId && userId) {
      const loadMeals = async () => {
        setLoadingMeals(true)
        try {
          const fetchedWeeks = await fetchNutritionWeeks(selectedProgramId)
          const meals: DayMeal[] = []
          fetchedWeeks.forEach(week => {
            week.days.forEach(day => {
              meals.push(...day.meals)
            })
          })
          setAllMeals(meals)
        } catch (error) {
          console.error('Error fetching meals:', error)
          setAllMeals([])
        } finally {
          setLoadingMeals(false)
        }
      }
      loadMeals()
    } else {
      setAllMeals([])
      setSelectedMealId(null)
    }
  }, [selectedProgramId, userId])

  // Fetch templates when template option is selected
  useEffect(() => {
    if (mealOption === 'template' && userId) {
      const loadTemplates = async () => {
        setLoadingTemplates(true)
        try {
          const fetchedTemplates = await fetchMealTemplates(userId)
          setTemplates(fetchedTemplates)
        } catch (error) {
          console.error('Error fetching meal templates:', error)
          setTemplates([])
        } finally {
          setLoadingTemplates(false)
        }
      }
      loadTemplates()
    }
  }, [mealOption, userId])

  // Fetch food library and units when create option is selected
  useEffect(() => {
    if (mealOption === 'create' && userId) {
      const loadFoods = async () => {
        try {
          const [baseFoods, userFoods, communityFoods, units] = await Promise.all([
            fetchFoods(),
            fetchUserFoods(userId),
            fetchCommunityFoods(),
            fetchFoodUnits(),
          ])
          setFoodLibrary([...baseFoods, ...userFoods, ...communityFoods])
          setFoodUnits(units)
        } catch (error) {
          console.error('Error loading food library:', error)
        }
      }
      loadFoods()
    }
  }, [mealOption, userId])

  // Update meal date when initialDate changes
  useEffect(() => {
    if (initialDate) {
      setMealDate(initialDate)
    }
  }, [initialDate])

  const addFood = () => {
    setFoods(prev => [
      ...prev,
      {
        food_id: null,
        food_name: null,
        amount: null,
        unit: null,
      },
    ])
  }

  const removeFood = (index: number) => {
    setFoods(prev => prev.filter((_, i) => i !== index))
    setOpenCombobox(prev => {
      const newState = { ...prev }
      delete newState[index]
      return newState
    })
    setSearchValue(prev => {
      const newState = { ...prev }
      delete newState[index]
      return newState
    })
  }

  const getFoodName = (foodId: string | null): string => {
    if (!foodId) return ''
    const food = foodLibrary.find(f => f.id === foodId)
    return food?.description || ''
  }

  const handleAssign = async () => {
    if (!mealDate) {
      alert('Please select a date')
      return
    }

    try {
      setAssigning(true)
      let mealId: string

      if (mealOption === 'program' || mealOption === 'template') {
        // Use existing meal
        mealId = mealOption === 'program' ? selectedMealId! : selectedTemplateId!
        if (!mealId) {
          alert('Please select a meal')
          return
        }
      } else {
        // Create new meal on the spot - create directly as occurrence
        if (!mealName.trim()) {
          alert('Please enter a meal name')
          return
        }
        if (foods.length === 0) {
          alert('Please add at least one food')
          return
        }
        if (foods.some(f => !f.food_id || !f.amount || !f.unit)) {
          alert('Please complete all food entries (food, amount, and unit)')
          return
        }

        // Create meals_occurances entry directly (with a placeholder meal_id - we'll use the occurrence id itself)
        // For "create on spot", we don't reference a template or program meal
        const assignedMeal = await upsertAssignedMeal({
          person_id: personId,
          meal_id: '', // Will be set to occurrence id for on-the-spot meals
          assigned_date: mealDate,
          status: 'pending',
        })

        if (!assignedMeal) {
          alert('Error creating meal. Please try again.')
          return
        }

        // For on-the-spot meals, use the occurrence id as the meal reference
        // Create foods directly in meals_occurances_foods
        for (const food of foods) {
          const selectedFood = foodLibrary.find(f => f.id === food.food_id!)
          await upsertMealsOccurancesFood({
            meal_id: assignedMeal.id, // meals_occurances.id
            food_id: selectedFood?.fdc_id || null,
            food_name: selectedFood?.description || food.food_name || null,
            amount: food.amount!,
            unit: food.unit!,
          })
        }

        onMealAssigned()
        return
      }

      // For program or template meals, assign and copy foods
      const assignedMeal = await upsertAssignedMeal({
        person_id: personId,
        meal_id: mealId,
        assigned_date: mealDate,
        status: 'pending',
      })

      // Copy foods to meals_occurances_foods for this occurrence
      if (assignedMeal) {
        let sourceFoods: Array<{ food_id: number | null; food_name: string | null; amount: number | null; unit: string | null }> = []
        
        if (mealOption === 'program') {
          // Get foods from day_meals (meal_foods_programmed)
          const dayMealFoods = await fetchDayMealFoods([mealId])
          sourceFoods = dayMealFoods.map(f => ({
            food_id: f.food_id,
            food_name: f.food_name,
            amount: f.amount,
            unit: f.unit,
          }))
        } else if (mealOption === 'template') {
          // Get foods from meals_templates (meals_templates_foods)
          const templateFoods = await fetchMealsTemplatesFoods([mealId])
          sourceFoods = templateFoods.map(f => ({
            food_id: f.food_id,
            food_name: f.food_name,
            amount: f.amount,
            unit: f.unit,
          }))
        }

        // Copy foods to meals_occurances_foods
        for (const food of sourceFoods) {
          await upsertMealsOccurancesFood({
            meal_id: assignedMeal.id, // meals_occurances.id
            food_id: food.food_id,
            food_name: food.food_name,
            amount: food.amount,
            unit: food.unit,
          })
        }
      }

      onMealAssigned()
    } catch (err) {
      console.error('Error assigning meal:', err)
      alert('Error assigning meal. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  const canAssign = () => {
    if (!mealDate) return false
    if (mealOption === 'program' && !selectedMealId) return false
    if (mealOption === 'template' && !selectedTemplateId) return false
    if (mealOption === 'create') {
      if (!mealName.trim()) return false
      if (foods.length === 0) return false
      if (foods.some(f => !f.food_id || !f.amount || !f.unit)) return false
    }
    return true
  }

  return (
    <div className="space-y-4">
      {/* Date Selection */}
      <div>
        <label className="block text-sm font-medium mb-1 text-muted-foreground">
          Assignment Date *
        </label>
        <Input
          type="date"
          value={mealDate}
          onChange={(e) => setMealDate(e.target.value)}
          className="bg-background text-foreground border-border cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:invert"
          required
        />
      </div>

      {/* Option Selection */}
      <div>
        <label className="block text-sm font-medium mb-2 text-muted-foreground">
          Meal Source
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setMealOption('program')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mealOption === 'program'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            From Program
          </button>
          <button
            onClick={() => setMealOption('template')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mealOption === 'template'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            From Template
          </button>
          <button
            onClick={() => setMealOption('create')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mealOption === 'create'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            Create New
          </button>
        </div>
      </div>

      {/* Program Option */}
      {mealOption === 'program' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Nutrition Program
            </label>
            {loadingPrograms ? (
              <p className="text-sm text-muted-foreground">Loading programs...</p>
            ) : (
              <select
                value={selectedProgramId || ''}
                onChange={(e) => setSelectedProgramId(e.target.value || null)}
                className="w-full p-2 bg-background text-foreground border border-border rounded-md cursor-pointer"
              >
                <option value="">Select a program...</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedProgramId && (
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Meal
              </label>
              {loadingMeals ? (
                <p className="text-sm text-muted-foreground">Loading meals...</p>
              ) : allMeals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No meals found in this program.</p>
              ) : (
                <select
                  value={selectedMealId || ''}
                  onChange={(e) => setSelectedMealId(e.target.value || null)}
                  className="w-full p-2 bg-background text-foreground border border-border rounded-md cursor-pointer"
                >
                  <option value="">Select a meal...</option>
                  {allMeals.map((meal) => (
                    <option key={meal.id} value={meal.id}>
                      {meal.name || `Meal ${meal.meal_number || ''}`} {meal.meal_time && `(${new Date(meal.meal_time).toLocaleTimeString()})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {selectedMealId && allMeals.find(m => m.id === selectedMealId) && (
            <div className="p-3 bg-muted rounded-md">
              <h4 className="text-sm font-medium text-foreground mb-2">Meal Details:</h4>
              {(() => {
                const meal = allMeals.find(m => m.id === selectedMealId)!
                return (
                  <div className="space-y-1 text-sm">
                    <p className="text-foreground">
                      <span className="font-semibold">Name:</span> {meal.name || 'Unnamed Meal'}
                    </p>
                    {meal.foods && meal.foods.length > 0 && (
                      <div>
                        <span className="font-semibold text-foreground">Foods:</span>
                        <ul className="list-disc list-inside ml-2 text-muted-foreground">
                          {meal.foods.map((food, idx) => (
                            <li key={food.id || idx}>
                              {food.food_name || 'Unknown'} {food.amount && food.unit && `(${food.amount} ${food.unit})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

      {/* Template Option */}
      {mealOption === 'template' && (
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Meal Template
          </label>
          {loadingTemplates ? (
            <p className="text-sm text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No meal templates found.</p>
          ) : (
            <>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                className="w-full p-2 bg-background text-foreground border border-border rounded-md cursor-pointer"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name || 'Unnamed Template'}
                  </option>
                ))}
              </select>
              {selectedTemplateId && templates.find(t => t.id === selectedTemplateId) && (
                <div className="p-3 bg-muted rounded-md mt-2">
                  <h4 className="text-sm font-medium text-foreground mb-2">Template Details:</h4>
                  {(() => {
                    const template = templates.find(t => t.id === selectedTemplateId)!
                    return (
                      <div className="space-y-1 text-sm">
                        {template.foods && template.foods.length > 0 && (
                          <div>
                            <span className="font-semibold text-foreground">Foods:</span>
                            <ul className="list-disc list-inside ml-2 text-muted-foreground">
                              {template.foods.map((food, idx) => (
                                <li key={food.id || idx}>
                                  {food.food_name || 'Unknown'} {food.amount && food.unit && `(${food.amount} ${food.unit})`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Option */}
      {mealOption === 'create' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Meal Name *
            </label>
            <Input
              type="text"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="e.g. Breakfast, Lunch, Dinner"
              className="bg-background text-foreground border-border"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-muted-foreground">Foods *</label>
              <Button
                type="button"
                onClick={addFood}
                variant="outline"
                size="sm"
                className="bg-muted text-foreground border-border hover:bg-muted/80"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Food
              </Button>
            </div>

            {foods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No foods added. Click "Add Food" to get started.</p>
            ) : (
              <div className="space-y-3">
                {foods.map((food, index) => (
                  <div key={index} className="border border-border p-3 rounded-lg relative bg-background">
                    <button
                      onClick={() => removeFood(index)}
                      className="absolute right-2 top-2 text-destructive hover:text-destructive/80 cursor-pointer"
                    >
                      <Trash size={16} />
                    </button>

                    <div className="space-y-2">
                      <div className="relative">
                        <label className="text-xs text-muted-foreground">Food</label>
                        <Input
                          value={getFoodName(food.food_id)}
                          onChange={(e) => {
                            const value = e.target.value
                            setSearchValue(prev => ({ ...prev, [index]: value }))
                            setOpenCombobox(prev => ({ ...prev, [index]: value.length > 0 }))
                          }}
                          onFocus={() => {
                            setOpenCombobox(prev => ({ ...prev, [index]: true }))
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setOpenCombobox(prev => ({ ...prev, [index]: false }))
                            }, 200)
                          }}
                          placeholder="Search foods..."
                          className="bg-background text-foreground border-border placeholder-muted-foreground"
                        />
                        {openCombobox[index] && (
                          <div
                            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <Command>
                              <CommandInput
                                placeholder="Search foods..."
                                value={searchValue[index] || ''}
                                onValueChange={(value) => {
                                  setSearchValue(prev => ({ ...prev, [index]: value }))
                                }}
                                className="text-foreground bg-background"
                              />
                              <CommandList>
                                <CommandEmpty>No foods found.</CommandEmpty>
                                <CommandGroup>
                                  {foodLibrary
                                    .filter(f => {
                                      const search = (searchValue[index] || '').toLowerCase()
                                      return search === '' || f.description.toLowerCase().includes(search)
                                    })
                                    .map((f) => (
                                      <CommandItem
                                        key={f.id}
                                        value={f.description}
                                        onSelect={() => {
                                          setFoods(prev => prev.map((food, i) => 
                                            i === index 
                                              ? { ...food, food_id: f.id, food_name: f.description }
                                              : food
                                          ))
                                          setOpenCombobox(prev => ({ ...prev, [index]: false }))
                                          setSearchValue(prev => ({ ...prev, [index]: f.description }))
                                        }}
                                        className="text-foreground hover:bg-muted cursor-pointer bg-background"
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

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Amount</label>
                          <Input
                            type="number"
                            value={food.amount || ''}
                            onChange={(e) => {
                              const value = e.target.value
                              setFoods(prev => prev.map((f, i) => 
                                i === index 
                                  ? { ...f, amount: value ? parseFloat(value) : null }
                                  : f
                              ))
                            }}
                            placeholder="Amount"
                            className="bg-background text-foreground border-border placeholder-muted-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Unit</label>
                          <select
                            value={food.unit || ''}
                            onChange={(e) => {
                              setFoods(prev => prev.map((f, i) => 
                                i === index 
                                  ? { ...f, unit: e.target.value || null }
                                  : f
                              ))
                            }}
                            className="w-full p-2 bg-background text-foreground border border-border rounded-md cursor-pointer"
                          >
                            <option value="">Select unit...</option>
                            {foodUnits.map((unit) => (
                              <option key={unit.id} value={unit.id.toString()}>
                                {unit.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <DialogFooter className="flex gap-2">
        <Button
          onClick={onCancel}
          variant="outline"
          className="bg-muted hover:bg-muted/80 text-foreground border-border cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          onClick={handleAssign}
          disabled={!canAssign() || assigning}
          className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
        >
          {assigning ? 'Assigning...' : 'Assign Meal'}
        </Button>
      </DialogFooter>
    </div>
  )
}
