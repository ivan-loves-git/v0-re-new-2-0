"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar as RadarIcon } from "lucide-react"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurRadarChartProps {
  repreneur: Repreneur
}

// Skeleton loader matching the component layout
function RadarChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="h-5 w-5" />
          Profile Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-center text-blue-600 font-medium mb-1">T1: Skills</p>
            <div className="h-[180px] bg-gray-100 rounded animate-pulse flex items-center justify-center">
              <span className="text-gray-400 text-xs">Loading...</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-center text-amber-600 font-medium mb-1">T2: Competencies</p>
            <div className="h-[180px] bg-gray-100 rounded animate-pulse flex items-center justify-center">
              <span className="text-gray-400 text-xs">Loading...</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Dynamically import the chart component
const RepreneurRadarChartInner = dynamic(
  () => import("./repreneur-radar-chart-inner"),
  {
    ssr: false,
    loading: () => <RadarChartSkeleton />,
  }
)

export function RepreneurRadarChart(props: RepreneurRadarChartProps) {
  return <RepreneurRadarChartInner {...props} />
}
