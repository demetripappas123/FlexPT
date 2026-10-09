"use client";
import React, { useState, ReactNode } from "react";
import { upsertProgram, Program } from "@/supabase/upserts/upsertprogram";

type AddProgramDialogProps = {
  children?: ReactNode;
}

export default function AddProgramDialog({ children }: AddProgramDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [programName, setProgramName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const programData: Program = {
        name: programName,
      };

      const result = await upsertProgram(programData);
      console.log("Program upserted:", result);

      setProgramName("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error creating program:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {children ? (
        <div onClick={() => setIsDialogOpen(true)} className="cursor-pointer">
          {children}
        </div>
      ) : (
        <button
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Add Program
        </button>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-96 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">Create New Program</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-muted-foreground mb-1">Program Name</label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-semibold rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
