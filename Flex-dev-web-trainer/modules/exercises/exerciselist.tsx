'use client'

import { useEffect, useState, useMemo } from 'react'
import { fetchExercises, ExerciseLibraryItem } from '@/supabase/fetches/fetchexlib'
import { fetchUserExercises, UserExercise } from '@/supabase/fetches/fetchuserexercises'
import { fetchCommunityExercises, CommunityExercise } from '@/supabase/fetches/fetchcommunityexercises'
import { upsertUserExercise } from '@/supabase/upserts/upsertuserexercise'
import { upsertCommunityExercise } from '@/supabase/upserts/upsertcommunityexercise'
import { deleteUserExercise } from '@/supabase/deletions/deleteuserexercise'
import { deleteCommunityExercise } from '@/supabase/deletions/deletecommunityexercise'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Search, ChevronLeft, ChevronRight, Plus, BookOpen, User, Users, Filter, Edit, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/authcontext'
import ExerciseDetail from './exercisedetail'

const INITIAL_PAGE_SIZE = 10

const EXERCISES_PER_PAGE = 10

type FilterType = 'all' | 'your' | 'community'

type ExerciseWithType = ExerciseLibraryItem & {
  exerciseType?: 'base' | 'user' | 'community'
  user_id?: string
  created_by?: string | null
}

