"use client"

import { useState, useMemo } from "react"
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
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

interface ChartDataPoint {
  week: string
  weekStart: Date
  weekEnd: Date
  newRepreneurs: number
  cumulativeRepreneurs: number
  activities: number
}

interface EnhancedChartProps {
  repreneursData: Array<{ created_at: string }>
  activitiesData: Array<{ created_at: string }>
}

export function EnhancedChart({ repreneursData, activitiesData }: EnhancedChartProps) {
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

    while (currentWeekStart <= endDate) {
      const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })

      // Count new repreneurs this week
      const newThisWeek = repreneursData.filter(r => {
        const created = new Date(r.created_at)
        return isWithinInterval(created, { start: currentWeekStart, end: currentWeekEnd })
      }).length

      // Count activities this week
      const activitiesThisWeek = activitiesData.filter(a => {
        const created = new Date(a.created_at)
        return isWithinInterval(created, { start: currentWeekStart, end: currentWeekEnd })
      }).length

      cumulativeCount += newThisWeek

      weeks.push({
        week: format(currentWeekStart, "MMM d"),
        weekStart: currentWeekStart,
        weekEnd: currentWeekEnd,
        newRepreneurs: newThisWeek,
        cumulativeRepreneurs: cumulativeCount,
        activities: activitiesThisWeek,
      })

      currentWeekStart = addWeeks(currentWeekStart, 1)
    }

    return weeks
  }, [repreneursData, activitiesData, startDate, endDate])

  // Check if we can navigate further (prevent going into the future)
  const canNavigateRight = !isAfter(addWeeks(endDate, 1), endOfWeek(new Date(), { weekStartsOn: 1 }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-gray-900" />
            Pipeline & Activity Trends
            <CardInfoButton info="Weekly view showing cumulative repreneurs (blue area) and activity count (orange line). Use arrows to navigate or calendar to select date range." />
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Navigation arrows */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateWeeks("left")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Date picker */}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">
                    {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
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
              className="h-8 w-8"
              onClick={() => navigateWeeks("right")}
              disabled={!canNavigateRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRepreneurs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="week"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              {/* Left Y-axis for Repreneurs */}
              <YAxis
                yAxisId="left"
                tick={{ fill: "#3b82f6", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#3b82f6" }}
                allowDecimals={false}
                label={{
                  value: 'Repreneurs',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#3b82f6', fontSize: 11 }
                }}
              />
              {/* Right Y-axis for Activities */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#f97316", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#f97316" }}
                allowDecimals={false}
                label={{
                  value: 'Activities',
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: '#f97316', fontSize: 11 }
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    cumulativeRepreneurs: "Total Repreneurs",
                    activities: "Activities",
                  }
                  return [value, labels[name] || name]
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    cumulativeRepreneurs: "Repreneurs",
                    activities: "Activities",
                  }
                  return labels[value] || value
                }}
              />
              {/* Repreneurs area chart */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="cumulativeRepreneurs"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorRepreneurs)"
                strokeWidth={2}
              />
              {/* Activities line chart */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="activities"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
