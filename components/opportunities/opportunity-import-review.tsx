import Link from "next/link"
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OpportunityImportSummary } from "@/components/opportunities/opportunity-import-summary"
import type { MaCutoverRehearsal } from "@/lib/types/ma-cutover"

interface OpportunityImportReviewProps {
  rehearsal: MaCutoverRehearsal
}

export function OpportunityImportReview({
  rehearsal,
}: OpportunityImportReviewProps) {
  const opportunityIssues = rehearsal.issues.filter((issue) =>
    issue.rowKey.startsWith("opportunity:"),
  )

  return (
    <div className="space-y-6">
      <SectionPageHeader
        title="Opportunity cutover rehearsal"
        subtitle="A safe, staff-only check of the rules required before the one-time WAVE switch"
        icon={Sparkles}
        tone="opportunity"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/opportunities/find">
              <ArrowLeft className="size-4" />
              Back to opportunities
            </Link>
          </Button>
        }
      />

      <Alert>
        <LockKeyhole className="size-4" />
        <AlertTitle>Real cutover input is not enabled</AlertTitle>
        <AlertDescription>
          This page accepts neither files nor pasted rows. It cannot stage,
          activate, create, or update opportunities. Bertrand’s workbook stays
          authoritative until Ivan approves the production switch.
        </AlertDescription>
      </Alert>

      <OpportunityImportSummary rehearsal={rehearsal} />

      <Card>
        <CardHeader>
          <CardTitle>What the rehearsal proves</CardTitle>
          <CardDescription>
            Fixed synthetic rows exercise the cutover rules without retaining
            a workbook identifier or writing to the production domain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>The valid fixture keeps two selected contacts; every selected contact belongs to its operating office and the primary is one of them.</li>
            <li>Duplicate references, missing descriptions or offices, and invalid primary contacts block activation.</li>
            <li>Geography remains an explicit confirmed, review, or null decision; WAVE does not infer it.</li>
            <li>Missing financial values and dates may remain null; invalid supplied values block activation until corrected.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fixture exceptions</CardTitle>
          <CardDescription>
            The list is deterministic and intentionally includes examples that
            a real, approved staging run must resolve before activation.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-hidden border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fixture row</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunityIssues.map((issue) => (
                  <TableRow key={`${issue.rowKey}-${issue.code}`}>
                    <TableCell className="font-medium">
                      {issue.rowKey.replace("opportunity:", "")}
                    </TableCell>
                    <TableCell>{issue.message}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          issue.severity === "blocker"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {issue.severity === "blocker" ? "Blocks activation" : "Review"}
                      </Badge>
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
