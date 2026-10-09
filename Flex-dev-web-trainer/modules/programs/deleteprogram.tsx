'use client'

import React, { useState } from 'react';
import { deleteProgram } from '@/supabase/deletions/deleteprogram';

type DeleteProgramDialogProps = {
  programId: string;
  programName: string;
  onDeleted?: () => void;
  children: React.ReactNode; // trigger element
};

export default function DeleteProgramDialog({
  programId,
  programName,
  onDeleted,
  children,
}: DeleteProgramDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await deleteProgram(programId);
      setIsDialogOpen(false);
      if (onDeleted) onDeleted();
    } catch (error) {
      console.error('Error deleting program:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div onClick={() => setIsDialogOpen(true)}>
        {children}
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-lg shadow-lg w-96 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">Delete Program</h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <span className="font-semibold">{programName}</span>? This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-destructive hover:bg-destructive/90 disabled:bg-destructive/50 text-destructive-foreground font-semibold rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
