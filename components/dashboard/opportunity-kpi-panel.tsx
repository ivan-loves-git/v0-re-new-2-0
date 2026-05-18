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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { OpportunityKpiData, OpportunityKpiStageRow } from "@/lib/actions/opportunity-analytics"

interface OpportunityKpiPanelProps {
  data: OpportunityKpiData
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function stageTone(stage: OpportunityKpiStageRow["stage"]): "default" | "destructive" | "secondary" | "outline" {
  if (stage === "closed") return "default"
  if (stage === "dropped") return "destructive"
  if (stage === "loi") return "secondary"
  return "outline"
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-normal">Deal-flow operating view</h2>
          <p className="text-sm text-muted-foreground">
            Internal June KPIs from opportunities, repreneur introductions, pursuit stages, NDA status, and documents.
          </p>
        </div>
        <Badge variant="outline">
          <ShieldAlert data-icon="inline-start" />
          Staff only
        </Badge>
      </div>

      <KpiMetricGrid>
        {metricCards.map((card) => (
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

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList />
              Deal-flow conversion
            </CardTitle>
            <CardDescription>Basic signal quality from introduction to pursuit and close.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current pursuit stages</CardTitle>
            <CardDescription>Where validated deal paths sit today.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stageRows.map((row) => (
                  <TableRow key={row.stage}>
                    <TableCell>
                      <Badge variant={stageTone(row.stage)}>{row.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(row.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
