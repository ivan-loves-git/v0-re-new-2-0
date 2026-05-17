import { Suspense } from "react"
import { getAnalyticsData, type AnalyticsData } from "@/lib/actions/analytics"
import { KpiCards } from "@/components/analytics/kpi-cards"
import { OperationalKpis } from "@/components/analytics/operational-kpis"
import { ScoreDistribution } from "@/components/analytics/score-distribution"
import { ConversionFunnelAnalytics } from "@/components/analytics/conversion-funnel"
import { JourneyWaterfall } from "@/components/analytics/journey-waterfall"
import { StaleLeads } from "@/components/analytics/stale-leads"
import { DeclineReasons } from "@/components/analytics/decline-reasons"
import { OfferConversion } from "@/components/analytics/offer-conversion"
import { PeriodSelector } from "@/components/analytics/period-selector"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const revalidate = 60

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[260px] w-full" />
      </CardContent>
    </Card>
  )
}

function ListSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

async function AnalyticsContent({ period }: { period: string }) {
  const data = await getAnalyticsData(period)

  return (
    <>
      {/* Row 1: KPI Cards */}
      <KpiCards data={data} period={period} />

      {/* Row 1.5: Operational KPIs */}
      <OperationalKpis data={{
        timeToFirstMeeting: data.timeToFirstMeeting,
        timeToQualification: data.timeToQualification,
        firstMeetingBookingRate: data.firstMeetingBookingRate,
        offerSubmissionRate: data.offerSubmissionRate,
        dropOffByStage: data.dropOffByStage,
        interviewsHeld: data.interviewsHeld,
        noShowRate: data.noShowRate,
        meetingToOfferRatio: data.meetingToOfferRatio,
        accuracyStats: data.accuracyStats,
      }} />

      {/* Row 2: Score Distribution + Conversion Funnel */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreDistribution
          whoDistribution={data.whoDistribution}
          whenDistribution={data.whenDistribution}
        />
        <ConversionFunnelAnalytics
          leadCount={data.leadCount}
          qualifiedCount={data.qualifiedCount}
          clientCount={data.clientCount}
          leadToQualifiedRate={data.leadToQualifiedRate}
          qualifiedToClientRate={data.qualifiedToClientRate}
          leadToClientRate={data.leadToClientRate}
        />
      </div>

      {/* Row 3: Offer Conversion + Journey Stages */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OfferConversion data={data.offerConversion} />
        <JourneyWaterfall stageDistribution={data.stageDistribution} />
      </div>

      {/* Row 4: Stale Leads + Decline Reasons */}
      <div className="grid gap-6 lg:grid-cols-2">
        <StaleLeads staleLeads={data.staleLeads} />
        <DeclineReasons breakdown={data.declineReasonBreakdown} />
      </div>
    </>
  )
}

export default async function RepreneurAnalyticsPage(
  props: { searchParams: Promise<{ period?: string }> }
) {
  const searchParams = await props.searchParams
  const period = searchParams.period || "all"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Analytics || Repreneurs</h1>
          <p className="text-gray-600 mt-1">Scores, conversions, and pipeline health</p>
        </div>
        <PeriodSelector />
      </div>

      {/* Content */}
      <Suspense
        fallback={
          <div className="space-y-6">
            <KpiSkeleton />
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartSkeleton />
              <ListSkeleton />
            </div>
          </div>
        }
      >
        <AnalyticsContent period={period} />
      </Suspense>
    </div>
  )
}
