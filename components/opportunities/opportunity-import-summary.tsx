import { AlertCircle, CheckCircle2, CircleSlash, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OpportunityImportCommitSummary, OpportunityImportPreview } from "@/lib/actions/opportunity-import"

interface OpportunityImportSummaryProps {
  preview?: OpportunityImportPreview | null
  commitSummary?: OpportunityImportCommitSummary | null
}

export function OpportunityImportSummary({ preview, commitSummary }: OpportunityImportSummaryProps) {
  if (commitSummary) {
    return (
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertTitle>Import committed</AlertTitle>
        <AlertDescription>
          {commitSummary.created} created, {commitSummary.skipped} skipped, {commitSummary.blocked} blocked, {commitSummary.warnings} with warnings.
        </AlertDescription>
      </Alert>
    )
  }

  if (!preview) return null

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4" />
            Valid
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{preview.summary.valid}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TriangleAlert className="size-4" />
            Warnings
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{preview.summary.warnings}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CircleSlash className="size-4" />
            Blocked
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{preview.summary.blocked}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-4" />
            Total
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{preview.summary.total}</CardContent>
      </Card>
    </div>
  )
}
