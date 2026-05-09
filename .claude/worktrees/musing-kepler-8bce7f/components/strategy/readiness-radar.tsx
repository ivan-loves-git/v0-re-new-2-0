"use client"

import { lazy, Suspense, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar as RadarIcon } from "lucide-react"
import { DIMENSIONS } from "@/lib/data/strategy-data"

const LazyRadarChart = lazy(() =>
  import("recharts").then((mod) => ({
    default: function RadarChartInner({ scores }: { scores: number[] }) {
      const { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } = mod
      const data = DIMENSIONS.map((dim, i) => ({
        dimension: dim,
        shortLabel: dim.split(" ")[0],
        score: scores[i],
        fullMark: 9,
      }))

      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="shortLabel"
              tick={{ fill: "#6b7280", fontSize: 10 }}
            />
            <Radar
              dataKey="score"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                      <p className="font-medium text-gray-900 text-sm">{d.dimension}</p>
                      <p className="text-lg font-bold text-emerald-600">{Math.round(d.score)}/9</p>
                    </div>
                  )
                }
                return null
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      )
    },
  }))
)

interface ReadinessRadarProps {
  scores: number[]
  onScoreChange: (index: number, value: number) => void
}

export function ReadinessRadar({ scores, onScoreChange }: ReadinessRadarProps) {
  const roundedScores = useMemo(() => scores.map((s) => Math.round(s)), [scores])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <RadarIcon className="size-4 text-emerald-600" />
          Readiness Radar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Radar Chart */}
        <div className="aspect-square w-full">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                Loading chart...
              </div>
            }
          >
            <LazyRadarChart scores={scores} />
          </Suspense>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {DIMENSIONS.map((dim, i) => (
            <div key={dim}>
              <div className="flex justify-between items-baseline mb-0.5">
                <label className="text-[10px] text-muted-foreground leading-tight">
                  {dim.length > 16 ? dim.replace(" ", "\n") : dim}
                </label>
                <span className="text-[10px] font-semibold text-emerald-600">{roundedScores[i]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={9}
                step={1}
                value={roundedScores[i]}
                onChange={(e) => onScoreChange(i, parseInt(e.target.value))}
                className="w-full h-1 appearance-none bg-gray-200 rounded-full outline-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
