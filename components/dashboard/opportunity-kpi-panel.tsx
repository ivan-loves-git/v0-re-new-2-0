import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  FileCheck2,
  FileSignature,
  Handshake,
  Landmark,
  ShieldAlert,
  Trophy,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiMetricGrid, KpiMetricTile } from "@/components/ui/kpi-metric-tile"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { WaveBarChart } from "@/components/wave/charts"
import { CardInfoButton } from "@/components/dashboard/card-info-button"
import type { OpportunityKpiData } from "@/lib/actions/opportunity-analytics"

interface OpportunityKpiPanelProps {
  data: OpportunityKpiData
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

export function OpportunityKpiPanel({ data }: OpportunityKpiPanelProps) {
  const metricCards = [
    {
      title: "Active intermediaries",
      value: data.activeIntermediaries,
      period: "Current count",
      icon: Building2,
      tone: "opportunity" as const,
      info: {
        title: "Active intermediaries",
        description: "M&A firms or brokers linked to active opportunities.",
        why: "Shows whether the opportunity source base is active enough.",
      },
    },
    {
      title: "Active opportunities",
      value: data.activeOpportunities,
      period: `${formatNumber(data.totalOpenOpportunities)} open total`,
      icon: BriefcaseBusiness,
      tone: "opportunity" as const,
      info: {
        title: "Active opportunities",
        description: "Live opportunities available in the internal deal-flow base.",
        why: "Shows the current quantity of usable deal-flow.",
      },
    },
    {
      title: "Introductions",
      value: data.introductions,
      period: `${formatNumber(data.pendingReviews)} pending review`,
      icon: Handshake,
      tone: "opportunity" as const,
      info: {
        title: "Introductions",
        description: "Opportunities proposed to repreneurs or already answered.",
        why: "Measures how much deal-flow has reached repreneurs.",
      },
    },
    {
      title: "Active pursuits",
      value: data.activePursuits,
      period: `${formatNumber(data.ndaBlockedPursuits)} NDA blocked`,
      icon: Landmark,
      tone: "opportunity" as const,
      info: {
        title: "Active pursuits",
        description: "Validated one-repreneur pursuit paths currently locked.",
        why: "Shows where the team is actively moving an opportunity forward with a repreneur.",
      },
    },
    {
      title: "Seller meetings",
      value: data.sellerMeetings,
      period: "Current stage",
      icon: BadgeCheck,
      tone: "opportunity" as const,
      info: {
        title: "Seller meetings",
        description: "Pursuits currently tracked at seller-meeting stage.",
        why: "Shows how many active pursuits reached direct seller interaction.",
      },
    },
    {
      title: "LOIs",
      value: data.lois,
      period: "Current stage",
      icon: FileSignature,
      tone: "opportunity" as const,
      info: {
        title: "LOIs",
        description: "Pursuits currently tracked at LOI stage.",
        why: "Tracks how many deal paths reached formal intent.",
      },
    },
    {
      title: "Dropped deals",
      value: data.droppedDeals,
      period: "After validation",
      icon: XCircle,
      tone: "risk" as const,
      info: {
        title: "Dropped deals",
        description: "Pursuits dropped after validation.",
        why: "Highlights deal paths that did not continue and may need pattern review.",
      },
    },
    {
      title: "Closed deals",
      value: data.closedDeals,
      period: "June workflow",
      icon: Trophy,
      tone: "repreneur" as const,
      info: {
        title: "Closed deals",
        description: "Pursuits marked closed in the June workflow.",
        why: "Tracks completed acquisition outcomes.",
      },
    },
  ]

  const headlineCards = metricCards.slice(0, 4)
  const outcomeCards = metricCards.slice(4)

  return (
    <section className="flex flex-col gap-5">
      <KpiMetricGrid className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {headlineCards.map((card) => (
          <KpiMetricTile
            key={card.title}
            title={card.title}
            value={formatNumber(card.value)}
            period={card.period}
            icon={card.icon}
            tone={card.tone}
            info={card.info}
          />
        ))}
      </KpiMetricGrid>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList />
              Deal-flow conversion
            </CardTitle>
            <CardDescription>Basic signal quality from introduction to pursuit and close.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 py-4">
            {data.funnelRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(row.numerator)} of {formatNumber(row.denominator)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{row.percent}%</span>
                </div>
                <Progress value={row.percent} />
              </div>
            ))}
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <FileCheck2 data-icon="inline-start" />
                {formatNumber(data.approvedDocuments)} approved documents
              </Badge>
              <Badge variant={data.ndaBlockedPursuits > 0 ? "destructive" : "outline"}>
                <ShieldAlert data-icon="inline-start" />
                {formatNumber(data.ndaBlockedPursuits)} NDA blocked pursuits
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Current pursuit stages</CardTitle>
            <CardDescription>Where validated deal paths sit today.</CardDescription>
          </CardHeader>
          <CardContent className="py-4">
            <WaveBarChart
              data={data.stageRows}
              label="Current pursuit stages"
              xKey="label"
              series={[{ key: "count", label: "Pursuits", color: "var(--chart-2)" }]}
              className="h-[250px]"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle>Execution outcomes</CardTitle>
          <CardDescription>Seller meetings, LOIs, dropped paths, and completed acquisitions.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 xl:divide-x">
            {outcomeCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="flex min-h-24 items-center gap-3 border-b px-5 py-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted/50 text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-sm font-medium">{card.title}</p>
                      <CardInfoButton info={card.info} />
                    </div>
                    <p className="text-xs text-muted-foreground">{card.period}</p>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{formatNumber(card.value)}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
