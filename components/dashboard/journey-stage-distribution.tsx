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
  explorer: "var(--chart-1)",
  learner: "var(--chart-3)",
  ready: "var(--chart-2)",
  execution: "var(--chart-4)",
  post_acquisition: "var(--chart-5)",
  no_stage: "var(--muted-foreground)",
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
    <Card className="h-full gap-0 py-0">
      <CardHeader className="flex min-h-14 flex-row items-center border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <Map className="size-4 text-muted-foreground" />
          Journey Stages
          <CardInfoButton info={kpiInfo.journeyStages} />
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden py-3">
        <div className="flex items-center gap-4">
          <div className="size-28 shrink-0">
            <WaveDonutChart
              data={data}
              label="Journey stage distribution"
              nameKey="name"
              valueKey="value"
              colors={data.map((item) => item.color)}
              className="h-28"
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
                  <span className="truncate text-xs text-muted-foreground">{item.name}</span>
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
