"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDistance } from "date-fns"
import { useRouter } from "next/navigation"
import { Target } from "lucide-react"
import { JourneyStageBadge } from "@/components/journey/journey-stage-badge"
import { initialDateLabel, useHydratedNow } from "@/hooks/use-hydrated-now"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurCardProps {
  repreneur: Repreneur
  isDragging?: boolean
}

export function RepreneurCard({ repreneur, isDragging = false }: RepreneurCardProps) {
  const router = useRouter()
  const now = useHydratedNow()

  // Calculate combined score
  const whoScore = (repreneur as any).who_score ?? repreneur.tier1_score
  const whenScore = (repreneur as any).when_score
  const combined = (whoScore ?? 0) + (whenScore ?? 0)
  const hasScore = whoScore !== null || whenScore !== null

  return (
    <Card
      className={`p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow ${isDragging ? "opacity-50 rotate-2" : ""}`}
      onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
      onMouseEnter={() => router.prefetch(`/repreneurs/${repreneur.id}`)}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm">
            {repreneur.first_name} {repreneur.last_name}
          </h3>
          {hasScore && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs gap-1 cursor-help">
                    <Target className="size-3" />
                    {combined}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">WHO:</span>
                      <span className="font-medium">{whoScore ?? "—"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">WHEN:</span>
                      <span className="font-medium">{whenScore ?? "—"}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {repreneur.journey_stage && (
          <JourneyStageBadge stage={repreneur.journey_stage} showIcon={false} />
        )}
        <p className="text-xs text-muted-foreground">{repreneur.email}</p>
        <p className="text-xs text-muted-foreground">
          Added {now === null ? initialDateLabel(repreneur.created_at) : formatDistance(new Date(repreneur.created_at), new Date(now), { addSuffix: true })}
        </p>
      </div>
    </Card>
  )
}
