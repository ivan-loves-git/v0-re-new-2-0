"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WaveBarChart } from "@/components/wave/charts"

interface ScoreDistributionProps {
  whoDistribution: { band: string; count: number }[]
  whenDistribution: { band: string; count: number }[]
}

export function ScoreDistribution({ whoDistribution, whenDistribution }: ScoreDistributionProps) {
  const whenByBand = new Map(whenDistribution.map((item) => [item.band, item.count]))
  const chartData = whoDistribution.map((who) => ({
    band: who.band,
    WHO: who.count,
    WHEN: whenByBand.get(who.band) ?? 0,
  }))

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>Score distribution</CardTitle>
        <CardDescription>WHO and WHEN profiles across the scoring bands.</CardDescription>
      </CardHeader>
      <CardContent className="py-4">
        <WaveBarChart
          data={chartData}
          label="WHO and WHEN score distribution"
          xKey="band"
          series={[
            { key: "WHO", label: "WHO", color: "var(--chart-1)" },
            { key: "WHEN", label: "WHEN", color: "var(--chart-2)" },
          ]}
          className="h-[260px]"
        />
      </CardContent>
    </Card>
  )
}
