import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash } from "lucide-react";
import { fetchExercises } from "@/supabase/fetches/fetchexlib";
import { fetchDayExercises, DayExerciseWithName } from "@/supabase/fetches/fetchdayexercises";
import { formatRangeDisplay, parseRangeInput } from "@/supabase/utils/rangeparse";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

type LocalDayExercise = {
  exercise_id?: string;
  day_id?: string;
  name: string;
  sets: string; // Range input like "2-3" or "3"
  reps: string; // Range input like "2-3" or "3"
  rir: string | null; // Range input like "2-3" or "3"
  rpe: string | null; // Range input like "2-3" or "3"
  weight: string | null; // numrange format for display (e.g., "100-120" or "100")
  notes: string;
};

type AddDayDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { dayName: string; exercises: LocalDayExercise[]; dayId?: string }) => void;
  weekId: string;
  onAdded: () => void | Promise<void>;
  // Edit mode props
  dayId?: string; // If provided, dialog is in edit mode
  initialDayName?: string;
};

export default function AddDayDialog({ open, onClose, onSubmit, dayId, initialDayName }: AddDayDialogProps) {
  const [dayName, setDayName] = useState("");
  const [exercises, setExercises] = useState<LocalDayExercise[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<{ id: string; name: string }[]>([]);
  const [openCombobox, setOpenCombobox] = useState<{ [key: number]: boolean }>({});
  const [searchValue, setSearchValue] = useState<{ [key: number]: string }>({});

  // Reset form state when dialog opens, or load existing data if editing
  useEffect(() => {
    if (open) {
      if (dayId && initialDayName) {
        // Edit mode: load existing data
        setDayName(initialDayName);
        
        // Fetch existing exercises for this day
        const loadExistingExercises = async () => {
          try {
            const existingExercises = await fetchDayExercises(dayId);
            const mappedExercises: LocalDayExercise[] = existingExercises.map(ex => ({
              name: ex.exercise_name,
              sets: formatRangeDisplay(ex.sets) || "",
              reps: formatRangeDisplay(ex.reps) || "",
              rir: formatRangeDisplay(ex.rir),
              rpe: formatRangeDisplay(ex.rpe),
              weight: ex.weight_used ? formatRangeDisplay(ex.weight_used) : null,
              notes: ex.notes || '',
            }));
            setExercises(mappedExercises);
          } catch (err) {
            console.error("Failed to load existing exercises:", err);
            setExercises([]);
          }
        };
        loadExistingExercises();
      } else {
        // Add mode: reset all form state
        setDayName("");
        setExercises([]);
      }
      setOpenCombobox({});
      setSearchValue({});
    }
  }, [open, dayId, initialDayName]);

  // Fetch exercise library when dialog opens
  useEffect(() => {
    const loadLibrary = async () => {
      if (!open) return;
      try {
        const data = await fetchExercises();
        setExerciseLibrary(data);
      } catch (err) {
        console.error("Failed to fetch exercises:", err);
      }
    };
    loadLibrary();
  }, [open]);

  const addExercise = () => {
    setExercises(prev => [
      ...prev,
      {
        name: "",
        sets: "",
        reps: "",
        rir: null,
        rpe: null,
        weight: null,
        notes: "",
      },
    ]);
  };

  const removeExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
  };

  const updateExercise = <K extends keyof LocalDayExercise>(
    index: number,
    key: K,
    value: LocalDayExercise[K]
  ) => {
    setExercises(prev => prev.map((ex, i) => (i === index ? { ...ex, [key]: value } : ex)));
  };

  const handleSubmit = () => {
    onSubmit({
      dayName,
      exercises,
      dayId: dayId, // Include dayId if in edit mode
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border text-card-foreground custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {dayId ? "Edit Training Day" : "Add Training Day"}
          </DialogTitle>
        </DialogHeader>

        {/* Day name */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-foreground">Day Name</label>
          <Input
            value={dayName}
            onChange={(e) => setDayName(e.target.value)}
            placeholder="e.g. Push Day, Legs, Upper, etc."
            className="bg-input text-foreground border-border placeholder-muted-foreground"
          />
        </div>

        {/* Exercises */}
        <div className="space-y-6">
          {exercises.map((ex, index) => (
            <div key={index} className="border border-border p-3 rounded-lg relative bg-background">
              {exercises.length > 0 && (
                <button
                  onClick={() => removeExercise(index)}
                  className="absolute right-2 top-2 text-red-500 hover:text-red-600 cursor-pointer"
                >
                  <Trash size={16} />
                </button>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <label className="text-sm text-foreground">Exercise Name</label>
                  <div className="relative">
                    <Input
                      value={ex.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateExercise(index, "name", value);
                        setSearchValue(prev => ({ ...prev, [index]: value }));
                        setOpenCombobox(prev => ({ ...prev, [index]: value.length > 0 }));
                      }}
                      onFocus={() => {
                        if (ex.name.length > 0 || exerciseLibrary.length > 0) {
                          setOpenCombobox(prev => ({ ...prev, [index]: true }));
                        }
                      }}
                      onBlur={() => {
                        // Delay to allow click on item
                        setTimeout(() => {
                          setOpenCombobox(prev => ({ ...prev, [index]: false }));
                        }, 200);
                      }}
                      placeholder="Type to search exercises..."
                      className="bg-input text-foreground border-border placeholder-muted-foreground"
                    />
                    {openCombobox[index] && (
                      <div 
                        className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg"
                        onMouseDown={(e) => {
                          // Prevent blur when clicking inside the dropdown (including scrollbar)
                          e.preventDefault();
                        }}
                      >
                        <Command className="bg-card text-foreground">
                          <CommandInput
                            value={searchValue[index] || ex.name}
                            onValueChange={(value) => {
                              setSearchValue(prev => ({ ...prev, [index]: value }));
                              updateExercise(index, "name", value);
                            }}
                            placeholder="Search exercises..."
                            className="bg-input text-foreground border-border placeholder-muted-foreground"
                          />
                          <CommandList className="max-h-[200px] overflow-y-auto bg-card custom-scrollbar">
                            <CommandEmpty className="text-muted-foreground py-4 text-center">
                              No exercises found.
                            </CommandEmpty>
                            <CommandGroup className="bg-card">
                              {exerciseLibrary
                                .filter((exercise) => {
                                  const search = (searchValue[index] || ex.name || "").toLowerCase();
                                  return exercise.name.toLowerCase().includes(search);
                                })
                                .map((exercise) => (
                                  <CommandItem
                                    key={exercise.id}
                                    value={exercise.name}
                                    onSelect={() => {
                                      updateExercise(index, "name", exercise.name);
                                      setSearchValue(prev => ({ ...prev, [index]: exercise.name }));
                                      setOpenCombobox(prev => ({ ...prev, [index]: false }));
                                    }}
                                    className="text-foreground hover:bg-muted cursor-pointer data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                                  >
                                    {exercise.name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-end">
                   <div className="flex-1">
                     <label className="text-xs text-muted-foreground mb-1 block">Sets</label>
                     <Input
                       type="text"
                       value={ex.sets || ""}
                       onChange={(e) => {
                         updateExercise(index, "sets", e.target.value);
                       }}
                       placeholder="e.g. 3 or 2-4"
                       className="bg-[#111111] text-white border-[#2a2a2a] placeholder-gray-400 h-9 text-sm"
                     />
                   </div>

                   <div className="flex-1">
                     <label className="text-xs text-gray-300 mb-1 block">Reps</label>
                     <Input
                       type="text"
                       value={ex.reps || ""}
                       onChange={(e) => {
                         updateExercise(index, "reps", e.target.value);
                       }}
                       placeholder="e.g. 8 or 6-10"
                       className="bg-[#111111] text-white border-[#2a2a2a] placeholder-gray-400 h-9 text-sm"
                     />
                   </div>

                  <div className="flex-1">
                    <label className="text-xs text-gray-300 mb-1 block">RIR</label>
                    <Input
                      type="text"
                      value={ex.rir ?? ""}
                      onChange={(e) =>
                        updateExercise(index, "rir", e.target.value === "" ? null : e.target.value)
                      }
                      placeholder="e.g. 2 or 1-3"
                      className="bg-[#111111] text-white border-[#2a2a2a] placeholder-gray-400 h-9 text-sm"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-xs text-gray-300 mb-1 block">RPE</label>
                    <Input
                      type="text"
                      value={ex.rpe ?? ""}
                      onChange={(e) =>
                        updateExercise(index, "rpe", e.target.value === "" ? null : e.target.value)
                      }
                      placeholder="e.g. 7 or 6-8"
                      className="bg-[#111111] text-white border-[#2a2a2a] placeholder-gray-400 h-9 text-sm"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-xs text-foreground mb-1 block">Weight (lbs)</label>
                    <Input
                      type="text"
                      value={ex.weight ?? ""}
                      onChange={(e) =>
                        updateExercise(index, "weight", e.target.value === "" ? null : e.target.value)
                      }
                      placeholder="e.g., 100 or 100-120"
                      className="bg-input text-foreground border-border placeholder-muted-foreground h-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-foreground">Notes</label>
                  <Textarea
                    value={ex.notes}
                    onChange={(e) => updateExercise(index, "notes", e.target.value)}
                    placeholder="Cues, tempo, reminders..."
                    className="bg-input text-foreground border-border placeholder-muted-foreground"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add exercise button */}
          <Button
            onClick={addExercise}
            variant="outline"
            className="w-full border-border bg-muted text-foreground hover:bg-muted/80 hover:text-foreground flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={18} /> Add Exercise
          </Button>
        </div>

        <DialogFooter>
          <Button 
            className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer" 
            onClick={handleSubmit} 
            variant="default"
          >
            Save Day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
