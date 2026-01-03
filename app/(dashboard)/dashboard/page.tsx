import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { StatsColumn } from "@/components/dashboard/stats-column"
import { GlobalActivityStream } from "@/components/dashboard/global-activity-stream"
import { RecentlyAddedRepreneurs } from "@/components/dashboard/recently-added-repreneurs"
import { EnhancedChart } from "@/components/dashboard/enhanced-chart"
import { ConversionFunnel } from "@/components/dashboard/conversion-funnel"
import { JourneyStageDistribution } from "@/components/dashboard/journey-stage-distribution"
import { TopTier1Candidates } from "@/components/dashboard/top-tier1-candidates"
import { TopTier2Candidates } from "@/components/dashboard/top-tier2-candidates"
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { subDays, subWeeks, endOfWeek, subMonths, format } from "date-fns"
import { calculateOverallScore } from "@/lib/scoring-utils"
import { ArrowRight, Users, TrendingUp, Compass } from "lucide-react"

// Cache page data for 30 seconds - prevents re-fetching on rapid navigation
export const revalidate = 30

// Skeleton components for Suspense fallbacks
function StatsColumnSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TopCandidatesSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ActivityStreamSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[200px] w-full" />
      </CardContent>
    </Card>
  )
}

// Server component for Stats + Top Tiers row
async function StatsAndTiersRow() {
  const supabase = await createClient()

  // Parallel fetch - both queries run simultaneously
  const [repreneursResult, userResult] = await Promise.all([
    supabase
      .from("repreneurs")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.auth.getUser()
  ])

  const repreneurs = repreneursResult.data || []

  // Calculate lifecycle stats
  const totalRepreneurs = repreneurs.length
  const leadCount = repreneurs.filter((r) => r.lifecycle_status === "lead").length
  const qualifiedCount = repreneurs.filter((r) => r.lifecycle_status === "qualified").length
  const clientCount = repreneurs.filter((r) => r.lifecycle_status === "client").length

  // Calculate last week stats
  const now = new Date()
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const repreneursLastWeek = repreneurs.filter((r) => new Date(r.created_at) <= lastWeekEnd)

  const lastWeekTotal = repreneursLastWeek.length
  const lastWeekLeads = repreneursLastWeek.filter((r) => r.lifecycle_status === "lead").length
  const lastWeekQualified = repreneursLastWeek.filter((r) => r.lifecycle_status === "qualified").length
  const lastWeekClients = repreneursLastWeek.filter((r) => r.lifecycle_status === "client").length

  // Top Tier 1 candidates
  const topTier1Candidates = repreneurs
    .map((r) => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      lifecycle_status: r.lifecycle_status,
      tier1_score: calculateOverallScore(r),
    }))
    .filter(c => c.tier1_score > 0)
    .sort((a, b) => (b.tier1_score || 0) - (a.tier1_score || 0))
    .slice(0, 30)

  // Top Tier 2 candidates
  const topTier2Candidates = repreneurs
    .map((r) => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      lifecycle_status: r.lifecycle_status,
      tier2_stars: r.tier2_stars || null,
    }))
    .filter(c => c.tier2_stars !== null && c.tier2_stars > 0)
    .sort((a, b) => (b.tier2_stars || 0) - (a.tier2_stars || 0))
    .slice(0, 30)

  return (
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
      <TopTier1Candidates candidates={topTier1Candidates} itemsPerPage={5} />
      <TopTier2Candidates candidates={topTier2Candidates} itemsPerPage={5} />
    </div>
  )
}

