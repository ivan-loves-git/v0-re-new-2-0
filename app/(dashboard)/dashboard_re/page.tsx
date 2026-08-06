import { Suspense } from "react"
import { getCurrentUser } from "@/lib/auth-server"
import { StatsColumn } from "@/components/dashboard/stats-column"
import { GlobalActivityStream } from "@/components/dashboard/global-activity-stream"
import { RecentlyAddedRepreneurs } from "@/components/dashboard/recently-added-repreneurs"
import { EnhancedChart } from "@/components/dashboard/enhanced-chart"
import { ConversionFunnel } from "@/components/dashboard/conversion-funnel"
import { JourneyStageDistribution } from "@/components/dashboard/journey-stage-distribution"
import { TopTier1Repreneurs } from "@/components/dashboard/top-tier1-repreneurs"
import { AssessmentStatus, RecentAssessmentResults } from "@/components/dashboard/assessment-status"
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import Link from "next/link"
import { connection } from "next/server"
import { subDays, subWeeks, endOfWeek, subMonths, format } from "date-fns"
import { Eye, LayoutDashboard } from "lucide-react"
import { getFollowUpSuggestions } from "@/lib/actions/wave-ai"
import { FollowUpSuggestionsWidget } from "@/components/follow-ups/follow-up-suggestions-widget"
import { getRepreneurDashboardSnapshot } from "@/lib/data/dashboard-snapshots"

// Skeleton components for Suspense fallbacks
function KpiRailSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-3 xl:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="min-h-[118px] border-b border-r p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-5 h-7 w-14" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

function TopRepreneursSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
            <Skeleton className="size-5 rounded-full" />
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
            <Skeleton className="size-8 rounded-full" />
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
  const { repreneurs, assessments: assessmentsRaw } =
    await getRepreneurDashboardSnapshot()

  // Calculate lifecycle stats
  const totalRepreneurs = repreneurs.length
  const leadCount = repreneurs.filter((r) => r.lifecycle_status === "lead").length
  const qualifiedCount = repreneurs.filter((r) => r.lifecycle_status === "qualified").length
  const clientCount = repreneurs.filter((r) => r.lifecycle_status === "client").length
  const toReactivateCount = repreneurs.filter((r) => r.lifecycle_status === "to_reactivate").length

  // Calculate last week stats
  const now = new Date()
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const repreneursLastWeek = repreneurs.filter((r) => new Date(r.created_at) <= lastWeekEnd)

  const lastWeekTotal = repreneursLastWeek.length
  // Rank by the same combined WHO + WHEN score shown in the UI.
  const topTier1Repreneurs = repreneurs
    .map((r) => {
      const whoScore = r.who_score ?? r.tier1_score ?? 0
      const whenScore = r.when_score ?? 0
      return {
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        lifecycle_status: r.lifecycle_status,
        tier1_score: whoScore + whenScore,
        who_score: whoScore,
        when_score: whenScore,
        created_at: r.created_at,
      }
    })
    .filter(c => c.tier1_score > 0)
    .sort((a, b) => (b.tier1_score || 0) - (a.tier1_score || 0))

  // Build repreneur name lookup
  const repreneurMap = new Map(repreneurs.map(r => [r.id, r]))

  // Deduplicate assessments: keep latest per repreneur
  const latestByRepreneur = new Map<string, typeof assessmentsRaw[0]>()
  for (const a of assessmentsRaw) {
    if (!latestByRepreneur.has(a.repreneur_id)) {
      latestByRepreneur.set(a.repreneur_id, a)
    }
  }

  const assessmentEntries = Array.from(latestByRepreneur.values()).map(a => {
    const r = repreneurMap.get(a.repreneur_id)
    return {
      id: a.id,
      first_name: r?.first_name || "Unknown",
      last_name: r?.last_name || "",
      repreneur_id: a.repreneur_id,
      decision: a.decision,
      completed: !!a.completed_at,
    }
  })

  return (
    <div className="space-y-4">
      <StatsColumn
        totalRepreneurs={totalRepreneurs}
        leadCount={leadCount}
        qualifiedCount={qualifiedCount}
        clientCount={clientCount}
        toReactivateCount={toReactivateCount}
        lastWeekTotal={lastWeekTotal}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <TopTier1Repreneurs repreneurs={topTier1Repreneurs} itemsPerPage={5} />
        <AssessmentStatus assessments={assessmentEntries} totalRepreneurs={totalRepreneurs} />
        <RecentAssessmentResults assessments={assessmentEntries} />
      </div>
    </div>
  )
}

