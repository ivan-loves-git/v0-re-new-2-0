"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Map } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface JourneyStageDistributionProps {
  explorerCount: number
  learnerCount: number
  readyCount: number
  serialAcquirerCount: number
  noStageCount: number
}

const COLORS = {
  explorer: "#3b82f6",      // blue-500
  learner: "#f59e0b",       // amber-500
  ready: "#22c55e",         // green-500
  serial_acquirer: "#a855f7", // purple-500
  no_stage: "#9ca3af",      // gray-400
}

const kpiInfo = {
  journeyStages: {
    title: "Journey Stage Distribution",
    description: "Breakdown of repreneurs by their acquisition journey stage: Explorer (curious), Learner (building skills), Ready (prepared to buy), Serial Acquirer (experienced buyer).",
    why: "Tailor your approach based on journey stage. Explorers need education, Learners need guidance, Ready candidates need opportunities, Serial Acquirers need deal flow.",
  },
}

export function JourneyStageDistribution({
  explorerCount,
  learnerCount,
  readyCount,
  serialAcquirerCount,
  noStageCount,
}: JourneyStageDistributionProps) {
  const data = [
    { name: "Explorer", value: explorerCount, color: COLORS.explorer },
    { name: "Learner", value: learnerCount, color: COLORS.learner },
    { name: "Ready", value: readyCount, color: COLORS.ready },
    { name: "Serial Acquirer", value: serialAcquirerCount, color: COLORS.serial_acquirer },
    { name: "Not Set", value: noStageCount, color: COLORS.no_stage },
  ].filter(d => d.value > 0)

  const total = explorerCount + learnerCount + readyCount + serialAcquirerCount + noStageCount

  return (
    <Card className="h-full overflow-hidden gap-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Map className="h-5 w-5 text-gray-900" />
          Journey Stages
          <CardInfoButton info={kpiInfo.journeyStages} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1 min-w-0 overflow-hidden">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600 text-xs truncate">{item.name}</span>
                </div>
                <span className="font-medium text-xs shrink-0 ml-2">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
