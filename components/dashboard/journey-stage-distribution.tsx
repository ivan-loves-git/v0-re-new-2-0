"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Map } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { WaveDonutChart } from "@/components/wave/charts"

interface JourneyStageDistributionProps {
  explorerCount: number
  learnerCount: number
  readyCount: number
  executionCount: number
  postAcquisitionCount: number
  noStageCount: number
}

const COLORS = {
  explorer: "#3b82f6",      // blue-500
  learner: "#f59e0b",       // amber-500
  ready: "#22c55e",         // green-500
  execution: "#a855f7",     // purple-500
  post_acquisition: "#f59e0b", // amber-500
  no_stage: "#9ca3af",      // gray-400
}

const kpiInfo = {
  journeyStages: {
    title: "Journey Stage Distribution",
    description: "Breakdown of repreneurs by their acquisition journey stage: Explorer (curious), Learner (building skills), Ready (prepared to buy), Execution (active deal), Post-acquisition (deal closed).",
    why: "Tailor your approach based on journey stage. Explorers need education, Learners need guidance, Ready candidates need opportunities, Execution needs deal support, Post-acquisition needs integration help.",
  },
}

export function JourneyStageDistribution({
  explorerCount,
  learnerCount,
  readyCount,
  executionCount,
  postAcquisitionCount,
  noStageCount,
}: JourneyStageDistributionProps) {
  const data = [
    { name: "Explorer", value: explorerCount, color: COLORS.explorer },
    { name: "Learner", value: learnerCount, color: COLORS.learner },
    { name: "Ready", value: readyCount, color: COLORS.ready },
    { name: "Execution", value: executionCount, color: COLORS.execution },
    { name: "Post-acquisition", value: postAcquisitionCount, color: COLORS.post_acquisition },
    { name: "Not Set", value: noStageCount, color: COLORS.no_stage },
  ].filter(d => d.value > 0)

  return (
    <Card className="h-full overflow-hidden gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Map className="size-5 text-gray-900" />
          Journey Stages
          <CardInfoButton info={kpiInfo.journeyStages} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="size-24 shrink-0">
            <WaveDonutChart
              data={data}
              label="Journey stage distribution"
              nameKey="name"
              valueKey="value"
              colors={data.map((item) => item.color)}
              className="h-24"
            />
          </div>
          <div className="flex-1 space-y-1 min-w-0 overflow-hidden">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600 text-xs truncate">{item.name}</span>
                </div>
                <span className="font-medium text-xs shrink-0 ml-2">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
