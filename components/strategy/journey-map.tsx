"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { PHASES, type Phase } from "@/lib/data/strategy-data"
import { cn } from "@/lib/utils"
import { Compass } from "lucide-react"

interface JourneyMapProps {
  currentPhase: number
  personaName: string
}

function getPhaseStatus(phaseNum: number, currentPhase: number) {
  if (phaseNum < currentPhase) return "completed"
  if (phaseNum === currentPhase) return "current"
  return "upcoming"
}

const STATUS_STYLES = {
  completed: "border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50",
  current: "border-blue-300 bg-blue-50/50 hover:bg-blue-50 shadow-sm shadow-blue-100",
  upcoming: "border-gray-200 bg-white opacity-50 hover:opacity-70",
}

const STATUS_BADGE_STYLES = {
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  current: "bg-blue-100 text-blue-700 border-blue-200",
  upcoming: "bg-gray-100 text-gray-500 border-gray-200",
}

const STATUS_LABELS = {
  completed: "Completed",
  current: "Current Phase",
  upcoming: "Upcoming",
}

export function JourneyMap({ currentPhase, personaName }: JourneyMapProps) {
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null)

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Compass className="h-4 w-4 text-blue-600" />
            13-Phase Acquisition Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((phase) => {
              const status = getPhaseStatus(phase.num, currentPhase)
              return (
                <button
                  key={phase.num}
                  onClick={() => setSelectedPhase(phase)}
                  className={cn(
                    "w-[130px] p-2.5 rounded-lg border text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer",
                    STATUS_STYLES[status]
                  )}
                >
                  <div className={cn(
                    "text-[10px] font-bold mb-1",
                    status === "completed" ? "text-emerald-600" :
                    status === "current" ? "text-blue-600" :
                    "text-muted-foreground"
                  )}>
                    PHASE {phase.num}
                  </div>
                  <div className="text-xs font-semibold text-foreground leading-tight mb-1">
                    {phase.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground italic mb-1.5 leading-tight">
                    &quot;{phase.question}&quot;
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] py-0", STATUS_BADGE_STYLES[status])}
                  >
                    {phase.cert}
                  </Badge>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Phase Detail Dialog */}
      <Dialog open={!!selectedPhase} onOpenChange={(open) => !open && setSelectedPhase(null)}>
        {selectedPhase && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Phase {selectedPhase.num}: {selectedPhase.name}
              </DialogTitle>
              <DialogDescription className="text-emerald-600 italic">
                &quot;{selectedPhase.question}&quot;
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-0">
              <DetailRow
                label={`Status for ${personaName}`}
                value={
                  <Badge
                    variant="outline"
                    className={cn("text-xs", STATUS_BADGE_STYLES[getPhaseStatus(selectedPhase.num, currentPhase)])}
                  >
                    {STATUS_LABELS[getPhaseStatus(selectedPhase.num, currentPhase)]}
                  </Badge>
                }
              />
              <DetailRow label="Certification" value={selectedPhase.cert} />
              <DetailRow label="Tier Access" value={selectedPhase.tier} />
              <DetailRow label="Description" value={selectedPhase.desc} multiline />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: React.ReactNode
  multiline?: boolean
}) {
  return (
    <div className={cn(
      "flex justify-between py-2.5 border-b border-gray-100 last:border-b-0 text-sm",
      multiline && "flex-col gap-1"
    )}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "font-medium text-foreground",
        !multiline && "text-right max-w-[60%]",
        multiline && "text-sm font-normal"
      )}>
        {value}
      </span>
    </div>
  )
}
