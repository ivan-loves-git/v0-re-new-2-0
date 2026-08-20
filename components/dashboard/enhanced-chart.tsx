"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TrendingUp, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, subWeeks, addWeeks, startOfWeek, endOfWeek, isWithinInterval, isBefore, isAfter, parseISO } from "date-fns"
import { WaveAreaChart } from "@/components/wave/charts"
import { useHydratedNow } from "@/hooks/use-hydrated-now"

interface ChartDataPoint {
  week: string
  weekStart: Date
  weekEnd: Date
  newRepreneurs: number
  cumulativeRepreneurs: number
  cumulativeClients: number
}

interface EnhancedChartProps {
  repreneursData: Array<{ created_at: string; lifecycle_status?: string | null }>
}

const kpiInfo = {
  pipelineTrends: {
    title: "Profile growth & current-client cohorts",
    description: "Weekly view of cumulative profile creation and the subset of those profiles that are clients today, grouped by profile creation date.",
    why: "Shows whether stronger client relationships are coming from newer or older profile cohorts without implying a historical conversion date.",
  },
}

export function EnhancedChart({ repreneursData }: EnhancedChartProps) {
  // The moving default is intentionally withheld until after hydration.
  const now = useHydratedNow()
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const today = now === null ? null : new Date(now)
  const endDate = selectedRange?.end ?? (today ? endOfWeek(today, { weekStartsOn: 1 }) : null)
  const startDate = selectedRange?.start ?? (today ? startOfWeek(subWeeks(today, 7), { weekStartsOn: 1 }) : null)
  const startDateMs = startDate?.getTime() ?? null
  const endDateMs = endDate?.getTime() ?? null

  // Navigate weeks
  const navigateWeeks = (direction: "left" | "right") => {
    if (!startDate || !endDate) return
    if (direction === "left") {
      setSelectedRange({ start: subWeeks(startDate, 1), end: subWeeks(endDate, 1) })
    } else {
      setSelectedRange({ start: addWeeks(startDate, 1), end: addWeeks(endDate, 1) })
    }
  }

  // Process data into weekly aggregates
  const chartData = useMemo(() => {
    if (startDateMs === null || endDateMs === null) return []
    const weeks: ChartDataPoint[] = []
    let currentWeekStart = startOfWeek(new Date(startDateMs), { weekStartsOn: 1 })
    const rangeEnd = new Date(endDateMs)

    // Calculate cumulative repreneurs before the start date
    let cumulativeCount = repreneursData.filter(r => {
      const created = new Date(r.created_at)
      return isBefore(created, currentWeekStart)
    }).length
    let cumulativeClientCount = repreneursData.filter(r => {
      const created = new Date(r.created_at)
      return r.lifecycle_status === "client" && isBefore(created, currentWeekStart)
    }).length

    while (currentWeekStart <= rangeEnd) {
      const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })

      // Count new repreneurs this week
      const newThisWeek = repreneursData.filter(r => {
        const created = new Date(r.created_at)
        return isWithinInterval(created, { start: currentWeekStart, end: currentWeekEnd })
      }).length

      const newClientsThisWeek = repreneursData.filter(r => {
        const created = new Date(r.created_at)
        return r.lifecycle_status === "client" && isWithinInterval(created, { start: currentWeekStart, end: currentWeekEnd })
      }).length

      cumulativeCount += newThisWeek
      cumulativeClientCount += newClientsThisWeek

      weeks.push({
        week: format(currentWeekStart, "MMM d"),
        weekStart: currentWeekStart,
        weekEnd: currentWeekEnd,
        newRepreneurs: newThisWeek,
        cumulativeRepreneurs: cumulativeCount,
        cumulativeClients: cumulativeClientCount,
      })

      currentWeekStart = addWeeks(currentWeekStart, 1)
    }

    return weeks
  }, [repreneursData, startDateMs, endDateMs])

  // Check if we can navigate further (prevent going into the future)
  const canNavigateRight = Boolean(endDate && today && !isAfter(addWeeks(endDate, 1), endOfWeek(today, { weekStartsOn: 1 })))

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex min-h-14 justify-center border-b py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-muted-foreground" />
            <span className="hidden sm:inline">Profile Growth & Client Cohorts</span>
            <span className="sm:hidden">Profile cohorts</span>
            <CardInfoButton info={kpiInfo.pipelineTrends} />
          </CardTitle>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Navigation arrows */}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navigateWeeks("left")}
              aria-label="Show the previous eight weeks"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {/* Date picker */}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 sm:gap-2 px-2 sm:px-3">
                  <Calendar className="size-4" />
                  <span className="text-xs hidden sm:inline">
                    {startDate && endDate ? `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}` : "Loading range"}
                  </span>
                  <span className="text-xs sm:hidden">
                    {startDate && endDate ? `${format(startDate, "M/d")} - ${format(endDate, "M/d")}` : "Loading"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="pipeline-trend-start" className="text-xs font-medium text-foreground">Start date</label>
                    <Input
                      id="pipeline-trend-start"
                      type="date"
                      value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                      max={today ? format(today, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedRange((current) => ({ start: startOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }), end: current?.end ?? endDate ?? endOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }) }))
                        }
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="pipeline-trend-end" className="text-xs font-medium text-foreground">End date</label>
                    <Input
                      id="pipeline-trend-end"
                      type="date"
                      value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                      max={today ? format(today, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedRange((current) => ({ start: current?.start ?? startDate ?? startOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }), end: endOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }) }))
                        }
                      }}
                      className="h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setDatePickerOpen(false)}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navigateWeeks("right")}
              disabled={!canNavigateRight}
              aria-label="Show the next eight weeks"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-4">
        <WaveAreaChart
          data={chartData}
          label="Profile creation growth and current client cohorts"
          xKey="week"
          series={[
            { key: "cumulativeRepreneurs", label: "Repreneurs", color: "var(--chart-1)" },
            { key: "cumulativeClients", label: "Current clients by profile start", color: "var(--chart-4)" },
          ]}
          className="h-[240px]"
        />
      </CardContent>
    </Card>
  )
}
