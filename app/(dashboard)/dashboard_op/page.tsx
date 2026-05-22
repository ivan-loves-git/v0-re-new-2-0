import Link from "next/link"
import { connection } from "next/server"
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileCheck2,
  Inbox,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  ShieldAlert,
} from "lucide-react"
import { OpportunityFreshnessPanel } from "@/components/dashboard/opportunity-freshness-panel"
import { OpportunityStatusBadge } from "@/components/opportunities/opportunity-status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getOpportunityFreshnessData } from "@/lib/actions/opportunity-freshness"
import { listOpportunityMatchResponses } from "@/lib/actions/opportunity-matches"
import { listOpportunities } from "@/lib/actions/opportunities"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getOpportunityMatchStatusLabel,
  getOpportunityNdaStatusLabel,
  getOpportunityPursuitStageLabel,
  type OpportunityMatchResponse,
  type OpportunityNdaStatus,
  type OpportunityPursuitStage,
} from "@/lib/types/opportunity"


interface ActivePursuitRow {
  id: string
  opportunity_id: string
  repreneur_id: string
  pursuit_stage: OpportunityPursuitStage | null
  nda_status: OpportunityNdaStatus | null
  updated_at: string
  opportunity?: {
    id: string
    reference: string
    public_title: string | null
    sector: string | null
    location: string | null
  } | null
  repreneur?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function opportunityTitle(row: { reference: string; public_title?: string | null; sector?: string | null }) {
  return row.public_title || row.sector || row.reference
}

function responseOpportunityTitle(response: OpportunityMatchResponse) {
  const opportunity = response.opportunity
  if (!opportunity) return "Unknown opportunity"
  return opportunity.public_title || opportunity.sector || opportunity.reference
}

function repreneurName(row: { first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined) {
  if (!row) return "Unknown repreneur"
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "Unknown repreneur"
}

async function listActivePursuits(): Promise<ActivePursuitRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      repreneur_id,
      pursuit_stage,
      nda_status,
      updated_at,
      opportunity:opportunities(id, reference, public_title, sector, location),
      repreneur:repreneurs(id, first_name, last_name, email)
    `)
    .eq("status", "active_pursuit")
    .order("updated_at", { ascending: false })
    .limit(8)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...row,
    opportunity: Array.isArray(row.opportunity) ? row.opportunity[0] ?? null : row.opportunity ?? null,
    repreneur: Array.isArray(row.repreneur) ? row.repreneur[0] ?? null : row.repreneur ?? null,
  })) as ActivePursuitRow[]
}

function OperationalStatCard({
  title,
  value,
  description,
  icon: Icon,
  href,
}: {
  title: string
  value: number
  description: string
  icon: LucideIcon
  href: string
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="text-2xl">{value}</CardTitle>
          </div>
          <div className="rounded-md border bg-muted p-2 text-muted-foreground">
            <Icon />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={href}>
            Open
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default async function OpportunityDashboardPage() {
  await connection()

  const [freshnessData, opportunities, responses, activePursuits] = await Promise.all([
    getOpportunityFreshnessData(),
    listOpportunities(),
    listOpportunityMatchResponses(),
    listActivePursuits(),
  ])

  const pendingResponses = responses.filter((response) => !response.reviewed_at).slice(0, 6)
  const recentOpportunities = opportunities.slice(0, 6)
  const ndaBlockedPursuits = activePursuits.filter((pursuit) => ["required", "sent"].includes(pursuit.nda_status ?? ""))

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Dashboard"
        subtitle="Daily operating view for opportunity follow-up, response review, active pursuits, NDA gates, and stale follow-up."
        icon={LayoutDashboard}
        tone="opportunity"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OperationalStatCard
          title="Latest opportunities"
          value={recentOpportunities.length}
          description="Newest opportunities needing staff hygiene and follow-up."
          icon={BriefcaseBusiness}
          href="/opportunities/find"
        />
        <OperationalStatCard
          title="Pending responses"
          value={pendingResponses.length}
          description="Repreneur interest or not-a-fit responses waiting for staff review."
          icon={Inbox}
          href="/opportunities/reviews"
        />
        <OperationalStatCard
          title="Active pursuits"
          value={activePursuits.length}
          description="Validated one-repreneur deal paths currently locked for execution."
          icon={Landmark}
          href="/opportunities/groups"
        />
        <OperationalStatCard
          title="NDA blocked"
          value={ndaBlockedPursuits.length}
          description="Active pursuits where document access still depends on NDA progress."
          icon={ShieldAlert}
          href="/opportunities/groups"
        />
      </div>

      <OpportunityFreshnessPanel data={freshnessData} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox />
              Response review queue
            </CardTitle>
            <CardDescription>Newest repreneur responses that still need a staff decision.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingResponses.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingResponses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={`/opportunities/${response.opportunity_id}`} className="font-medium hover:underline">
                            {responseOpportunityTitle(response)}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {response.opportunity?.reference ?? "-"} · {response.repreneur?.email ?? "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={response.status === "interested" ? "default" : "secondary"}>
                            {getOpportunityMatchStatusLabel(response.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="icon" className="size-8">
                            <Link href="/opportunities/reviews" aria-label="Open response reviews">
                              <ArrowRight />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <CheckCircle2 />
                <AlertTitle>No pending responses</AlertTitle>
                <AlertDescription>There are no repreneur responses waiting for staff review.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark />
              Active pursuit queue
            </CardTitle>
            <CardDescription>Validated pursuits, current stage, and NDA state.</CardDescription>
          </CardHeader>
          <CardContent>
            {activePursuits.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pursuit</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>NDA</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePursuits.map((pursuit) => (
                      <TableRow key={pursuit.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={`/opportunities/${pursuit.opportunity_id}`} className="font-medium hover:underline">
                            {pursuit.opportunity ? opportunityTitle(pursuit.opportunity) : "Unknown opportunity"}
                          </Link>
                          <p className="text-xs text-muted-foreground">{repreneurName(pursuit.repreneur)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {pursuit.pursuit_stage ? getOpportunityPursuitStageLabel(pursuit.pursuit_stage) : "No stage"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={["required", "sent"].includes(pursuit.nda_status ?? "") ? "destructive" : "secondary"}>
                            {pursuit.nda_status ? getOpportunityNdaStatusLabel(pursuit.nda_status) : "No status"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="icon" className="size-8">
                            <Link href={`/opportunities/${pursuit.opportunity_id}`} aria-label="Open active pursuit">
                              <ArrowRight />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <AlertTriangle />
                <AlertTitle>No active pursuits</AlertTitle>
                <AlertDescription>Validated pursuit paths will appear here once staff locks a repreneur to an opportunity.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 />
            Latest opportunities
          </CardTitle>
          <CardDescription>Newest opportunities for quick operational follow-up.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOpportunities.map((opportunity) => (
                  <TableRow key={opportunity.id}>
                    <TableCell className="whitespace-normal">
                      <Link href={`/opportunities/${opportunity.id}`} className="font-medium hover:underline">
                        {opportunityTitle(opportunity)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{opportunity.reference}</p>
                    </TableCell>
                    <TableCell>{opportunity.location ?? "-"}</TableCell>
                    <TableCell>{formatDate(opportunity.date_added)}</TableCell>
                    <TableCell>
                      <OpportunityStatusBadge status={opportunity.status} />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon" className="size-8">
                        <Link href={`/opportunities/${opportunity.id}`} aria-label={`Open ${opportunity.reference}`}>
                          <ArrowRight />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
