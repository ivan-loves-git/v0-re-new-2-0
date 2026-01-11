import { createClient } from "@/lib/supabase/server"
import { StatsColumn } from "@/components/dashboard/stats-column"
import { GlobalActivityStream } from "@/components/dashboard/global-activity-stream"
import { RecentlyAddedRepreneurs } from "@/components/dashboard/recently-added-repreneurs"
import { EnhancedChart } from "@/components/dashboard/enhanced-chart"
import { ConversionFunnel } from "@/components/dashboard/conversion-funnel"
import { JourneyStageDistribution } from "@/components/dashboard/journey-stage-distribution"
import { TopTier1Repreneurs } from "@/components/dashboard/top-tier1-repreneurs"
import { TopTier2Repreneurs } from "@/components/dashboard/top-tier2-repreneurs"
import { subDays, startOfWeek, subWeeks, isWithinInterval, endOfWeek } from "date-fns"
import { calculateOverallScore } from "@/lib/scoring-utils"

export default async function DashboardFullPage() {
  const supabase = await createClient()

  // Fetch all repreneurs
  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  // Fetch all activities
  const { data: allActivities } = await supabase
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

  // Calculate lifecycle stats
  const totalRepreneurs = repreneurs?.length || 0
  const leadCount = repreneurs?.filter((r) => r.lifecycle_status === "lead").length || 0
  const qualifiedCount = repreneurs?.filter((r) => r.lifecycle_status === "qualified").length || 0
  const clientCount = repreneurs?.filter((r) => r.lifecycle_status === "client").length || 0

  // Calculate last week stats for comparison
  const now = new Date()
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })

  const repreneursLastWeek = repreneurs?.filter((r) => {
    const created = new Date(r.created_at)
    return created <= lastWeekEnd
  }) || []

  const lastWeekTotal = repreneursLastWeek.length
  const lastWeekLeads = repreneursLastWeek.filter((r) => r.lifecycle_status === "lead").length
  const lastWeekQualified = repreneursLastWeek.filter((r) => r.lifecycle_status === "qualified").length
  const lastWeekClients = repreneursLastWeek.filter((r) => r.lifecycle_status === "client").length

  // Calculate journey stage distribution
  const explorerCount = repreneurs?.filter((r) => r.journey_stage === "explorer").length || 0
  const learnerCount = repreneurs?.filter((r) => r.journey_stage === "learner").length || 0
  const readyCount = repreneurs?.filter((r) => r.journey_stage === "ready").length || 0
  const serialAcquirerCount = repreneurs?.filter((r) => r.journey_stage === "serial_acquirer").length || 0
  const noStageCount = repreneurs?.filter((r) => !r.journey_stage).length || 0

  // Get recently added repreneurs (last 7 days)
  const sevenDaysAgo = subDays(new Date(), 7)
  const recentRepreneurs = repreneurs?.filter(
    (r) => new Date(r.created_at) >= sevenDaysAgo
  ) || []

  // Calculate top Tier 1 repreneurs (based on questionnaire score) - get more for pagination
  const topTier1Repreneurs = repreneurs?.map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    lifecycle_status: r.lifecycle_status,
    tier1_score: calculateOverallScore(r),
  }))
    .filter(c => c.tier1_score > 0)
    .sort((a, b) => (b.tier1_score || 0) - (a.tier1_score || 0))
    .slice(0, 30) || []

  // Calculate top Tier 2 repreneurs (based on post-interview stars) - get more for pagination
  const topTier2Repreneurs = repreneurs?.map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    lifecycle_status: r.lifecycle_status,
    tier2_stars: r.tier2_stars || null,
  }))
    .filter(c => c.tier2_stars !== null && c.tier2_stars > 0)
    .sort((a, b) => (b.tier2_stars || 0) - (a.tier2_stars || 0))
    .slice(0, 30) || []

  // Prepare data for enhanced chart
  const repreneursForChart = repreneurs?.map(r => ({ created_at: r.created_at })) || []
  const activitiesForChart = allActivities?.map(a => ({ created_at: a.created_at })) || []

  // Transform activities for the stream (limit to 20 for larger display)
  const activityItems = allActivities?.slice(0, 20).map((a: any) => ({
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
      </div>

      {/* Row 1: Stats Column | Top Tier 1 | Top Tier 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <StatsColumn
          totalRepreneurs={totalRepreneurs}
          leadCount={leadCount}
          qualifiedCount={qualifiedCount}
          clientCount={clientCount}
          lastWeekTotal={lastWeekTotal}
          lastWeekLeads={lastWeekLeads}
          lastWeekQualified={lastWeekQualified}
          lastWeekClients={lastWeekClients}
        />
        <TopTier1Repreneurs repreneurs={topTier1Repreneurs} itemsPerPage={5} />
        <TopTier2Repreneurs repreneurs={topTier2Repreneurs} itemsPerPage={5} />
      </div>

      {/* Row 2: Funnel + Journey | Activity Stream | Recently Added */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Funnel + Journey stacked */}
        <div className="flex flex-col gap-4">
          <div className="flex-shrink-0">
            <ConversionFunnel
              leadCount={leadCount}
              qualifiedCount={qualifiedCount}
              clientCount={clientCount}
              compact
            />
          </div>
          <div className="flex-1 min-h-0">
            <JourneyStageDistribution
              explorerCount={explorerCount}
              learnerCount={learnerCount}
              readyCount={readyCount}
              serialAcquirerCount={serialAcquirerCount}
              noStageCount={noStageCount}
            />
          </div>
        </div>
        {/* Middle + Right: Activity Stream and Recently Added */}
        <GlobalActivityStream activities={activityItems} maxHeight="380px" />
        <RecentlyAddedRepreneurs repreneurs={recentRepreneurs} maxHeight="380px" />
      </div>

      {/* Row 3: Enhanced Chart (full width) */}
      <EnhancedChart
        repreneursData={repreneursForChart}
        activitiesData={activitiesForChart}
      />
    </div>
  )
}
