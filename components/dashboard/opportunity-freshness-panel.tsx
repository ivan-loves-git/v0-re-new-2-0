import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OpportunityStatusBadge } from "@/components/opportunities/opportunity-status-badge"
import type { OpportunityFreshnessData } from "@/lib/actions/opportunity-freshness"

interface OpportunityFreshnessPanelProps {
  data: OpportunityFreshnessData
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function titleForReminder(reminder: OpportunityFreshnessData["staleOpportunities"][number]) {
  return reminder.publicTitle || reminder.sector || reminder.reference
}

export function OpportunityFreshnessPanel({ data }: OpportunityFreshnessPanelProps) {
  const staleCount = data.staleOpportunities.length
  const hasStaleOpportunities = staleCount > 0

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-normal">Opportunity freshness</h2>
          <p className="text-sm text-muted-foreground">
            Internal reminder for open opportunities older than {data.staleThresholdDays} days without active pursuit.
          </p>
        </div>
        <Badge variant={hasStaleOpportunities ? "destructive" : "outline"}>
          <CalendarClock data-icon="inline-start" />
          {formatNumber(staleCount)} stale
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {hasStaleOpportunities ? <AlertTriangle /> : <CheckCircle2 />}
                Stale opportunity follow-up
              </CardTitle>
              <CardDescription>
                A lightweight staff check, not automated CRM outreach.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.oldestOpenDays !== null && (
                <Badge variant="secondary">
                  <Clock3 data-icon="inline-start" />
                  Oldest open: {formatNumber(data.oldestOpenDays)} days
                </Badge>
              )}
              {data.openWithoutDate > 0 && (
                <Badge variant="outline">{formatNumber(data.openWithoutDate)} open without date</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasStaleOpportunities ? (
            <>
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>{formatNumber(staleCount)} opportunity needs a freshness decision</AlertTitle>
                <AlertDescription>
                  Confirm whether to follow up with the source, pause the opportunity, archive it, or move a repreneur into active pursuit.
                </AlertDescription>
              </Alert>

              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Age</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.staleOpportunities.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell className="min-w-[220px] whitespace-normal">
                          <Link href={`/opportunities/${reminder.id}`} className="font-medium hover:underline">
                            {titleForReminder(reminder)}
                          </Link>
                          <p className="text-xs text-muted-foreground">{reminder.reference}</p>
                        </TableCell>
                        <TableCell className="whitespace-normal">{reminder.sourceLabel ?? "No source"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{reminder.exactDateAdded ?? "No date"}</span>
                            <span className="text-xs text-muted-foreground">
                              Month: {reminder.monthAdded ?? "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {reminder.daysOpen !== null ? `${formatNumber(reminder.daysOpen)} days` : "-"}
                        </TableCell>
                        <TableCell>
                          <OpportunityStatusBadge status={reminder.status} />
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="icon" className="size-8">
                            <Link href={`/opportunities/${reminder.id}`} aria-label={`Open ${reminder.reference}`}>
                              <ArrowRight />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>No stale opportunities found</AlertTitle>
              <AlertDescription>
                Every dated open opportunity is under the threshold or already has an active pursuit.
              </AlertDescription>
            </Alert>
          )}

          <Separator />
          <p className="text-xs text-muted-foreground">
            June rule: stale means active, paused, or draft opportunity older than {data.staleThresholdDays} days with no active pursuit.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
