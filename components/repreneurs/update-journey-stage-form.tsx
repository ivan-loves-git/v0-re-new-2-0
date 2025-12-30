"use client"

import { updateRepreneurJourneyStage } from "@/lib/actions/repreneurs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  async function handleStageChange(newStage: string) {
    try {
      await updateRepreneurJourneyStage(repreneurId, newStage as JourneyStage)
    } catch (error) {
      console.error("Failed to update journey stage:", error)
    }
  }

  return (
    <Select value={currentStage || ""} onValueChange={handleStageChange}>
      <SelectTrigger className="w-44">
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
