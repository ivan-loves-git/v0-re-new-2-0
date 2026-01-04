"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isToday } from "date-fns"

interface DayActivity {
  date: string // YYYY-MM-DD
  count: number
  newRepreneurs: number
  activities: number
}

interface ActivityHeatmapProps {
  activityData: DayActivity[]
}

export function ActivityHeatmap({ activityData }: ActivityHeatmapProps) {
  // Create a map for quick lookup
  const activityMap = new Map<string, DayActivity>()
  activityData.forEach((day) => {
    activityMap.set(day.date, day)
  })

  // Generate 12 months of days to fill the space
  const today = new Date()
  const twelveMonthsAgo = subMonths(today, 12)

  // Align to start of week (Monday)
  const startDate = startOfWeek(twelveMonthsAgo, { weekStartsOn: 1 })
  const endDate = endOfWeek(today, { weekStartsOn: 1 })

  const allDays = eachDayOfInterval({ start: startDate, end: endDate })

  // Group days by week
  const weeks: Date[][] = []
  let currentWeek: Date[] = []

  allDays.forEach((day) => {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  // Get color based on activity count (blue gradient matching buttons)
  const getColor = (count: number): string => {
    if (count === 0) return "bg-gray-100"
    if (count === 1) return "bg-blue-200"
    if (count <= 3) return "bg-blue-400"
    if (count <= 5) return "bg-blue-500"
    return "bg-blue-600"
  }

  // Get month labels for the header
  const getMonthLabels = () => {
    const labels: { month: string; colSpan: number }[] = []
    let currentMonth = ""
    let colSpan = 0

    weeks.forEach((week) => {
      const thursday = week[3] || week[week.length - 1]
      const monthName = format(thursday, "MMM")

      if (monthName !== currentMonth) {
        if (currentMonth) {
          labels.push({ month: currentMonth, colSpan })
        }
        currentMonth = monthName
        colSpan = 1
      } else {
        colSpan++
      }
    })

    if (currentMonth) {
      labels.push({ month: currentMonth, colSpan })
    }

    return labels
  }

  const monthLabels = getMonthLabels()
  // Show all 7 days
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  // Calculate totals for the period
  const totalActivities = activityData.reduce((sum, d) => sum + d.count, 0)
  const totalNewRepreneurs = activityData.reduce((sum, d) => sum + d.newRepreneurs, 0)
  const totalActivityLogs = activityData.reduce((sum, d) => sum + d.activities, 0)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5" />
            <span className="hidden sm:inline">Activity Heatmap</span>
            <span className="sm:hidden">Heatmap</span>
            <CardInfoButton info="Shows daily activity over the last 12 months. Darker squares = more activity (new repreneurs added + logged activities like calls, meetings, interviews)." />
          </CardTitle>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
            <span>{totalActivities} total</span>
            <span className="text-gray-300">|</span>
            <span>{totalNewRepreneurs} new</span>
            <span className="text-gray-300">|</span>
            <span>{totalActivityLogs} activities</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <TooltipProvider delayDuration={100}>
          {/* Scrollable container - scroll hint on mobile */}
          <div className="relative">
            <div
              className="overflow-x-auto pb-3"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#d1d5db #f3f4f6'
              }}
            >
            {/* Month labels */}
            <div className="flex mb-1 ml-8">
              {monthLabels.map((label, index) => (
                <div
                  key={index}
                  className="text-xs text-gray-500"
                  style={{ width: `${label.colSpan * 14}px` }}
                >
                  {label.month}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex">
              {/* Day labels - all 7 days */}
              <div className="flex flex-col mr-2 pt-0">
                {dayLabels.map((label, index) => (
                  <div
                    key={index}
                    className="h-[12px] text-[10px] text-gray-500 leading-[12px] pr-1"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <div className="flex gap-[2px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[2px]">
                    {week.map((day, dayIndex) => {
                      const dateStr = format(day, "yyyy-MM-dd")
                      const dayData = activityMap.get(dateStr)
                      const count = dayData?.count || 0
                      const isCurrentDay = isToday(day)

                      return (
                        <Tooltip key={dayIndex}>
                          <TooltipTrigger asChild>
                            <div
                              className={`
                                w-[12px] h-[12px] rounded-sm cursor-pointer
                                ${getColor(count)}
                                ${isCurrentDay ? "ring-1 ring-gray-400" : ""}
                                hover:ring-1 hover:ring-gray-400
                                transition-all
                              `}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{format(day, "EEEE, MMM d, yyyy")}</div>
                            {count > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                <div className="text-blue-600 font-medium">{count} activities</div>
                                {dayData?.newRepreneurs ? (
                                  <div>{dayData.newRepreneurs} new repreneur{dayData.newRepreneurs > 1 ? "s" : ""}</div>
                                ) : null}
                                {dayData?.activities ? (
                                  <div>{dayData.activities} activit{dayData.activities > 1 ? "ies" : "y"} (calls, meetings, etc.)</div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="text-gray-500">No activity</div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <span>Less</span>
              <div className="flex gap-[2px]">
                <div className="w-[12px] h-[12px] rounded-sm bg-gray-100" />
                <div className="w-[12px] h-[12px] rounded-sm bg-blue-200" />
                <div className="w-[12px] h-[12px] rounded-sm bg-blue-400" />
                <div className="w-[12px] h-[12px] rounded-sm bg-blue-500" />
                <div className="w-[12px] h-[12px] rounded-sm bg-blue-600" />
              </div>
              <span>More</span>
            </div>
            </div>
            {/* Scroll hint - fade effect on right edge (mobile only) */}
            <div className="absolute right-0 top-0 bottom-3 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden" />
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
