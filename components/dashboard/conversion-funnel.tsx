"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Filter } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { WaveBarChart } from "@/components/wave/charts"

interface ConversionFunnelProps {
  leadCount: number
  qualifiedCount: number
  clientCount: number
  compact?: boolean
}

const kpiInfo = {
  conversionFunnel: {
    title: "Conversion Funnel",
    description: "Comparison of pipeline stage counts. Conversion rates at the bottom show the percentage moving between stages.",
    why: "Identify pipeline bottlenecks. Low Lead to Qualified rate may indicate qualification criteria issues. Low Qualified to Client rate suggests offer or closing problems.",
  },
}

export function ConversionFunnel({ leadCount, qualifiedCount, clientCount, compact = false }: ConversionFunnelProps) {
  const total = leadCount + qualifiedCount + clientCount

  // Calculate conversion rates
  const qualifiedToClient = qualifiedCount > 0 ? Math.round((clientCount / (qualifiedCount + clientCount)) * 100) : 0

  const stages = [
    { name: "Leads", count: leadCount },
    { name: "Qualified", count: qualifiedCount },
    { name: "Clients", count: clientCount },
  ]

  return (
    <Card className="h-full gap-0">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-5 text-gray-900" />
          Conversion Funnel
          <CardInfoButton info={kpiInfo.conversionFunnel} />
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? "pt-0" : ""}>
        <WaveBarChart data={stages} label="Conversion funnel stage counts" xKey="name" series={[{ key: "count", label: "Repreneurs" }]} className={compact ? "h-[150px]" : "h-[220px]"} />
        <div className={`${compact ? "mt-2 pt-2" : "mt-4 pt-3"} border-t flex justify-between text-xs text-gray-500`}>
          <span>Lead to Qualified: <strong className="text-gray-700">{qualifiedCount + clientCount > 0 ? Math.round(((qualifiedCount + clientCount) / total) * 100) : 0}%</strong></span>
          <span>Qualified to Client: <strong className="text-gray-700">{qualifiedToClient}%</strong></span>
        </div>
      </CardContent>
    </Card>
  )
}
