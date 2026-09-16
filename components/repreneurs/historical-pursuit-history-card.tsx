import { History } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listStaffHistoricalPursuitImportRows, type StaffHistoricalPursuitImportRow } from "@/lib/data/historical-pursuit-import"

const STAGE_LABELS: Record<string, string> = {
  interest_confirmed: "Interest confirmed",
  nda_received: "NDA received",
  nda_signed: "NDA signed",
  info_memo_received: "Information memorandum received",
  qa_with_ma_firm: "Q&A with M&A firm",
  seller_meeting: "Seller meeting",
  valuation: "Valuation",
  loi_issued: "LOI issued",
  audits: "Audits",
  financing: "Financing",
  closing: "Closing",
  none: "No stage recorded",
}

function stageLabel(stage: string) {
  return STAGE_LABELS[stage] ?? stage.replaceAll("_", " ")
}

function statusLabel(row: StaffHistoricalPursuitImportRow) {
  if (row.clarificationOutcome === "confidential_history") return "Confidential history only"
  if (row.clarificationOutcome === "external_history" || row.clarificationOutcome === "closed_history") return "Confirmed history only"
  if (row.appliedOutcome === "external_or_missing") return "Review needed"
  if (row.sourceVersion === "V4") return row.sourceTerminal ? "Reported dropped" : "Reported active"
  if (row.sourceTerminal) return "Historical drop"
  return "Historical record"
}

function statusVariant(row: StaffHistoricalPursuitImportRow): "outline" | "secondary" | "destructive" {
  if (row.appliedOutcome === "external_or_missing") return "secondary"
  if (row.sourceTerminal) return "destructive"
  return "outline"
}

function reviewMessage(row: StaffHistoricalPursuitImportRow) {
  if (row.clarificationOutcome === "confidential_history") return "Confirmed staff-only history. Not published in Deal Flow and not an External Pursuit dossier."
  if (row.clarificationOutcome === "closed_history") return "Confirmed closed legacy deal; retained without a WAVE link."
  if (row.clarificationOutcome === "external_history") return "Confirmed external deal; retained as history without a WAVE link."
  if (row.clarificationOutcome === "reopened") return "Confirmed ongoing. Reopened through the audited workflow to Interested; reported milestones do not grant access."
  if (row.clarificationOutcome === "linked_history") return "Reference clarified and historical relationship linked. Reported milestones remain separate from validated WAVE progress."
  if (row.reviewFlags.includes("source_active_current_dropped")) return "V4 reports active; WAVE remains Dropped. Staff review is needed before reopening."
  if (row.reviewFlags.includes("existing_draft_workflow_preserved")) return "Existing WAVE activity is preserved; the workbook has not changed this match status."
  if (row.reviewFlags.includes("opportunity_not_active")) return "The opportunity is archived or inactive. No new relationship was created."
  if (row.appliedOutcome === "external_or_missing") {
    return "This historic proposal is kept for reference but is not linked to a WAVE opportunity."
  }
  if (row.reviewFlags.includes("reason_without_terminal_marker")) {
    return "The source includes a reason, but does not mark the pursuit as closed."
  }
  if (row.reviewFlags.includes("missing_reason")) {
    return "The source marks this pursuit as closed without a recorded reason."
  }
  return null
}

export function HistoricalPursuitHistoryTable({ rows }: { rows: StaffHistoricalPursuitImportRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Opportunity</TableHead><TableHead>Reported reached stage</TableHead>
          <TableHead>Reported outcome</TableHead><TableHead>Drop reason / review</TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map((row) => {
          const review = reviewMessage(row)
          return <TableRow key={row.sourceKey}>
            <TableCell className="min-w-52">
              <div className="font-medium">{row.opportunityReference || row.offerLabel || "Unidentified opportunity"}</div>
              {row.resolvedReference && row.resolvedReference !== row.opportunityReference ? <div className="text-xs text-muted-foreground">Confirmed WAVE reference: {row.resolvedReference}</div> : null}
              <div className="text-xs text-muted-foreground">Pursuit {row.sourceVersion}{row.sourceVersion === "V4" ? " · 14 Sep 2026" : " · earlier source"}</div>
              {row.opportunityReference && row.offerLabel ? <div className="text-xs text-muted-foreground">{row.offerLabel}</div> : null}
            </TableCell>
            <TableCell className="min-w-64 text-sm text-muted-foreground">{completedStages(row)}</TableCell>
            <TableCell><Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge></TableCell>
            <TableCell className="min-w-64 space-y-1 text-sm text-muted-foreground">
              <p>{row.rawDropReason || (row.sourceTerminal ? "No reason recorded" : "No drop reported")}</p>
              {review ? <p className="font-medium text-foreground">{review}</p> : null}
            </TableCell>
          </TableRow>
        })}</TableBody>
      </Table>
    </div>
  )
}

function completedStages(row: StaffHistoricalPursuitImportRow) {
  if (row.completedStages.length === 0) return "No stage recorded"
  return row.completedStages.map(stageLabel).join(" → ")
}

export function HistoricalPursuitHistoryLoading() {
  return (
    <Card aria-label="Loading historical pursuit history">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  )
}

/**
 * This server component is rendered only inside the staff dashboard. It reads
 * the deliberately narrow staff projection, never the workbook source cells.
 */
export async function HistoricalPursuitHistoryCard({ repreneurId }: { repreneurId: string }) {
  let rows: StaffHistoricalPursuitImportRow[]
  try {
    rows = await listStaffHistoricalPursuitImportRows(repreneurId)
  } catch {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" />
            Historical deal proposals
          </CardTitle>
          <CardDescription>Imported history from the previous pursuit tracker.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <History />
            <AlertTitle>Historical deal history is not available</AlertTitle>
            <AlertDescription>
              The staff-only historical record could not be loaded. Existing opportunity matches are unaffected.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) return null
  const currentRows = rows.filter((row) => row.sourceVersion === "V4")
  const olderRows = rows.filter((row) => row.sourceVersion !== "V4")

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <History className="size-5" />
          Reported pursuit history
        </CardTitle>
        <CardDescription>
          Source-reported milestones, separate from validated WAVE pursuit stages. Dates are unknown and these entries do not create current NDA, document, or portal access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentRows.length ? <HistoricalPursuitHistoryTable rows={currentRows} /> : null}
        {olderRows.length ? (
          currentRows.length ? <details className="mt-4 rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Earlier tracker history ({olderRows.length})</summary>
            <div className="mt-3"><HistoricalPursuitHistoryTable rows={olderRows} /></div>
          </details> : <HistoricalPursuitHistoryTable rows={olderRows} />
        ) : null}
      </CardContent>
    </Card>
  )
}
