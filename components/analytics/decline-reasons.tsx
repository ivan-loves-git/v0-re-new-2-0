"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown } from "lucide-react"
import { DECLINE_REASON_OPTIONS } from "@/lib/types/repreneur"
import { WaveBarChart } from "@/components/wave/charts"

interface DeclineReasonsProps {
  breakdown: { category: string; count: number }[]
}

const LABEL_BY_VALUE: Record<string, string> = {
  ...Object.fromEntries(DECLINE_REASON_OPTIONS.map(o => [o.value, o.label])),
  unspecified: "Not specified",
}

export function DeclineReasons({ breakdown }: DeclineReasonsProps) {
  const total = breakdown.reduce((sum, b) => sum + b.count, 0)
  const chartData = breakdown.map(({ category, count }) => ({
    reason: LABEL_BY_VALUE[category] || category,
    count,
  }))

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingDown className="size-4 text-muted-foreground" />
          Decline Reasons
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {total} declined
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No declined offers yet</p>
          </div>
        ) : (
          <WaveBarChart data={chartData} label="Decline reasons" xKey="reason" series={[{ key: "count", label: "Declined", color: "var(--chart-3)" }]} className="h-[240px]" />
        )}
      </CardContent>
    </Card>
  )
}
