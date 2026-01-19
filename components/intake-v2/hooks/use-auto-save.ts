"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { IntakeFormData } from "../form-config"

interface UseAutoSaveOptions {
  onSave: (data: Partial<IntakeFormData>, step: number, repreneurId: string | null) => void
  debounceMs?: number
}

/**
 * Hook for debounced auto-saving of form data
 * Shows a "Saved" indicator after saving
 */
export function useAutoSave({ onSave, debounceMs = 2000 }: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced save function
  const debouncedSave = useCallback(
    (data: Partial<IntakeFormData>, step: number, repreneurId: string | null) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Set up new debounced save
      timeoutRef.current = setTimeout(() => {
        setSaveStatus("saving")
        onSave(data, step, repreneurId)

        // Show "saved" status
        setSaveStatus("saved")

        // Clear status timeout if exists
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current)
        }

        // Hide "saved" after 2 seconds
        statusTimeoutRef.current = setTimeout(() => {
          setSaveStatus("idle")
        }, 2000)
      }, debounceMs)
    },
    [onSave, debounceMs]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
    }
  }, [])

  return {
    saveStatus,
    debouncedSave,
  }
}
