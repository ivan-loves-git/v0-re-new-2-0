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
    title: "Pipeline & Client Trends",
    description: "Weekly view combining cumulative repreneur growth (blue area) with cumulative clients (orange line). Navigate with arrows or select custom date range.",
    why: "Track whether the repreneur base is converting into clients. If repreneurs grow but clients stay flat, review qualification, offer timing, and follow-up.",
  },
}

export function EnhancedChart({ repreneursData }: EnhancedChartProps) {
  // Default to last 8 weeks
  const [endDate, setEndDate] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }))
  const [startDate, setStartDate] = useState<Date>(startOfWeek(subWeeks(new Date(), 7), { weekStartsOn: 1 }))
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Navigate weeks
  const navigateWeeks = (direction: "left" | "right") => {
    if (direction === "left") {
      setStartDate(subWeeks(startDate, 1))
      setEndDate(subWeeks(endDate, 1))
    } else {
      setStartDate(addWeeks(startDate, 1))
      setEndDate(addWeeks(endDate, 1))
    }
  }

  // Process data into weekly aggregates
  const chartData = useMemo(() => {
    const weeks: ChartDataPoint[] = []
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 })

    // Calculate cumulative repreneurs before the start date
    let cumulativeCount = repreneursData.filter(r => {
      const created = new Date(r.created_at)
      return isBefore(created, currentWeekStart)
    }).length
    let cumulativeClientCount = repreneursData.filter(r => {
      const created = new Date(r.created_at)
      return r.lifecycle_status === "client" && isBefore(created, currentWeekStart)
    }).length

    while (currentWeekStart <= endDate) {
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
  }, [repreneursData, startDate, endDate])

  // Check if we can navigate further (prevent going into the future)
  const canNavigateRight = !isAfter(addWeeks(endDate, 1), endOfWeek(new Date(), { weekStartsOn: 1 }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-5 text-gray-900" />
            <span className="hidden sm:inline">Pipeline & Client Trends</span>
            <span className="sm:hidden">Trends</span>
            <CardInfoButton info={kpiInfo.pipelineTrends} />
          </CardTitle>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Navigation arrows */}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navigateWeeks("left")}
            >
              <ChevronLeft className="size-4" />
            </Button>

            {/* Date picker */}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 sm:gap-2 px-2 sm:px-3" suppressHydrationWarning>
                  <Calendar className="size-4" />
                  <span className="text-xs hidden sm:inline">
                    {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
                  </span>
                  <span className="text-xs sm:hidden">
                    {format(startDate, "M/d")} - {format(endDate, "M/d")}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Start Date</label>
                    <Input
                      type="date"
                      value={format(startDate, "yyyy-MM-dd")}
                      max={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => {
                        if (e.target.value) {
                          setStartDate(startOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }))
                        }
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">End Date</label>
                    <Input
                      type="date"
                      value={format(endDate, "yyyy-MM-dd")}
                      max={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEndDate(endOfWeek(parseISO(e.target.value), { weekStartsOn: 1 }))
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
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <WaveAreaChart
          data={chartData}
          label="Pipeline and client trends"
          xKey="week"
          series={[
            { key: "cumulativeRepreneurs", label: "Repreneurs", color: "var(--chart-1)" },
            { key: "cumulativeClients", label: "Clients", color: "var(--chart-4)" },
          ]}
          className="h-[240px]"
        />
      </CardContent>
    </Card>
  )
}
