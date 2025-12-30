"use client"

import { updateRepreneurJourneyStage } from "@/lib/actions/repreneurs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { stageConfig } from "@/lib/journey-config"
import type { JourneyStage } from "@/lib/types/repreneur"

interface UpdateJourneyStageFormProps {
  repreneurId: string
  currentStage: JourneyStage | null
}

const stageOptions: JourneyStage[] = ["explorer", "learner", "ready", "serial_acquirer"]

// Colors for the select trigger based on stage
const stageTriggerColors: Record<JourneyStage, string> = {
  explorer: "border-blue-300 bg-blue-50 text-blue-800",
  learner: "border-amber-300 bg-amber-50 text-amber-800",
  ready: "border-green-300 bg-green-50 text-green-800",
  serial_acquirer: "border-purple-300 bg-purple-50 text-purple-800",
}

// Dot colors for the dropdown items
const stageDotColors: Record<JourneyStage, string> = {
  explorer: "bg-blue-500",
  learner: "bg-amber-500",
  ready: "bg-green-500",
  serial_acquirer: "bg-purple-500",
}

export function UpdateJourneyStageForm({ repreneurId, currentStage }: UpdateJourneyStageFormProps) {
  async function handleStageChange(newStage: string) {
    try {
      await updateRepreneurJourneyStage(repreneurId, newStage as JourneyStage)
    } catch (error) {
      console.error("Failed to update journey stage:", error)
    }
  }

  const triggerClassName = currentStage
    ? `w-44 ${stageTriggerColors[currentStage]}`
    : "w-44"

  return (
    <Select value={currentStage || ""} onValueChange={handleStageChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder="Select stage" />
      </SelectTrigger>
      <SelectContent>
        {stageOptions.map((stage) => (
          <SelectItem key={stage} value={stage}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${stageDotColors[stage]}`} />
              {stageConfig[stage].label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
