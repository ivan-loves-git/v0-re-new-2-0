"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WaveBarChart } from "@/components/wave/charts"

interface ScoreDistributionProps {
  whoDistribution: { band: string; count: number }[]
  whenDistribution: { band: string; count: number }[]
}

export function ScoreDistribution({ whoDistribution, whenDistribution }: ScoreDistributionProps) {
  const chartData = whoDistribution.map((who, i) => ({
    band: who.band,
    WHO: who.count,
    WHEN: whenDistribution[i]?.count ?? 0,
  }))

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Score Distribution</CardTitle>
      </CardHeader>
      <CardContent>
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
