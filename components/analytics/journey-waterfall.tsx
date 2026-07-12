import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WaveBarChart } from "@/components/wave/charts"

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

export function JourneyWaterfall({ stageDistribution }: JourneyWaterfallProps) {
  const chartData = stageDistribution.map((stage) => ({
    stage: stageLabels[stage.stage] || stage.stage,
    count: stage.count,
  }))

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>Journey distribution</CardTitle>
        <CardDescription>Repreneurs by their current acquisition journey stage.</CardDescription>
      </CardHeader>
      <CardContent className="py-4">
        <WaveBarChart data={chartData} label="Journey stage counts" xKey="stage" series={[{ key: "count", label: "Repreneurs", color: "var(--chart-2)" }]} className="h-[240px]" />
      </CardContent>
    </Card>
  )
}
