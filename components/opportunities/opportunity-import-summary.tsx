import { CircleAlert, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MaCutoverRehearsal } from "@/lib/types/ma-cutover"

interface OpportunityImportSummaryProps {
  rehearsal: MaCutoverRehearsal
}

export function OpportunityImportSummary({
  rehearsal,
}: OpportunityImportSummaryProps) {
  const { summary } = rehearsal

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" />
          Deterministic synthetic reconciliation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-muted-foreground">Synthetic opportunity rows</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {summary.sourceRows.opportunities}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ready in the fixture</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {summary.opportunityRows.readyForActivation}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reconciled contact links</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {summary.resolvedMappings.opportunityContactLinks}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Blockers surfaced</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {summary.issues.blockers}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Warnings surfaced</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {summary.issues.warnings}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex items-start gap-2 border-t pt-4 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Reconciliation is a rehearsal only. It uses a fixed in-repository
            fixture, does not accept an external file or pasted data, and does
            not create or update any WAVE record.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
