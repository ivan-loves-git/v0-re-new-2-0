"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Map } from "lucide-react"

interface JourneyStageDistributionProps {
  explorerCount: number
  learnerCount: number
  readyCount: number
  serialAcquirerCount: number
  noStageCount: number
}

// Skeleton loader matching the component layout
function JourneyStageSkeleton() {
  return (
    <Card className="h-full overflow-hidden gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Map className="h-5 w-5 text-gray-900" />
          Journey Stages
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Dynamically import the chart component
const JourneyStageDistributionInner = dynamic(
  () => import("./journey-stage-distribution-inner").then(mod => ({ default: mod.JourneyStageDistributionInner })),
  {
    ssr: false,
    loading: () => <JourneyStageSkeleton />,
  }
)

export function JourneyStageDistribution(props: JourneyStageDistributionProps) {
  return <JourneyStageDistributionInner {...props} />
}
