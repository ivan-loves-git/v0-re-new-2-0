import { createClient } from "@/lib/supabase/server"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { GlobalActivityStream } from "@/components/dashboard/global-activity-stream"
import { RecentlyAddedRepreneurs } from "@/components/dashboard/recently-added-repreneurs"
import { RepreneursOverTimeChart } from "@/components/dashboard/repreneurs-over-time-chart"
import { format, subDays, startOfDay } from "date-fns"

export default async function DashboardV1Page() {
  const supabase = await createClient()

  // Fetch all repreneurs
  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  // Fetch recent activities (last 20)
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
    .limit(20)

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
  const thirtyDaysAgo = subDays(new Date(), 30)

  for (let i = 30; i >= 0; i--) {
    const date = subDays(new Date(), i)
    const dateStr = format(date, "MMM d")
    const startOfDate = startOfDay(date)
    const endOfDate = startOfDay(subDays(date, -1))

    const countOnDate = repreneurs?.filter((r) => {
      const created = new Date(r.created_at)
      return created >= startOfDate && created < endOfDate
    }).length || 0

    const cumulativeCount = repreneurs?.filter((r) => {
      const created = new Date(r.created_at)
      return created <= endOfDate
    }).length || 0

    chartData.push({
      date: dateStr,
      count: countOnDate,
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
        <p className="text-xs text-blue-600 mt-2 font-medium">Version 1: Stats on top, 2-column below</p>
      </div>

      {/* Stats Row */}
      <StatsCards
        totalRepreneurs={totalRepreneurs}
        leadCount={leadCount}
        qualifiedCount={qualifiedCount}
        clientCount={clientCount}
        layout="horizontal"
      />

      {/* Two Column Layout: Activity Stream | Recent + Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Activity Stream */}
        <GlobalActivityStream activities={activityItems} maxHeight="500px" />

        {/* Right: Recently Added + Chart stacked */}
        <div className="space-y-6">
          <RecentlyAddedRepreneurs repreneurs={recentRepreneurs} maxHeight="200px" />
          <RepreneursOverTimeChart data={chartData} />
        </div>
      </div>
    </div>
  )
}
