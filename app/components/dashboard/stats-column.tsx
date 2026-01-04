"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, Briefcase, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { CardInfoButton } from "./card-info-button"

interface StatsColumnProps {
  totalRepreneurs: number
  leadCount: number
  qualifiedCount: number
  clientCount: number
  // Last week comparison
  lastWeekTotal?: number
  lastWeekLeads?: number
  lastWeekQualified?: number
  lastWeekClients?: number
}

function getChangeIndicator(current: number, lastWeek: number | undefined) {
  if (lastWeek === undefined) return null
  const diff = current - lastWeek

  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <TrendingUp className="h-3 w-3" />
        +{diff} vs LW
      </span>
    )
  } else if (diff < 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600">
        <TrendingDown className="h-3 w-3" />
        {diff} vs LW
      </span>
    )
  } else {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Minus className="h-3 w-3" />
        0 vs LW
      </span>
    )
  }
}

const kpiInfo = {
  pipelineStats: {
    title: "Pipeline Stats",
    description: "Overview of your repreneur pipeline showing total count and breakdown by lifecycle status (Lead, Qualified, Client).",
    why: "Track pipeline health at a glance. The 'vs LW' comparison shows week-over-week growth to identify trends early.",
  },
}

export function StatsColumn({
  totalRepreneurs,
  leadCount,
  qualifiedCount,
  clientCount,
  lastWeekTotal,
  lastWeekLeads,
  lastWeekQualified,
  lastWeekClients,
}: StatsColumnProps) {
  const stats = [
    {
      label: "Total Repreneurs",
      value: totalRepreneurs,
      lastWeek: lastWeekTotal,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Leads",
      value: leadCount,
      lastWeek: lastWeekLeads,
      icon: Users,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
    {
      label: "Qualified",
      value: qualifiedCount,
      lastWeek: lastWeekQualified,
      icon: UserCheck,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      label: "Clients",
      value: clientCount,
      lastWeek: lastWeekClients,
      icon: Briefcase,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ]

  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-gray-900" />
          Pipeline Stats
          <CardInfoButton info={kpiInfo.pipelineStats} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    {getChangeIndicator(stat.value, stat.lastWeek)}
                  </div>
                </div>
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
