import { Suspense } from "react"
import { BarChart3 } from "lucide-react"
import { getAnalyticsData } from "@/lib/actions/analytics"
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
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { Skeleton } from "@/components/ui/skeleton"


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
    <div className="space-y-5">
      <KpiCards data={data} period={period} />

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

      <section className="space-y-3" aria-labelledby="portfolio-insight-title">
        <div>
          <h2 id="portfolio-insight-title" className="text-base font-semibold">Portfolio insight</h2>
          <p className="text-sm text-muted-foreground">Profile quality and movement through the repreneur pipeline.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
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
      </section>

      <section className="space-y-3" aria-labelledby="commercial-progression-title">
        <div>
          <h2 id="commercial-progression-title" className="text-base font-semibold">Commercial progression</h2>
          <p className="text-sm text-muted-foreground">Offer performance and readiness across the acquisition journey.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <OfferConversion data={data.offerConversion} />
          <JourneyWaterfall stageDistribution={data.stageDistribution} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="attention-signals-title">
        <div>
          <h2 id="attention-signals-title" className="text-base font-semibold">Attention signals</h2>
          <p className="text-sm text-muted-foreground">Follow-up risks and the reasons commercial paths stop.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <StaleLeads staleLeads={data.staleLeads} />
          <DeclineReasons breakdown={data.declineReasonBreakdown} />
        </div>
      </section>
    </div>
  )
}

export default async function RepreneurAnalyticsPage(
  props: { searchParams: Promise<{ period?: string }> }
) {
  const searchParams = await props.searchParams
  const period = searchParams.period || "all"

  return (
    <div className="wave-page space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionPageHeader
          title="Analytics"
          subtitle="Scores, conversions, and pipeline health"
          icon={BarChart3}
          tone="repreneur"
          className="flex-1"
        />
        <PeriodSelector />
      </div>

      {/* Content */}
      <Suspense
        fallback={
          <div className="space-y-5">
            <KpiSkeleton />
            <div className="grid gap-4 xl:grid-cols-2">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
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
