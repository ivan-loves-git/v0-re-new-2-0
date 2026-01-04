"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Filter } from "lucide-react"
import { CardInfoButton } from "./card-info-button"

interface ConversionFunnelProps {
  leadCount: number
  qualifiedCount: number
  clientCount: number
  compact?: boolean
}

const kpiInfo = {
  conversionFunnel: {
    title: "Conversion Funnel",
    description: "Visual representation of your pipeline stages. Width shows relative size at each stage. Conversion rates at the bottom show percentage moving between stages.",
    why: "Identify pipeline bottlenecks. Low Lead to Qualified rate may indicate qualification criteria issues. Low Qualified to Client rate suggests offer or closing problems.",
  },
}

export function ConversionFunnel({ leadCount, qualifiedCount, clientCount, compact = false }: ConversionFunnelProps) {
  const total = leadCount + qualifiedCount + clientCount

  // Calculate conversion rates
  const qualifiedToClient = qualifiedCount > 0 ? Math.round((clientCount / (qualifiedCount + clientCount)) * 100) : 0

  const stages = [
    {
      name: "Leads",
      count: leadCount,
      color: "bg-blue-500",
      width: "100%"
    },
    {
      name: "Qualified",
      count: qualifiedCount,
      color: "bg-yellow-500",
      width: total > 0 ? `${Math.max(((qualifiedCount + clientCount) / total) * 100, 20)}%` : "66%"
    },
    {
      name: "Clients",
      count: clientCount,
      color: "bg-green-500",
      width: total > 0 ? `${Math.max((clientCount / total) * 100, 20)}%` : "33%"
    },
  ]

  return (
    <Card className="h-full gap-0">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-5 w-5 text-gray-900" />
          Conversion Funnel
          <CardInfoButton info={kpiInfo.conversionFunnel} />
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? "pt-0" : ""}>
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {stages.map((stage) => (
            <div key={stage.name} className="relative">
              <div
                className={`${stage.color} ${compact ? "h-9" : "h-12"} rounded-lg flex items-center justify-between px-4 transition-all`}
                style={{ width: stage.width }}
              >
                <span className="text-white font-medium text-sm">{stage.name}</span>
                <span className="text-white font-bold">{stage.count}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={`${compact ? "mt-2 pt-2" : "mt-4 pt-3"} border-t flex justify-between text-xs text-gray-500`}>
          <span>Lead to Qualified: <strong className="text-gray-700">{qualifiedCount + clientCount > 0 ? Math.round(((qualifiedCount + clientCount) / total) * 100) : 0}%</strong></span>
          <span>Qualified to Client: <strong className="text-gray-700">{qualifiedToClient}%</strong></span>
        </div>
      </CardContent>
    </Card>
  )
}
