"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { WaveAreaChart } from "@/components/wave/charts"

interface ChartDataPoint {
  date: string
  count: number
  cumulative: number
}

interface RepreneursOverTimeChartProps {
  data: ChartDataPoint[]
  showCard?: boolean
}

export function RepreneursOverTimeChart({ data, showCard = true }: RepreneursOverTimeChartProps) {
  const chartContent = (
    <WaveAreaChart
      data={data}
      label="Repreneurs over time"
      xKey="date"
      series={[{ key: "cumulative", label: "Total repreneurs", color: "var(--chart-1)" }]}
      className="h-[300px]"
    />
  )

  if (!showCard) {
    return chartContent
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-5 text-foreground" />
          Repreneurs Over Time
          <CardInfoButton info="Cumulative count of repreneurs in the system over the last 30 days. Shows overall pipeline growth." />
        </CardTitle>
      </CardHeader>
      <CardContent>{chartContent}</CardContent>
    </Card>
  )
}
