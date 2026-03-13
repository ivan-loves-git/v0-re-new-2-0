import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface JourneyWaterfallProps {
  stageDistribution: { stage: string; count: number }[]
}

const stageLabels: Record<string, string> = {
  explorer: "Explorer",
  learner: "Learner",
  ready: "Ready",
  execution: "Execution",
  post_acquisition: "Post-Acquisition",
}

const stageColors: Record<string, { bar: string; bg: string; text: string }> = {
  explorer: { bar: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  learner: { bar: "bg-sky-500", bg: "bg-sky-50", text: "text-sky-700" },
  ready: { bar: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  execution: { bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
  post_acquisition: { bar: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
}

export function JourneyWaterfall({ stageDistribution }: JourneyWaterfallProps) {
  const maxCount = Math.max(...stageDistribution.map((s) => s.count), 1)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Journey Stages</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stageDistribution.map((stage) => {
            const colors = stageColors[stage.stage] || stageColors.explorer
            const width = Math.max((stage.count / maxCount) * 100, 8)

            return (
              <div key={stage.stage} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {stageLabels[stage.stage] || stage.stage}
                  </span>
                  <span className={cn("font-semibold tabular-nums", colors.text)}>
                    {stage.count}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", colors.bar)}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
