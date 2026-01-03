"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { CardInfoButton } from "./card-info-button"

interface ActivityComparisonProps {
  thisWeekCount: number
  lastWeekCount: number
}

export function ActivityComparison({ thisWeekCount, lastWeekCount }: ActivityComparisonProps) {
  const difference = thisWeekCount - lastWeekCount
  const percentChange = lastWeekCount > 0
    ? Math.round((difference / lastWeekCount) * 100)
    : thisWeekCount > 0 ? 100 : 0

  const getTrendInfo = () => {
    if (difference > 0) {
      return {
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-50",
        text: `+${difference} from last week`,
        percentColor: "text-green-600"
      }
    } else if (difference < 0) {
      return {
        icon: TrendingDown,
        color: "text-red-600",
        bgColor: "bg-red-50",
        text: `${difference} from last week`,
        percentColor: "text-red-600"
      }
    } else {
      return {
        icon: Minus,
        color: "text-gray-500",
        bgColor: "bg-gray-50",
        text: "Same as last week",
        percentColor: "text-gray-500"
      }
    }
  }

  const trend = getTrendInfo()
  const TrendIcon = trend.icon

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5" />
          Weekly Activity
          <CardInfoButton info="Compares the number of logged activities (calls, meetings, emails, notes) this week versus last week." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold">{thisWeekCount}</p>
            <p className="text-sm text-gray-500">activities this week</p>
          </div>
          <div className={`p-3 rounded-full ${trend.bgColor}`}>
            <TrendIcon className={`h-6 w-6 ${trend.color}`} />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t flex items-center gap-2">
          <span className={`text-sm font-medium ${trend.percentColor}`}>
            {difference !== 0 && (percentChange > 0 ? "+" : "")}{percentChange}%
          </span>
          <span className="text-sm text-gray-500">{trend.text}</span>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Last week: {lastWeekCount} activities
        </div>
      </CardContent>
    </Card>
  )
}
