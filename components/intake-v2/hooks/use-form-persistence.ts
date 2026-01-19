"use client"

import { useEffect, useCallback } from "react"
import { FORM_STORAGE_KEY, STEP_STORAGE_KEY, type IntakeFormData } from "../form-config"

interface PersistenceState {
  formData: Partial<IntakeFormData>
  step: number
  repreneurId: string | null
  lastSaved: string
}

/**
 * Hook for persisting form data to localStorage
 * Saves form progress so users can resume later
 */
export function useFormPersistence() {
  // Load saved state from localStorage
  const loadSavedState = useCallback((): PersistenceState | null => {
    if (typeof window === "undefined") return null

    try {
      const saved = localStorage.getItem(FORM_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as PersistenceState
        // Check if data is older than 7 days
        const lastSaved = new Date(parsed.lastSaved)
        const now = new Date()
        const daysDiff = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60 * 24)

        if (daysDiff > 7) {
          // Data is too old, clear it
          clearSavedState()
          return null
        }

        return parsed
      }
    } catch (error) {
      console.error("Error loading saved form state:", error)
    }

    return null
  }, [])

  // Save state to localStorage
  const saveState = useCallback(
    (formData: Partial<IntakeFormData>, step: number, repreneurId: string | null) => {
      if (typeof window === "undefined") return

      try {
        const state: PersistenceState = {
          formData,
          step,
          repreneurId,
          lastSaved: new Date().toISOString(),
        }
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state))
      } catch (error) {
        console.error("Error saving form state:", error)
      }
    },
    []
  )

  // Clear saved state
  const clearSavedState = useCallback(() => {
    if (typeof window === "undefined") return

    try {
      localStorage.removeItem(FORM_STORAGE_KEY)
      localStorage.removeItem(STEP_STORAGE_KEY)
    } catch (error) {
      console.error("Error clearing saved form state:", error)
    }
  }, [])

  return {
    loadSavedState,
    saveState,
    clearSavedState,
  }
}
