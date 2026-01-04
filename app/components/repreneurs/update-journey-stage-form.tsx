"use client"

import { useState, useEffect } from "react"
import { updateRepreneurJourneyStage } from "@/lib/actions/repreneurs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import type { JourneyStage } from "@/lib/types/repreneur"

interface UpdateJourneyStageFormProps {
  repreneurId: string
  currentStage: JourneyStage | null
}

const stageOptions: { value: JourneyStage; label: string }[] = [
  { value: "explorer", label: "Explorer" },
  { value: "learner", label: "Learner" },
  { value: "ready", label: "Ready" },
  { value: "serial_acquirer", label: "Serial Acquirer" },
]

export function UpdateJourneyStageForm({ repreneurId, currentStage }: UpdateJourneyStageFormProps) {
  const [optimisticStage, setOptimisticStage] = useState<JourneyStage | null | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  // Reset optimistic value when prop changes (server confirmed)
  useEffect(() => {
    setOptimisticStage(undefined)
  }, [currentStage])

  async function handleStageChange(newStage: string) {
    // Optimistic update
    setOptimisticStage(newStage as JourneyStage)
    setIsSaving(true)

    try {
      await updateRepreneurJourneyStage(repreneurId, newStage as JourneyStage)
      toast.success("Journey stage updated")
    } catch (error) {
      console.error("Failed to update journey stage:", error)
      toast.error("Failed to update journey stage. Please try again.")
      // Revert on error
      setOptimisticStage(undefined)
    } finally {
      setIsSaving(false)
    }
  }

  const displayStage = optimisticStage !== undefined ? optimisticStage : currentStage

  return (
    <Select
      value={displayStage || ""}
      onValueChange={handleStageChange}
      disabled={isSaving}
    >
      <SelectTrigger className={`w-44 ${isSaving ? "opacity-70" : ""}`}>
        <SelectValue placeholder="Select stage" />
      </SelectTrigger>
      <SelectContent>
        {stageOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