// Server component for Funnel + Journey + Activity + Recent row
async function MiddleRow() {
  const { repreneurs, activities } = await getRepreneurDashboardSnapshot()

  // Get current user from Better Auth
  const user = await getCurrentUser()
  const allActivities = activities || []

  // Build user email map
  const userEmailMap: Record<string, string> = {}
  if (user) {
    userEmailMap[user.id] = user.email?.split('@')[0] || user.name || 'Team'
  }

  // Calculate counts
  const leadCount = repreneurs.filter((r) => r.lifecycle_status === "lead").length
  const qualifiedCount = repreneurs.filter((r) => r.lifecycle_status === "qualified").length
  const clientCount = repreneurs.filter((r) => r.lifecycle_status === "client").length

  // Journey stage distribution
  const explorerCount = repreneurs.filter((r) => r.journey_stage === "explorer").length
  const learnerCount = repreneurs.filter((r) => r.journey_stage === "learner").length
  const readyCount = repreneurs.filter((r) => r.journey_stage === "ready").length
  const executionCount = repreneurs.filter((r) => r.journey_stage === "execution").length
  const postAcquisitionCount = repreneurs.filter((r) => r.journey_stage === "post_acquisition").length
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

  const activityItems = allActivities.map((a) => ({
    id: a.id,
    type: a.activity_type,
    title: activityTypeLabels[a.activity_type] || a.activity_type,
    description: a.notes,
    duration_minutes: a.duration_minutes,
    created_at: a.created_at,
    repreneur_id: a.repreneur_id,
    repreneur_name: `${a.repreneurs?.first_name || ""} ${a.repreneurs?.last_name || ""}`.trim() || "Unknown",
    owner: a.created_by ? userEmailMap[a.created_by] || "Team" : "Team",
  }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <ConversionFunnel
          leadCount={leadCount}
          qualifiedCount={qualifiedCount}
          clientCount={clientCount}
          compact
        />
        <JourneyStageDistribution
          explorerCount={explorerCount}
          learnerCount={learnerCount}
          readyCount={readyCount}
          executionCount={executionCount}
          postAcquisitionCount={postAcquisitionCount}
          noStageCount={noStageCount}
        />
        <GlobalActivityStream activities={activityItems} maxHeight="260px" />
      </div>
      <RecentlyAddedRepreneurs repreneurs={recentRepreneurs} maxHeight="420px" />
    </div>
  )
}

// Server component for Charts row
async function ChartsRow() {
  const { chartRepreneurs, chartActivities } =
    await getRepreneurDashboardSnapshot()
  const repreneurs = chartRepreneurs
  const allActivities = chartActivities

  // Chart data
  const repreneursForChart = repreneurs.map(r => ({ created_at: r.created_at, lifecycle_status: r.lifecycle_status }))

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
    <div className="grid gap-4 xl:grid-cols-2">
      <ActivityHeatmap activityData={heatmapData} />
      <EnhancedChart
        repreneursData={repreneursForChart}
      />
    </div>
  )
}

// Server component for deterministic follow-up suggestions
async function FollowUpSuggestionsRow() {
  await connection()

  let data: Awaited<ReturnType<typeof getFollowUpSuggestions>>
  try {
    data = await getFollowUpSuggestions()
  } catch {
    console.error("Follow-up suggestions could not be loaded")
    return null
  }

  if (data.totalCount === 0) {
    return null
  }

  return <FollowUpSuggestionsWidget suggestions={data.suggestions} totalCount={data.totalCount} />
}

export default async function RepreneurDashboardPage() {
  return (
    <div className="wave-page space-y-5">
      <SectionPageHeader
        title="Dashboard"
        subtitle="Overview of your repreneur pipeline"
        icon={LayoutDashboard}
        tone="repreneur"
        actions={
          <Button asChild>
            <Link href="/portal-preview">
              <Eye data-icon="inline-start" />
              Portal Preview
            </Link>
          </Button>
        }
      />

      {/* Row 1: Stats + Top Tiers - streams in */}
      <Suspense fallback={
        <div className="space-y-4">
          <KpiRailSkeleton />
          <div className="grid gap-4 xl:grid-cols-3">
            <TopRepreneursSkeleton />
            <TopRepreneursSkeleton />
            <TopRepreneursSkeleton />
          </div>
        </div>
      }>
        <StatsAndTiersRow />
      </Suspense>

      {/* Row 2: Funnel + Journey + Activity + Recent - streams in */}
      <Suspense fallback={
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartSkeleton />
            <ChartSkeleton />
            <ActivityStreamSkeleton />
          </div>
          <ChartSkeleton />
        </div>
      }>
        <MiddleRow />
      </Suspense>

      {/* Row 3: Charts - streams in */}
      <Suspense fallback={
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      }>
        <ChartsRow />
      </Suspense>

      {/* Deterministic follow-up recommendations */}
      <Suspense fallback={<ChartSkeleton />}>
        <FollowUpSuggestionsRow />
      </Suspense>

    </div>
  )
}
