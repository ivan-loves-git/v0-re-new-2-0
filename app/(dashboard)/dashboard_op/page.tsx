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
  ShieldAlert,
} from "lucide-react"
import { OpportunityFreshnessPanel } from "@/components/dashboard/opportunity-freshness-panel"
import { OpportunityStatusBadge } from "@/components/opportunities/opportunity-status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { KpiMetricGrid, KpiMetricTile } from "@/components/ui/kpi-metric-tile"
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
import { formatOpportunitySourceDate } from "@/lib/utils/opportunity-source-date"


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

async function listActivePursuits(): Promise<{
  rows: ActivePursuitRow[]
  totalCount: number
  ndaBlockedCount: number
}> {
  const supabase = createAdminClient()
  const [rowsResult, countResult, ndaResult] = await Promise.all([
    supabase
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
      .limit(8),
    supabase
      .from("opportunity_matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "active_pursuit"),
    supabase
      .from("opportunity_matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "active_pursuit")
      .in("nda_status", ["required", "sent"]),
  ])

  if (rowsResult.error) throw new Error(rowsResult.error.message)
  if (countResult.error) throw new Error(countResult.error.message)
  if (ndaResult.error) throw new Error(ndaResult.error.message)

  const rows = (rowsResult.data ?? []).map((row) => ({
    ...row,
    opportunity: Array.isArray(row.opportunity) ? row.opportunity[0] ?? null : row.opportunity ?? null,
    repreneur: Array.isArray(row.repreneur) ? row.repreneur[0] ?? null : row.repreneur ?? null,
  })) as ActivePursuitRow[]
  return {
    rows,
    totalCount: countResult.count ?? rows.length,
    ndaBlockedCount: ndaResult.count ?? 0,
  }
}

export default async function OpportunityDashboardPage() {
  await connection()

  const [freshnessData, opportunities, responses, activePursuitSummary] = await Promise.all([
    getOpportunityFreshnessData(),
    listOpportunities(),
    listOpportunityMatchResponses(),
    listActivePursuits(),
  ])

  const pendingResponses = responses.filter((response) => !response.reviewed_at).slice(0, 6)
  const recentOpportunities = opportunities.slice(0, 6)
  const activePursuits = activePursuitSummary.rows
  const openOpportunities = opportunities.filter(
    (opportunity) => !["archived", "closed"].includes(opportunity.status)
  )

  return (
    <div className="wave-page flex flex-col gap-5">
      <SectionPageHeader
        title="Dashboard"
        subtitle="Daily operating view for opportunity follow-up, response review, active pursuits, NDA gates, and stale follow-up."
        icon={LayoutDashboard}
        tone="opportunity"
      />

      <KpiMetricGrid className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <KpiMetricTile title="Open opportunities" value={openOpportunities.length} period="Current inventory" icon={BriefcaseBusiness} tone="opportunity" trend={null} info={{ title: "Open opportunities", description: "Draft, active, and paused opportunities currently available to staff.", why: "Closed and archived records are excluded from this working inventory." }} />
        <KpiMetricTile title="Pending responses" value={responses.filter((response) => !response.reviewed_at).length} period="Waiting for review" icon={Inbox} tone="attention" trend={null} info={{ title: "Pending responses", description: "Repreneur interest or decline responses awaiting staff review.", why: "These decisions unblock the next matching step." }} />
        <KpiMetricTile title="Active pursuits" value={activePursuitSummary.totalCount} period="Validated deal paths" icon={Landmark} tone="repreneur" trend={null} info={{ title: "Active pursuits", description: "All validated one-repreneur deal paths currently in execution.", why: "The count now reflects the full set while the queue below remains intentionally concise." }} />
        <KpiMetricTile title="NDA blocked" value={activePursuitSummary.ndaBlockedCount} period="Document access gated" icon={ShieldAlert} tone={activePursuitSummary.ndaBlockedCount > 0 ? "risk" : "neutral"} trend={null} info={{ title: "NDA blocked", description: "Active pursuits where access still depends on an NDA.", why: "These paths need document follow-up before they can progress." }} />
      </KpiMetricGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox />
              Response review queue
            </CardTitle>
            <CardDescription>Newest repreneur responses that still need a staff decision.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {pendingResponses.length > 0 ? (
              <div className="overflow-hidden">
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
              <Alert className="m-5 w-auto">
                <CheckCircle2 />
                <AlertTitle>No pending responses</AlertTitle>
                <AlertDescription>There are no repreneur responses waiting for staff review.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark />
              Active pursuit queue
            </CardTitle>
            <CardDescription>Validated pursuits, current stage, and NDA state.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {activePursuits.length > 0 ? (
              <div className="overflow-hidden">
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
              <Alert className="m-5 w-auto">
                <AlertTriangle />
                <AlertTitle>No active pursuits</AlertTitle>
                <AlertDescription>Validated pursuit paths will appear here once staff locks a repreneur to an opportunity.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <OpportunityFreshnessPanel data={freshnessData} />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 />
            Latest opportunities
          </CardTitle>
          <CardDescription>Newest opportunities for quick operational follow-up.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {recentOpportunities.length > 0 ? (
            <div className="overflow-hidden">
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
                    <TableCell>{formatOpportunitySourceDate(opportunity.date_added, opportunity.date_added_precision)}</TableCell>
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
          ) : (
            <Alert className="m-5 w-auto">
              <CheckCircle2 />
              <AlertTitle>No opportunities yet</AlertTitle>
              <AlertDescription>New opportunities will appear here once they are added.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
