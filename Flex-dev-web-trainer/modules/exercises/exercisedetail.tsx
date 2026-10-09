'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ExerciseLibraryItem } from '@/supabase/fetches/fetchexlib'
import { Plus, X } from 'lucide-react'
import { supabase } from '@/supabase/supabaseClient'

type ExerciseDetailProps = {
  exercise: ExerciseLibraryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onExerciseUpdated?: () => void
}

export default function ExerciseDetail({
  exercise,
  open,
  onOpenChange,
  onExerciseUpdated,
}: ExerciseDetailProps) {
  const [variations, setVariations] = useState<string[]>([])
  const [newVariation, setNewVariation] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (exercise) {
      setVariations(exercise.variations || [])
      setNewVariation('')
    }
  }, [exercise])

  const handleAddVariation = () => {
    if (newVariation.trim() && !variations.includes(newVariation.trim())) {
      setVariations([...variations, newVariation.trim()])
      setNewVariation('')
    }
  }

  const handleRemoveVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index))
  }

  const handleSaveVariations = async () => {
    if (!exercise) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('exercises')
        .update({ variations: variations.length > 0 ? variations : null })
        .eq('id', exercise.id)

      if (error) throw error

      if (onExerciseUpdated) {
        onExerciseUpdated()
      }
    } catch (error) {
      console.error('Error saving variations:', error)
      alert('Error saving variations. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!exercise) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-2xl">{exercise.name}</DialogTitle>
        </DialogHeader>

        {/* Exercise Media */}
        <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden mb-4">
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
              controls
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

        {/* Tabs */}
        <Tabs defaultValue="variations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="variations">Variations</TabsTrigger>
            <TabsTrigger value="activation">Activation Profile</TabsTrigger>
          </TabsList>

          {/* Variations Tab */}
          <TabsContent value="variations" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Add variation..."
                  value={newVariation}
                  onChange={(e) => setNewVariation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddVariation()
                    }
                  }}
                  className="bg-input text-foreground border-border placeholder-muted-foreground"
                />
                <Button
                  onClick={handleAddVariation}
                  disabled={!newVariation.trim() || variations.includes(newVariation.trim())}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Variation Toggles */}
              {variations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Variations:</p>
                  <div className="flex flex-wrap gap-2">
                    {variations.map((variation, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg"
                      >
                        <span className="text-sm text-foreground">{variation}</span>
                        <button
                          onClick={() => handleRemoveVariation(index)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`Remove ${variation}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {variations.length === 0 && (
                <p className="text-sm text-muted-foreground">No variations added yet.</p>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveVariations}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {saving ? 'Saving...' : 'Save Variations'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Activation Profile Tab */}
          <TabsContent value="activation" className="mt-4">
            <div className="p-8 text-center border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground">Activation Profile feature coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

