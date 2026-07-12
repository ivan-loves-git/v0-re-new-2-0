"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radar as RadarIcon } from "lucide-react"
import { DIMENSIONS } from "@/lib/data/strategy-data"
import { WaveRadarChart } from "@/components/wave/charts"

interface ReadinessRadarProps {
  scores: number[]
  onScoreChange: (index: number, value: number) => void
}

export function ReadinessRadar({ scores, onScoreChange }: ReadinessRadarProps) {
  const roundedScores = useMemo(() => scores.map((s) => Math.round(s)), [scores])
  const radarData = useMemo(() => DIMENSIONS.map((dimension, index) => ({
    dimension,
    shortLabel: dimension.split(" ")[0],
    score: roundedScores[index],
  })), [roundedScores])

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
          <WaveRadarChart
            data={radarData}
            label="Acquisition readiness radar"
            categoryKey="shortLabel"
            series={[{ key: "score", label: "Readiness", color: "var(--chart-2)" }]}
            maxValue={9}
            className="h-full"
          />
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
