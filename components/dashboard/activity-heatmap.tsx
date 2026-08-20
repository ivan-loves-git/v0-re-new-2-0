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
import { useHydratedNow } from "@/hooks/use-hydrated-now"

interface DayActivity {
  date: string // YYYY-MM-DD
  count: number
  newRepreneurs: number
  activities: number
}

interface ActivityHeatmapProps {
  activityData: DayActivity[]
}

const kpiInfo = {
  activityHeatmap: {
    title: "Activity Heatmap",
    description: "12-month calendar view of daily activity. Each square represents a day. Color intensity shows activity volume (new repreneurs + logged activities).",
    why: "Spot patterns in your business rhythm. Identify slow periods, peak days, and seasonal trends. Helps with resource planning and performance monitoring.",
  },
}

export function ActivityHeatmap({ activityData }: ActivityHeatmapProps) {
  const now = useHydratedNow()

  if (now === null) {
    return (
      <Card className="h-full gap-0 py-0">
        <CardHeader className="flex min-h-14 justify-center border-b py-3">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4 text-muted-foreground" />Activity Heatmap</CardTitle>
        </CardHeader>
        <CardContent className="py-4 text-sm text-muted-foreground">Loading activity heatmap…</CardContent>
      </Card>
    )
  }
  // Create a map for quick lookup
  const activityMap = new Map<string, DayActivity>()
  activityData.forEach((day) => {
    activityMap.set(day.date, day)
  })

  // Generate 12 months of days to fill the space
  const today = new Date(now)
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
    if (count === 0) return "bg-muted"
    if (count === 1) return "bg-info/20"
    if (count <= 3) return "bg-info/45"
    if (count <= 5) return "bg-info/70"
    return "bg-info"
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
    <Card className="h-full gap-0 py-0">
      <CardHeader className="flex min-h-14 justify-center border-b py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="hidden sm:inline">Activity Heatmap</span>
            <span className="sm:hidden">Heatmap</span>
            <CardInfoButton info={kpiInfo.activityHeatmap} />
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:gap-4">
            <span>{totalActivities} total</span>
            <span aria-hidden="true" className="text-border">|</span>
            <span>{totalNewRepreneurs} new</span>
            <span aria-hidden="true" className="text-border">|</span>
            <span>{totalActivityLogs} activities</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center py-4">
        <p className="sr-only">
          Over the last 12 months: {totalActivities} total events, including {totalNewRepreneurs} new repreneurs and {totalActivityLogs} logged activities.
        </p>
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
                    className="text-xs text-muted-foreground"
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
                    className="h-[12px] pr-1 text-[10px] leading-[12px] text-muted-foreground"
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
                            <span
                              aria-hidden="true"
                              className={`
                                size-[12px] rounded-sm
                                ${getColor(count)}
                                ${isCurrentDay ? "ring-1 ring-foreground/40" : ""}
                                transition-shadow hover:ring-1 hover:ring-foreground/40
                              `}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{format(day, "EEEE, MMM d, yyyy")}</div>
                            {count > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                <div className="font-medium text-info">{count} activities</div>
                                {dayData?.newRepreneurs ? (
                                  <div>{dayData.newRepreneurs} new repreneur{dayData.newRepreneurs > 1 ? "s" : ""}</div>
                                ) : null}
                                {dayData?.activities ? (
                                  <div>{dayData.activities} activit{dayData.activities > 1 ? "ies" : "y"} (calls, meetings, etc.)</div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="text-muted-foreground">No activity</div>
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
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-[2px]">
                <div className="size-[12px] rounded-sm bg-muted" />
                <div className="size-[12px] rounded-sm bg-info/20" />
                <div className="size-[12px] rounded-sm bg-info/45" />
                <div className="size-[12px] rounded-sm bg-info/70" />
                <div className="size-[12px] rounded-sm bg-info" />
              </div>
              <span>More</span>
            </div>
            </div>
            {/* Scroll hint - fade effect on right edge (mobile only) */}
            <div className="pointer-events-none absolute bottom-3 right-0 top-0 w-8 bg-gradient-to-l from-card to-transparent sm:hidden" />
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
