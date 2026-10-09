'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { fetchNutritionPrograms, NutritionProgram } from '@/supabase/fetches/fetchnutritionprograms'
import { fetchFoods, Food } from '@/supabase/fetches/fetchfoods'
import { fetchUserFoods, UserFood } from '@/supabase/fetches/fetchuserfoods'
import { fetchCommunityFoods, CommunityFood } from '@/supabase/fetches/fetchcommunityfoods'
import { upsertUserFood } from '@/supabase/upserts/upsertuserfood'
import { upsertCommunityFood } from '@/supabase/upserts/upsertcommunityfood'
import { deleteUserFood } from '@/supabase/deletions/deleteuserfood'
import { deleteCommunityFood } from '@/supabase/deletions/deletecommunityfood'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, UtensilsCrossed, Filter, Edit, Trash2 } from 'lucide-react'
import { supabase } from '@/supabase/supabaseClient'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/authcontext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type FoodWithType = (Food | UserFood | CommunityFood) & {
  foodType?: 'base' | 'user' | 'community'
}

export default function NutritionLibraryPage() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<NutritionProgram[]>([])
  const [baseFoods, setBaseFoods] = useState<Food[]>([])
  const [userFoods, setUserFoods] = useState<UserFood[]>([])
  const [communityFoods, setCommunityFoods] = useState<CommunityFood[]>([])
  const [loading, setLoading] = useState(true)
  const [programSearchQuery, setProgramSearchQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [foodFilter, setFoodFilter] = useState<'all' | 'your' | 'base' | 'community'>('all')
  const [addProgramDialogOpen, setAddProgramDialogOpen] = useState(false)
  const [newProgramName, setNewProgramName] = useState('')
  const [addingProgram, setAddingProgram] = useState(false)
  const [addFoodDialogOpen, setAddFoodDialogOpen] = useState(false)
  const [editFoodDialogOpen, setEditFoodDialogOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<FoodWithType | null>(null)
  const [addingFood, setAddingFood] = useState(false)
  const [deletingFood, setDeletingFood] = useState(false)
  const [foodType, setFoodType] = useState<'personal' | 'community' | null>(null)
  const [newFood, setNewFood] = useState({
    description: '',
    brand_name: '',
    category: '',
    food_class: '',
  })

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [programsData, baseFoodsData, userFoodsData, communityFoodsData] = await Promise.all([
        fetchNutritionPrograms(user?.id),
        fetchFoods(),
        fetchUserFoods(user?.id),
        fetchCommunityFoods()
      ])
      setPrograms(programsData)
      setBaseFoods(baseFoodsData)
      setUserFoods(userFoodsData)
      setCommunityFoods(communityFoodsData)
    } catch (error) {
      console.error('Error loading nutrition data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFood = async () => {
    if (!newFood.description.trim()) {
      alert('Please enter a food description')
      return
    }

    if (!user?.id && foodType === 'personal') {
      alert('You must be logged in to create a personal food')
      return
    }

    if (!foodType) {
      alert('Please select whether this is a personal or community food')
      return
    }

    setAddingFood(true)
    try {
      if (foodType === 'personal') {
        const result = await upsertUserFood({
          description: newFood.description.trim(),
          brand_name: newFood.brand_name.trim() || null,
          category: newFood.category.trim() || null,
          food_class: newFood.food_class.trim() || null,
          user_id: user!.id,
        })
        if (!result) throw new Error('Failed to create user food')
      } else if (foodType === 'community') {
        const result = await upsertCommunityFood({
          description: newFood.description.trim(),
          brand_name: newFood.brand_name.trim() || null,
          category: newFood.category.trim() || null,
          food_class: newFood.food_class.trim() || null,
          created_by: user?.id || null,
        })
        if (!result) throw new Error('Failed to create community food')
      }

      // Reload foods
      await loadData()

      // Reset form and close dialog
      setNewFood({
        description: '',
        brand_name: '',
        category: '',
        food_class: '',
      })
      setFoodType(null)
      setAddFoodDialogOpen(false)
    } catch (error) {
      console.error('Error adding food:', error)
      alert('Error adding food. Please try again.')
    } finally {
      setAddingFood(false)
    }
  }

  const handleUpdateFood = async () => {
    if (!editingFood || !newFood.description.trim()) {
      alert('Please enter a food description')
      return
    }

    if (!user?.id && editingFood.foodType === 'user') {
      alert('You must be logged in to edit a personal food')
      return
    }

    setAddingFood(true)
    try {
      if (editingFood.foodType === 'user') {
        const result = await upsertUserFood({
          id: editingFood.id,
          description: newFood.description.trim(),
          brand_name: newFood.brand_name.trim() || null,
          category: newFood.category.trim() || null,
          food_class: newFood.food_class.trim() || null,
          user_id: user!.id,
        })
        if (!result) throw new Error('Failed to update user food')
      } else if (editingFood.foodType === 'community') {
        const result = await upsertCommunityFood({
          id: editingFood.id,
          description: newFood.description.trim(),
          brand_name: newFood.brand_name.trim() || null,
          category: newFood.category.trim() || null,
          food_class: newFood.food_class.trim() || null,
          created_by: (editingFood as CommunityFood).trainer_id || user?.id || null,
        })
        if (!result) throw new Error('Failed to update community food')
      }

      // Reload foods
      await loadData()

      // Reset form and close dialog
      setEditingFood(null)
      setNewFood({
        description: '',
        brand_name: '',
        category: '',
        food_class: '',
      })
      setFoodType(null)
      setEditFoodDialogOpen(false)
    } catch (error) {
      console.error('Error updating food:', error)
      alert('Error updating food. Please try again.')
    } finally {
      setAddingFood(false)
    }
  }

  const handleDeleteFood = async (food: FoodWithType) => {
    if (!confirm(`Are you sure you want to delete "${food.description}"? This action cannot be undone.`)) {
      return
    }

    setDeletingFood(true)
    try {
      let success = false
      if (food.foodType === 'user' && user?.id) {
        success = await deleteUserFood(food.id, user.id)
      } else if (food.foodType === 'community') {
        success = await deleteCommunityFood(food.id, user?.id || null)
      }

      if (!success) throw new Error('Failed to delete food')

      // Reload foods
      await loadData()
    } catch (error) {
      console.error('Error deleting food:', error)
      alert('Error deleting food. Please try again.')
    } finally {
      setDeletingFood(false)
    }
  }

  const handleAddProgram = async () => {
    if (!newProgramName.trim()) {
      alert('Please enter a program name')
      return
    }

    if (!user?.id) {
      alert('You must be logged in to create a program')
      return
    }

    setAddingProgram(true)
    try {
      const { data, error } = await supabase
        .from('nutrition_programs')
        .insert([{ 
          name: newProgramName.trim(),
          trainer_id: user.id,
          description: null
        }])
        .select()
        .single()

      if (error) {
        // If table doesn't exist, show helpful message
        if (error.code === 'PGRST116' || error.message.includes('does not exist') || error.message.includes('relation')) {
          alert('The nutrition_programs table does not exist yet. Please create it in your Supabase database.')
          return
        }
        throw error
      }

      setPrograms([data, ...programs])
      setNewProgramName('')
      setAddProgramDialogOpen(false)
    } catch (error) {
      console.error('Error adding nutrition program:', error)
      alert('Error adding nutrition program. Please try again.')
    } finally {
      setAddingProgram(false)
    }
  }

  // Filter programs based on search
  const filteredPrograms = useMemo(() => {
    if (!programSearchQuery.trim()) {
      return programs
    }
    const query = programSearchQuery.toLowerCase().trim()
    return programs.filter(program =>
      program.name.toLowerCase().includes(query)
    )
  }, [programs, programSearchQuery])

  // Combine and filter foods based on search and filter type
  const filteredFoods = useMemo(() => {
    // Combine all foods with their types
    const allFoods: FoodWithType[] = [
      ...baseFoods.map(f => ({ ...f, foodType: 'base' as const })),
      ...userFoods.map(f => ({ ...f, foodType: 'user' as const })),
      ...communityFoods.map(f => ({ ...f, foodType: 'community' as const }))
    ]

    let filtered = allFoods

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(food =>
        food.description.toLowerCase().includes(query) ||
        (food.brand_name && food.brand_name.toLowerCase().includes(query)) ||
        (food.category && food.category.toLowerCase().includes(query))
      )
    }

    // Apply type filter
    switch (foodFilter) {
      case 'your':
        return filtered.filter(f => f.foodType === 'user')
      case 'base':
        return filtered.filter(f => f.foodType === 'base')
      case 'community':
        return filtered.filter(f => f.foodType === 'community')
      case 'all':
      default:
        return filtered
    }
  }, [baseFoods, userFoods, communityFoods, searchQuery, foodFilter])

  if (loading) {
    return (
      <div className="p-8 bg-background text-foreground min-h-screen">
        <p className="text-muted-foreground">Loading nutrition library...</p>
      </div>
    )
  }

  return (
    <div className="p-8 bg-background text-foreground min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Nutrition Library</h1>
      </div>

      {/* Nutrition Programs Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Nutrition Programs</h2>
        </div>

        {/* Program Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search programs..."
              value={programSearchQuery}
              onChange={(e) => setProgramSearchQuery(e.target.value)}
              className="pl-10 bg-input text-foreground border-border placeholder-muted-foreground h-9"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Blank card to create new program */}
          <button
            onClick={() => setAddProgramDialogOpen(true)}
            className="aspect-video bg-card border-2 border-dashed border-border rounded-lg flex items-center justify-center hover:border-primary hover:bg-muted transition-colors cursor-pointer group"
          >
            <div className="flex flex-col items-center gap-2">
              <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground">Create Program</span>
            </div>
          </button>

          {/* Existing programs */}
          {filteredPrograms.map((program) => (
            <Link
              key={program.id}
              href={`/nutrition/${program.id}`}
              className="aspect-video bg-card border border-border rounded-lg p-4 flex flex-col justify-between hover:bg-muted transition-colors cursor-pointer"
            >
              <h3 className="text-foreground font-medium text-sm truncate">{program.name}</h3>
              <div className="text-xs text-muted-foreground mt-2">
                {program.created_at ? new Date(program.created_at).toLocaleDateString() : ''}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Foods Library Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Foods Library</h2>
        </div>

        {/* Foods Search, Filter, and Add Button */}
        <div className="mb-4 flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search foods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input text-foreground border-border placeholder-muted-foreground h-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 px-3 bg-input border-border text-foreground hover:bg-muted cursor-pointer"
              >
                <Filter className="h-4 w-4 mr-2" />
                {foodFilter === 'all' ? 'All Foods' : foodFilter === 'your' ? 'Your Foods' : foodFilter === 'base' ? 'Food Base' : 'Community'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
            <DropdownMenuItem
              onClick={() => setFoodFilter('all')}
              className={`cursor-pointer ${foodFilter === 'all' ? 'bg-muted' : ''}`}
            >
              All Foods
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFoodFilter('your')}
              className={`cursor-pointer ${foodFilter === 'your' ? 'bg-muted' : ''}`}
            >
              Your Foods
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFoodFilter('base')}
              className={`cursor-pointer ${foodFilter === 'base' ? 'bg-muted' : ''}`}
            >
              Food Base
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFoodFilter('community')}
              className={`cursor-pointer ${foodFilter === 'community' ? 'bg-muted' : ''}`}
            >
              Community
            </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => setAddFoodDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Food
          </Button>
        </div>

        {filteredFoods.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-lg">
            <p className="text-muted-foreground">
              {searchQuery ? 'No foods found matching your search.' : 'No foods in library.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{ gridTemplateRows: 'repeat(2, minmax(0, 1fr))', overflow: 'hidden' }}>
            {filteredFoods.slice(0, 8).map((food) => (
              <div
                key={food.id}
                className="p-4 bg-card border border-border rounded-lg hover:bg-muted transition-colors relative group"
              >
                {/* Edit/Delete buttons - only show for user and community foods */}
                {(food.foodType === 'user' || food.foodType === 'community') && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingFood(food)
                        setNewFood({
                          description: food.description,
                          brand_name: food.brand_name || '',
                          category: food.category || '',
                          food_class: food.food_class || '',
                        })
                        setFoodType(food.foodType === 'user' ? 'personal' : 'community')
                        setEditFoodDialogOpen(true)
                      }}
                      className="p-1 bg-muted hover:bg-muted/80 rounded text-foreground"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFood(food)
                      }}
                      className="p-1 bg-muted hover:bg-muted/80 rounded text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                
                {/* Food Image Placeholder */}
                <div className="mb-3 aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src="/meowl.jpg"
                    alt={food.description}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                
                {/* Food Name */}
                <h3 className="text-foreground font-medium text-sm truncate mb-1">{food.description}</h3>
                
                {/* Brand Name */}
                {food.brand_name && (
                  <p className="text-xs text-muted-foreground truncate mb-1">{food.brand_name}</p>
                )}
                
                {/* Category */}
                {food.category && (
                  <p className="text-xs text-muted-foreground">{food.category}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Food Dialog */}
      <Dialog open={addFoodDialogOpen} onOpenChange={setAddFoodDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Food</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new food to your library. Choose whether it's personal or community.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {!foodType && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setFoodType('personal')}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Personal Food
                </Button>
                <Button
                  onClick={() => setFoodType('community')}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Community Food
                </Button>
              </div>
            )}
            {foodType && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Description *</label>
                  <Input
                    type="text"
                    placeholder="Food name..."
                    value={newFood.description}
                    onChange={(e) => setNewFood({ ...newFood, description: e.target.value })}
                    className="bg-input text-foreground border-border placeholder-muted-foreground"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Brand Name</label>
                  <Input
                    type="text"
                    placeholder="Brand name..."
                    value={newFood.brand_name}
                    onChange={(e) => setNewFood({ ...newFood, brand_name: e.target.value })}
                    className="bg-input text-foreground border-border placeholder-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Category</label>
                  <Input
                    type="text"
                    placeholder="Category..."
                    value={newFood.category}
                    onChange={(e) => setNewFood({ ...newFood, category: e.target.value })}
                    className="bg-input text-foreground border-border placeholder-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Food Class</label>
                  <Input
                    type="text"
                    placeholder="Food class..."
                    value={newFood.food_class}
                    onChange={(e) => setNewFood({ ...newFood, food_class: e.target.value })}
                    className="bg-input text-foreground border-border placeholder-muted-foreground"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setAddFoodDialogOpen(false)
                setNewFood({ description: '', brand_name: '', category: '', food_class: '' })
                setFoodType(null)
              }}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            {foodType && (
              <Button
                onClick={handleAddFood}
                disabled={addingFood || !newFood.description.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {addingFood ? 'Adding...' : 'Add Food'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Food Dialog */}
      <Dialog open={editFoodDialogOpen} onOpenChange={setEditFoodDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Food</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the food information.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Description *</label>
              <Input
                type="text"
                placeholder="Food name..."
                value={newFood.description}
                onChange={(e) => setNewFood({ ...newFood, description: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Brand Name</label>
              <Input
                type="text"
                placeholder="Brand name..."
                value={newFood.brand_name}
                onChange={(e) => setNewFood({ ...newFood, brand_name: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Category</label>
              <Input
                type="text"
                placeholder="Category..."
                value={newFood.category}
                onChange={(e) => setNewFood({ ...newFood, category: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Food Class</label>
              <Input
                type="text"
                placeholder="Food class..."
                value={newFood.food_class}
                onChange={(e) => setNewFood({ ...newFood, food_class: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setEditFoodDialogOpen(false)
                setEditingFood(null)
                setNewFood({ description: '', brand_name: '', category: '', food_class: '' })
                setFoodType(null)
              }}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFood}
              disabled={addingFood || !newFood.description.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {addingFood ? 'Updating...' : 'Update Food'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Program Dialog */}
      <Dialog open={addProgramDialogOpen} onOpenChange={setAddProgramDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Nutrition Program</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter a name for your new nutrition program.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="Program name..."
              value={newProgramName}
              onChange={(e) => setNewProgramName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddProgram()
                }
              }}
              className="bg-input text-foreground border-border placeholder-muted-foreground"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setAddProgramDialogOpen(false)
                setNewProgramName('')
              }}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProgram}
              disabled={addingProgram || !newProgramName.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {addingProgram ? 'Creating...' : 'Create Program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
