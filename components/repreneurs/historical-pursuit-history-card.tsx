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
  if (row.appliedOutcome === "external_or_missing") return "Review needed"
  if (row.sourceTerminal) return "Historical drop"
  return "Historical record"
}

function statusVariant(row: StaffHistoricalPursuitImportRow): "outline" | "secondary" | "destructive" {
  if (row.appliedOutcome === "external_or_missing") return "secondary"
  if (row.sourceTerminal) return "destructive"
  return "outline"
}

function reviewMessage(row: StaffHistoricalPursuitImportRow) {
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <History className="size-5" />
          Historical deal proposals
        </CardTitle>
        <CardDescription>
          Previous pursuit tracker only. Dates are unknown and these entries do not create current NDA, document, or portal access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Reached stage</TableHead>
                <TableHead>Historical outcome</TableHead>
                <TableHead>Drop reason / review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const review = reviewMessage(row)
                return (
                  <TableRow key={row.sourceRow}>
                    <TableCell className="min-w-52">
                      <div className="font-medium">{row.opportunityReference || row.offerLabel || "Unidentified opportunity"}</div>
                      {row.opportunityReference && row.offerLabel ? (
                        <div className="text-xs text-muted-foreground">{row.offerLabel}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-64 text-sm text-muted-foreground">
                      {completedStages(row)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge>
                    </TableCell>
                    <TableCell className="min-w-64 text-sm text-muted-foreground">
                      {row.rawDropReason || review || "No reason recorded"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
