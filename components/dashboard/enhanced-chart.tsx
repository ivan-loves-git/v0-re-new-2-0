"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

interface EnhancedChartProps {
  repreneursData: Array<{ created_at: string }>
  activitiesData: Array<{ created_at: string }>
}

// Skeleton loader matching the chart layout
function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-gray-900" />
            <span className="hidden sm:inline">Pipeline & Activity Trends</span>
            <span className="sm:hidden">Trends</span>
          </CardTitle>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full bg-gray-100 rounded animate-pulse flex items-center justify-center">
          <span className="text-gray-400 text-sm">Loading chart...</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Dynamically import the chart component (Recharts is ~350KB)
const EnhancedChartInner = dynamic(
  () => import("./enhanced-chart-inner").then(mod => ({ default: mod.EnhancedChartInner })),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
)

export function EnhancedChart(props: EnhancedChartProps) {
  return <EnhancedChartInner {...props} />
}
