import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GlobalActivityStream } from "@/components/dashboard/global-activity-stream"
import { RecentlyAddedRepreneurs } from "@/components/dashboard/recently-added-repreneurs"
import { RepreneursOverTimeChart } from "@/components/dashboard/repreneurs-over-time-chart"
import { Users, UserCheck, UserPlus, Briefcase } from "lucide-react"
import { format, subDays, startOfDay } from "date-fns"

export default async function DashboardV3Page() {
  const supabase = await createClient()

  // Fetch all repreneurs
  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  // Fetch recent activities (last 25 for the main focus)
  const { data: activities } = await supabase
    .from("activities")
    .select(`
      id,
      type,
      title,
      description,
      duration_minutes,
      created_at,
      repreneur_id,
      repreneurs (
        first_name,
        last_name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(25)

  // Calculate stats
  const totalRepreneurs = repreneurs?.length || 0
  const leadCount = repreneurs?.filter((r) => r.lifecycle_status === "lead").length || 0
  const qualifiedCount = repreneurs?.filter((r) => r.lifecycle_status === "qualified").length || 0
  const clientCount = repreneurs?.filter((r) => r.lifecycle_status === "client").length || 0

  // Get recently added repreneurs (last 7 days)
  const sevenDaysAgo = subDays(new Date(), 7)
  const recentRepreneurs = repreneurs?.filter(
    (r) => new Date(r.created_at) >= sevenDaysAgo
  ) || []

  // Prepare chart data - last 30 days
  const chartData = []
  for (let i = 30; i >= 0; i--) {
    const date = subDays(new Date(), i)
    const dateStr = format(date, "MMM d")
    const startOfDate = startOfDay(date)
    const endOfDate = startOfDay(subDays(date, -1))

    const cumulativeCount = repreneurs?.filter((r) => {
      const created = new Date(r.created_at)
      return created <= endOfDate
    }).length || 0

    chartData.push({
      date: dateStr,
      count: 0,
      cumulative: cumulativeCount,
    })
  }

  // Transform activities for the stream
  const activityItems = activities?.map((a: any) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    duration_minutes: a.duration_minutes,
    created_at: a.created_at,
    repreneur_id: a.repreneur_id,
    repreneur_name: `${a.repreneurs?.first_name || ""} ${a.repreneurs?.last_name || ""}`.trim() || "Unknown",
  })) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your repreneur pipeline</p>
        <p className="text-xs text-purple-600 mt-2 font-medium">Version 3: Activity-focused with sidebar</p>
      </div>

      {/* Main Layout: Activity Stream (wide) | Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Activity Stream - Takes 2 columns */}
        <div className="lg:col-span-2">
          <GlobalActivityStream activities={activityItems} maxHeight="600px" />
        </div>

        {/* Right Sidebar: Stats + Recent */}
        <div className="space-y-4">
          {/* Compact Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pipeline Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                <Users className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-lg font-semibold">{totalRepreneurs}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
                <UserPlus className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-lg font-semibold">{leadCount}</p>
                  <p className="text-xs text-gray-500">Leads</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50">
                <UserCheck className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-lg font-semibold">{qualifiedCount}</p>
                  <p className="text-xs text-gray-500">Qualified</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                <Briefcase className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-lg font-semibold">{clientCount}</p>
                  <p className="text-xs text-gray-500">Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recently Added */}
          <RecentlyAddedRepreneurs repreneurs={recentRepreneurs} maxHeight="280px" />
        </div>
      </div>

      {/* Bottom: Full Width Chart */}
      <RepreneursOverTimeChart data={chartData} />
    </div>
  )
}