// Server component for Funnel + Journey + Activity + Recent row
async function MiddleRow() {
  const supabase = await createClient()

  // Parallel fetch - all queries run simultaneously
  const [repreneursResult, activitiesResult, userResult] = await Promise.all([
    supabase
      .from("repreneurs")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select(`
        id,
        activity_type,
        notes,
        duration_minutes,
        created_at,
        created_by,
        repreneur_id,
        repreneurs (
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.auth.getUser()
  ])

  const repreneurs = repreneursResult.data || []
  const allActivities = activitiesResult.data || []
  const user = userResult.data?.user

  // Build user email map
  const userEmailMap: Record<string, string> = {}
  if (user) {
    userEmailMap[user.id] = user.email?.split('@')[0] || 'Team'
  }

  // Calculate counts
  const leadCount = repreneurs.filter((r) => r.lifecycle_status === "lead").length
  const qualifiedCount = repreneurs.filter((r) => r.lifecycle_status === "qualified").length
  const clientCount = repreneurs.filter((r) => r.lifecycle_status === "client").length

  // Journey stage distribution
  const explorerCount = repreneurs.filter((r) => r.journey_stage === "explorer").length
  const learnerCount = repreneurs.filter((r) => r.journey_stage === "learner").length
  const readyCount = repreneurs.filter((r) => r.journey_stage === "ready").length
  const serialAcquirerCount = repreneurs.filter((r) => r.journey_stage === "serial_acquirer").length
  const noStageCount = repreneurs.filter((r) => !r.journey_stage).length

  // Recent repreneurs
  const sevenDaysAgo = subDays(new Date(), 7)
  const recentRepreneurs = repreneurs.filter((r) => new Date(r.created_at) >= sevenDaysAgo)

  // Activity stream
  const activityTypeLabels: Record<string, string> = {
    welcome_email: "Welcome Email",
    interview: "Interview",
    offer_submitted: "Offer Submitted",
    offer_rejected: "Offer Rejected",
    offer_approved: "Offer Approved",
    meeting: "Meeting",
  }

  const activityItems = allActivities.map((a: any) => ({
    id: a.id,
    type: a.activity_type,
    title: activityTypeLabels[a.activity_type] || a.activity_type,
    description: a.notes,
    duration_minutes: a.duration_minutes,
    created_at: a.created_at,
    repreneur_id: a.repreneur_id,
    repreneur_name: `${a.repreneurs?.first_name || ""} ${a.repreneurs?.last_name || ""}`.trim() || "Unknown",
    owner: userEmailMap[a.created_by] || "Team",
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-3">
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
      <GlobalActivityStream activities={activityItems} maxHeight="380px" />
      <RecentlyAddedRepreneurs repreneurs={recentRepreneurs} maxHeight="380px" />
    </div>
  )
}

// Server component for Charts row
async function ChartsRow() {
  const supabase = await createClient()

  // Parallel fetch
  const [repreneursResult, activitiesResult] = await Promise.all([
    supabase
      .from("repreneurs")
      .select("id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("id, created_at")
      .order("created_at", { ascending: false })
  ])

  const repreneurs = repreneursResult.data || []
  const allActivities = activitiesResult.data || []

  // Chart data
  const repreneursForChart = repreneurs.map(r => ({ created_at: r.created_at }))
  const activitiesForChart = allActivities.map(a => ({ created_at: a.created_at }))

  // Heatmap data
  const twelveMonthsAgo = subMonths(new Date(), 12)

  const repreneursPerDay = new Map<string, number>()
  repreneurs.forEach((r) => {
    const date = new Date(r.created_at)
    if (date >= twelveMonthsAgo) {
      const dateStr = format(date, "yyyy-MM-dd")
      repreneursPerDay.set(dateStr, (repreneursPerDay.get(dateStr) || 0) + 1)
    }
  })

  const activitiesPerDay = new Map<string, number>()
  allActivities.forEach((a) => {
    const date = new Date(a.created_at)
    if (date >= twelveMonthsAgo) {
      const dateStr = format(date, "yyyy-MM-dd")
      activitiesPerDay.set(dateStr, (activitiesPerDay.get(dateStr) || 0) + 1)
    }
  })

  const allDates = new Set([...repreneursPerDay.keys(), ...activitiesPerDay.keys()])
  const heatmapData = Array.from(allDates).map((dateStr) => ({
    date: dateStr,
    newRepreneurs: repreneursPerDay.get(dateStr) || 0,
    activities: activitiesPerDay.get(dateStr) || 0,
    count: (repreneursPerDay.get(dateStr) || 0) + (activitiesPerDay.get(dateStr) || 0),
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActivityHeatmap activityData={heatmapData} />
      <EnhancedChart
        repreneursData={repreneursForChart}
        activitiesData={activitiesForChart}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header - renders immediately */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your repreneur pipeline</p>
      </div>

      {/* Row 1: Stats + Top Tiers - streams in */}
      <Suspense fallback={
        <div className="grid gap-6 lg:grid-cols-3">
          <StatsColumnSkeleton />
          <TopCandidatesSkeleton />
          <TopCandidatesSkeleton />
        </div>
      }>
        <StatsAndTiersRow />
      </Suspense>

      {/* Row 2: Funnel + Journey + Activity + Recent - streams in */}
      <Suspense fallback={
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-4">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <ActivityStreamSkeleton />
          <ActivityStreamSkeleton />
        </div>
      }>
        <MiddleRow />
      </Suspense>

      {/* Row 3: Charts - streams in */}
      <Suspense fallback={
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      }>
        <ChartsRow />
      </Suspense>

      {/* Quick Navigation - renders immediately (no data) */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pipeline View
            </CardTitle>
            <CardDescription>Visualize your repreneur pipeline in a kanban board</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/pipeline">
              <Button className="w-full">
                Go to Pipeline
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Repreneurs
            </CardTitle>
            <CardDescription>View and manage all repreneurs in a detailed list</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/repreneurs">
              <Button className="w-full">
                View Repreneurs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5" />
              Repreneur Journey
            </CardTitle>
            <CardDescription>Track repreneurs through their acquisition journey</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/journey">
              <Button className="w-full">
                View Journey
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