export default function ExerciseList() {
  const { user } = useAuth()
  const [allExercises, setAllExercises] = useState<ExerciseLibraryItem[]>([])
  const [userExercises, setUserExercises] = useState<UserExercise[]>([])
  const [communityExercises, setCommunityExercises] = useState<CommunityExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [defaultPage, setDefaultPage] = useState(0) // Start at 0, increment when clicking right
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addTypeDialogOpen, setAddTypeDialogOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exerciseType, setExerciseType] = useState<'community' | 'personal' | null>(null)
  const [editingExercise, setEditingExercise] = useState<ExerciseWithType | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<ExerciseLibraryItem | null>(null)
  const [exerciseDetailOpen, setExerciseDetailOpen] = useState(false)
  const [newExercise, setNewExercise] = useState({
    name: '',
    video_url: '',
    gif_url: '',
    img_url: '',
    variations: '',
  })

  // Load all exercises once on mount
  useEffect(() => {
    loadAllExercises()
  }, [user])

  const loadAllExercises = async () => {
    setLoading(true)
    try {
      const [baseExercises, userEx, communityEx] = await Promise.all([
        fetchExercises(),
        fetchUserExercises(user?.id),
        fetchCommunityExercises()
      ])
      setAllExercises(baseExercises)
      setUserExercises(userEx)
      setCommunityExercises(communityEx)
    } catch (error) {
      console.error('Error loading exercises:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter exercises based on search query (client-side)
  const filteredBaseExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return allExercises
    }
    const query = searchQuery.toLowerCase().trim()
    return allExercises.filter(exercise =>
      exercise.name.toLowerCase().includes(query)
    )
  }, [allExercises, searchQuery])

  const filteredUserExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return userExercises
    }
    const query = searchQuery.toLowerCase().trim()
    return userExercises.filter(exercise =>
      exercise.name.toLowerCase().includes(query)
    )
  }, [userExercises, searchQuery])

  const filteredCommunityExercises = useMemo(() => {
    if (!searchQuery.trim()) {
      return communityExercises
    }
    const query = searchQuery.toLowerCase().trim()
    return communityExercises.filter(exercise =>
      exercise.name.toLowerCase().includes(query)
    )
  }, [communityExercises, searchQuery])

  // Group exercises by category
  const defaultExercises = useMemo(() => {
    return filteredBaseExercises.map(ex => ({ ...ex, exerciseType: 'base' as const }))
  }, [filteredBaseExercises])

  const yourExercises = useMemo(() => {
    return filteredUserExercises.map(ex => ({ ...ex, exerciseType: 'user' as const, user_id: ex.trainer_id || undefined }))
  }, [filteredUserExercises])

  const communityExercisesList = useMemo(() => {
    return filteredCommunityExercises.map(ex => ({ ...ex, exerciseType: 'community' as const, created_by: ex.trainer_id || null }))
  }, [filteredCommunityExercises])

  // Filter exercises based on selected filter
  const getExercisesToShow = () => {
    switch (filter) {
      case 'your':
        return yourExercises
      case 'community':
        return communityExercises
      case 'all':
      default:
        return defaultExercises
    }
  }

  const exercisesToShow = getExercisesToShow()

  // Paginate exercises (show 10 at a time)
  const exercisesPaginated = useMemo(() => {
    const start = defaultPage * EXERCISES_PER_PAGE
    const end = start + EXERCISES_PER_PAGE
    return exercisesToShow.slice(start, end)
  }, [exercisesToShow, defaultPage])

  const hasMore = defaultPage * EXERCISES_PER_PAGE + EXERCISES_PER_PAGE < exercisesToShow.length
  const canGoBack = defaultPage > 0

  const handleNext = () => {
    if (hasMore) {
      setDefaultPage(defaultPage + 1)
    }
  }

  const handlePrev = () => {
    if (canGoBack) {
      setDefaultPage(defaultPage - 1)
    }
  }

  // Reset pagination when search or filter changes
  useEffect(() => {
    setDefaultPage(0)
  }, [searchQuery, filter])

  const handleAddExercise = async () => {
    if (!newExercise.name.trim()) {
      alert('Please enter an exercise name')
      return
    }

    if (!user?.id && exerciseType === 'personal') {
      alert('You must be logged in to create a personal exercise')
      return
    }

    setAdding(true)
    try {
      // Parse variations (comma-separated string to array)
      const variations = newExercise.variations
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0)

      if (exerciseType === 'personal') {
        const result = await upsertUserExercise({
          name: newExercise.name.trim(),
          video_url: newExercise.video_url.trim() || null,
          gif_url: newExercise.gif_url.trim() || null,
          img_url: newExercise.img_url.trim() || null,
          variations: variations.length > 0 ? variations : null,
          user_id: user!.id,
        })
        if (!result) throw new Error('Failed to create user exercise')
      } else if (exerciseType === 'community') {
        const result = await upsertCommunityExercise({
          name: newExercise.name.trim(),
          video_url: newExercise.video_url.trim() || null,
          gif_url: newExercise.gif_url.trim() || null,
          img_url: newExercise.img_url.trim() || null,
          variations: variations.length > 0 ? variations : null,
          created_by: user?.id || null,
        })
        if (!result) throw new Error('Failed to create community exercise')
      }

      // Reload exercises
      await loadAllExercises()

      // Reset form and close dialog
      setNewExercise({
        name: '',
        video_url: '',
        gif_url: '',
        img_url: '',
        variations: '',
      })
      setExerciseType(null)
      setAddDialogOpen(false)
    } catch (error) {
      console.error('Error adding exercise:', error)
      alert('Error adding exercise. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const handleEditExercise = (exercise: ExerciseWithType) => {
    setEditingExercise(exercise)
    setNewExercise({
      name: exercise.name,
      video_url: exercise.video_url || '',
      gif_url: exercise.gif_url || '',
      img_url: exercise.img_url || '',
      variations: exercise.variations?.join(', ') || '',
    })
    setExerciseType(exercise.exerciseType === 'user' ? 'personal' : 'community')
    setEditDialogOpen(true)
  }

  const handleUpdateExercise = async () => {
    if (!editingExercise || !newExercise.name.trim()) {
      alert('Please enter an exercise name')
      return
    }

    if (!user?.id && editingExercise.exerciseType === 'user') {
      alert('You must be logged in to edit a personal exercise')
      return
    }

    setEditing(true)
    try {
      // Parse variations (comma-separated string to array)
      const variations = newExercise.variations
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0)

      if (editingExercise.exerciseType === 'user') {
        const result = await upsertUserExercise({
          id: editingExercise.id,
          name: newExercise.name.trim(),
          video_url: newExercise.video_url.trim() || null,
          gif_url: newExercise.gif_url.trim() || null,
          img_url: newExercise.img_url.trim() || null,
          variations: variations.length > 0 ? variations : null,
          user_id: user!.id,
        })
        if (!result) throw new Error('Failed to update user exercise')
      } else if (editingExercise.exerciseType === 'community') {
        const result = await upsertCommunityExercise({
          id: editingExercise.id,
          name: newExercise.name.trim(),
          video_url: newExercise.video_url.trim() || null,
          gif_url: newExercise.gif_url.trim() || null,
          img_url: newExercise.img_url.trim() || null,
          variations: variations.length > 0 ? variations : null,
          created_by: editingExercise.created_by || user?.id || null,
        })
        if (!result) throw new Error('Failed to update community exercise')
      }

      // Reload exercises
      await loadAllExercises()

      // Reset form and close dialog
      setEditingExercise(null)
      setNewExercise({
        name: '',
        video_url: '',
        gif_url: '',
        img_url: '',
        variations: '',
      })
      setExerciseType(null)
      setEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating exercise:', error)
      alert('Error updating exercise. Please try again.')
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteExercise = async (exercise: ExerciseWithType) => {
    if (!confirm(`Are you sure you want to delete "${exercise.name}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      let success = false
      if (exercise.exerciseType === 'user' && user?.id) {
        success = await deleteUserExercise(exercise.id, user.id)
      } else if (exercise.exerciseType === 'community') {
        success = await deleteCommunityExercise(exercise.id, user?.id || null)
      }

      if (!success) throw new Error('Failed to delete exercise')

      // Reload exercises
      await loadAllExercises()
    } catch (error) {
      console.error('Error deleting exercise:', error)
      alert('Error deleting exercise. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenAddTypeDialog = () => {
    setAddTypeDialogOpen(true)
  }

  const handleSelectExerciseType = (type: 'community' | 'personal') => {
    setExerciseType(type)
    setAddTypeDialogOpen(false)
    setAddDialogOpen(true)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
  }

  // Component to render a single exercise card
  const ExerciseCard = ({ exercise }: { exercise: ExerciseWithType }) => {
    const canEdit = exercise.exerciseType === 'user' || exercise.exerciseType === 'community'
    const isUserExercise = exercise.exerciseType === 'user' && exercise.user_id === user?.id

    return (
      <div className="relative group flex-shrink-0 w-48">
        <div 
          className="p-3 border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer"
          onClick={() => {
            setSelectedExercise(exercise)
            setExerciseDetailOpen(true)
          }}
        >
      {/* Exercise Image/Video/GIF */}
      <div className="mb-2 aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
        {exercise.gif_url ? (
          <img
            src={exercise.gif_url}
            alt={exercise.name}
            className="w-full h-full object-cover"
          />
        ) : exercise.video_url ? (
          <video
            src={exercise.video_url}
            className="w-full h-full object-cover"
            controls={false}
            muted
          />
        ) : exercise.img_url ? (
          <img
            src={exercise.img_url}
            alt={exercise.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src="/meowl.jpg"
            alt="Default placeholder"
            className="w-full h-full object-cover object-top"
          />
        )}
      </div>

      {/* Exercise Name */}
      <h3 className="text-foreground font-medium text-sm truncate">{exercise.name}</h3>

      {/* Variations */}
      {exercise.variations && exercise.variations.length > 0 && (
        <div className="mt-1">
          <div className="flex flex-wrap gap-1">
            {exercise.variations.slice(0, 2).map((variation, idx) => (
              <span
                key={idx}
                className="text-xs px-1.5 py-0.5 bg-muted text-foreground rounded"
              >
                {variation}
              </span>
            ))}
            {exercise.variations.length > 2 && (
              <span className="text-xs text-muted-foreground">+{exercise.variations.length - 2}</span>
            )}
          </div>
        </div>
      )}
        </div>
        {/* Edit/Delete buttons - only show for user/community exercises */}
        {canEdit && (exercise.exerciseType === 'community' || isUserExercise) && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleEditExercise(exercise)
              }}
              className="p-1.5 bg-card border border-border rounded hover:bg-muted text-foreground cursor-pointer"
              title="Edit exercise"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteExercise(exercise)
              }}
              className="p-1.5 bg-card border border-border rounded hover:bg-destructive/10 text-destructive cursor-pointer"
              title="Delete exercise"
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // Component to render a section with pagination
  const ExerciseSection = ({ 
    title, 
    exercises,
    paginatedExercises,
    onNext,
    onPrev,
    canGoNext,
    canGoPrev,
    showAddButton = false,
    onAddClick
  }: { 
    title: string
    exercises: ExerciseWithType[]
    paginatedExercises: ExerciseWithType[]
    onNext?: () => void
    onPrev?: () => void
    canGoNext?: boolean
    canGoPrev?: boolean
    showAddButton?: boolean
    onAddClick?: () => void
  }) => {
    // Get icon based on title
    const getSectionIcon = () => {
      if (title === 'Exercise Base') return <BookOpen className="h-5 w-5" />
      if (title === 'Your Exercises') return <User className="h-5 w-5" />
      if (title === 'Community Creations') return <Users className="h-5 w-5" />
      return null
    }

    if (exercises.length === 0 && !showAddButton) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {getSectionIcon()}
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <div className="text-sm text-muted-foreground">No exercises yet</div>
        </div>
      )
    }

    if (exercises.length === 0 && showAddButton) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getSectionIcon()}
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            </div>
          </div>
          {/* Blank card with plus icon */}
          <div className="flex gap-3">
            <button
              onClick={onAddClick}
              className="w-48 p-3 border-2 border-dashed border-border rounded-lg hover:bg-muted transition-colors flex flex-col items-center justify-center aspect-video text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Plus className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Add Exercise</span>
            </button>
          </div>
        </div>
      )
    }

    const showPagination = canGoNext !== undefined || canGoPrev !== undefined

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSectionIcon()}
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          {showAddButton && (
            <Button
              onClick={onAddClick}
              variant="outline"
              size="sm"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Left Arrow - only show if we've moved forward */}
          {showPagination && canGoPrev && (
            <button
              onClick={onPrev}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground cursor-pointer"
              aria-label="Previous exercises"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          
          {/* Exercises */}
          <div className="flex gap-3 flex-1 overflow-hidden">
            {paginatedExercises.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>

          {/* Right Arrow - show if there are more exercises */}
          {showPagination && canGoNext && (
            <button
              onClick={onNext}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground cursor-pointer"
              aria-label="Next exercises"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading && allExercises.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Loading exercises...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Search Bar and Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
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
              {filter === 'all' ? 'All Exercises' : filter === 'your' ? 'Your Exercises' : 'Community Creations'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
            <DropdownMenuItem
              onClick={() => setFilter('all')}
              className={`cursor-pointer ${filter === 'all' ? 'bg-muted' : ''}`}
            >
              All Exercises
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFilter('your')}
              className={`cursor-pointer ${filter === 'your' ? 'bg-muted' : ''}`}
            >
              Your Exercises
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFilter('community')}
              className={`cursor-pointer ${filter === 'community' ? 'bg-muted' : ''}`}
            >
              Community Creations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          onClick={handleOpenAddTypeDialog}
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-9"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Exercise
        </Button>
      </div>

      {/* Exercise Sections - Show based on filter */}
      <div className="space-y-8">
        {filter === 'all' && (
          <ExerciseSection 
            title="Exercise Base" 
            exercises={defaultExercises}
            paginatedExercises={exercisesPaginated}
            onNext={handleNext}
            onPrev={handlePrev}
            canGoNext={hasMore}
            canGoPrev={canGoBack}
          />
        )}
        {filter === 'your' && (
          <ExerciseSection 
            title="Your Exercises" 
            exercises={yourExercises}
            paginatedExercises={exercisesPaginated}
            onNext={handleNext}
            onPrev={handlePrev}
            canGoNext={hasMore}
            canGoPrev={canGoBack}
            showAddButton={true}
            onAddClick={() => {
              setExerciseType('personal')
              setAddDialogOpen(true)
            }}
          />
        )}
        {filter === 'community' && (
          <ExerciseSection 
            title="Community Creations" 
            exercises={communityExercisesList}
            paginatedExercises={exercisesPaginated}
            onNext={handleNext}
            onPrev={handlePrev}
            canGoNext={hasMore}
            canGoPrev={canGoBack}
            showAddButton={true}
            onAddClick={() => {
              setExerciseType('community')
              setAddDialogOpen(true)
            }}
          />
        )}
      </div>

      {/* Show message if no exercises */}
      {!loading && exercisesToShow.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery ? 'No exercises found matching your search.' : 'No exercises in this category.'}
          </p>
        </div>
      )}

      {/* Exercise Type Selection Dialog */}
      <Dialog open={addTypeDialogOpen} onOpenChange={setAddTypeDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Exercise</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose the type of exercise you want to create.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              onClick={() => handleSelectExerciseType('personal')}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Your Personal Exercise
            </Button>
            <Button
              onClick={() => handleSelectExerciseType('community')}
              className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border"
            >
              Community Creation
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setAddTypeDialogOpen(false)}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Exercise Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open)
        if (!open) {
          setEditingExercise(null)
          setExerciseType(null)
          setNewExercise({
            name: '',
            video_url: '',
            gif_url: '',
            img_url: '',
            variations: '',
          })
        }
      }}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Edit {editingExercise?.exerciseType === 'community' ? 'Community' : 'Personal'} Exercise
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the exercise details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Exercise Name *
              </label>
              <Input
                type="text"
                placeholder="e.g., Barbell Back Squat"
                value={newExercise.name}
                onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Video URL
              </label>
              <Input
                type="url"
                placeholder="https://..."
                value={newExercise.video_url}
                onChange={(e) => setNewExercise({ ...newExercise, video_url: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                GIF URL
              </label>
              <Input
                type="url"
                placeholder="https://..."
                value={newExercise.gif_url}
                onChange={(e) => setNewExercise({ ...newExercise, gif_url: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Image URL
              </label>
              <Input
                type="url"
                placeholder="https://..."
                value={newExercise.img_url}
                onChange={(e) => setNewExercise({ ...newExercise, img_url: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Variations (comma-separated)
              </label>
              <Input
                type="text"
                placeholder="e.g., Front Squat, Goblet Squat"
                value={newExercise.variations}
                onChange={(e) => setNewExercise({ ...newExercise, variations: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setEditDialogOpen(false)
                setEditingExercise(null)
                setNewExercise({
                  name: '',
                  video_url: '',
                  gif_url: '',
                  img_url: '',
                  variations: '',
                })
              }}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateExercise}
              disabled={editing || !newExercise.name.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {editing ? 'Updating...' : 'Update Exercise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Exercise Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open)
        if (!open) {
          setExerciseType(null)
          setNewExercise({
            name: '',
            video_url: '',
            gif_url: '',
            img_url: '',
            variations: '',
          })
        }
      }}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Add {exerciseType === 'community' ? 'Community' : 'Personal'} Exercise
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new {exerciseType === 'community' ? 'community' : 'personal'} exercise for your library.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Exercise Name *
              </label>
              <Input
                type="text"
                placeholder="e.g., Barbell Back Squat"
                value={newExercise.name}
                onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Video URL
              </label>
              <Input
                type="url"
                placeholder="https://..."
                value={newExercise.video_url}
                onChange={(e) => setNewExercise({ ...newExercise, video_url: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                GIF URL
              </label>
              <Input
                type="url"
                placeholder="https://..."
                value={newExercise.gif_url}
                onChange={(e) => setNewExercise({ ...newExercise, gif_url: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Image URL
              </label>
              <Input
                type="url"
                placeholder="https://..."
                value={newExercise.img_url}
                onChange={(e) => setNewExercise({ ...newExercise, img_url: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Variations (comma-separated)
              </label>
              <Input
                type="text"
                placeholder="e.g., Front Squat, Goblet Squat"
                value={newExercise.variations}
                onChange={(e) => setNewExercise({ ...newExercise, variations: e.target.value })}
                className="bg-input text-foreground border-border placeholder-muted-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setAddDialogOpen(false)
                setNewExercise({
                  name: '',
                  video_url: '',
                  gif_url: '',
                  img_url: '',
                  variations: '',
                })
              }}
              variant="outline"
              className="bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddExercise}
              disabled={adding || !newExercise.name.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {adding ? 'Adding...' : 'Add Exercise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exercise Detail Dialog */}
      <ExerciseDetail
        exercise={selectedExercise}
        open={exerciseDetailOpen}
        onOpenChange={setExerciseDetailOpen}
        onExerciseUpdated={loadAllExercises}
      />
    </div>
  )
}

