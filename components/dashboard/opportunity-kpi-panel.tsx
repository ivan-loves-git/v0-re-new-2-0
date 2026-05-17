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
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

function KpiMetricCard({
  title,
  value,
  description,
  icon: Icon,
  badge,
}: {
  title: string
  value: number
  description: string
  icon: LucideIcon
  badge?: string
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(value)}</CardTitle>
          </div>
          <div className="rounded-md border bg-muted p-2 text-muted-foreground">
            <Icon />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        {badge && (
          <div>
            <Badge variant="secondary">{badge}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
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
      description: "M&A firms or brokers linked to active opportunities.",
      icon: Building2,
    },
    {
      title: "Active opportunities",
      value: data.activeOpportunities,
      description: "Live opportunities available in the internal deal-flow base.",
      icon: BriefcaseBusiness,
      badge: `${formatNumber(data.totalOpenOpportunities)} open total`,
    },
    {
      title: "Introductions",
      value: data.introductions,
      description: "Opportunities proposed to repreneurs or already answered.",
      icon: Handshake,
      badge: `${formatNumber(data.pendingReviews)} pending review`,
    },
    {
      title: "Active pursuits",
      value: data.activePursuits,
      description: "Validated one-repreneur pursuit paths currently locked.",
      icon: Landmark,
      badge: `${formatNumber(data.ndaBlockedPursuits)} NDA blocked`,
    },
    {
      title: "Seller meetings",
      value: data.sellerMeetings,
      description: "Pursuits currently tracked at seller-meeting stage.",
      icon: BadgeCheck,
    },
    {
      title: "LOIs",
      value: data.lois,
      description: "Pursuits currently tracked at LOI stage.",
      icon: FileSignature,
    },
    {
      title: "Dropped deals",
      value: data.droppedDeals,
      description: "Pursuits dropped after validation.",
      icon: XCircle,
    },
    {
      title: "Closed deals",
      value: data.closedDeals,
      description: "Pursuits marked closed in the June workflow.",
      icon: Trophy,
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <KpiMetricCard key={card.title} {...card} />
        ))}
      </div>

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
