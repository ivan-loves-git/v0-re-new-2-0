import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

function formatAge(days: number | null) {
  if (days === null) return "-"
  if (days > 3_650) return "Legacy date"
  return `${formatNumber(days)} days`
}

export function OpportunityFreshnessPanel({ data }: OpportunityFreshnessPanelProps) {
  const staleCount = data.staleTotal
  const visibleReminders = data.staleOpportunities.slice(0, 6)
  const hasStaleOpportunities = staleCount > 0

  return (
    <section aria-labelledby="opportunity-freshness-title">
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-2">
              <CardTitle id="opportunity-freshness-title" className="flex items-center gap-2">
                {hasStaleOpportunities ? <AlertTriangle /> : <CheckCircle2 />}
                Opportunity freshness
              </CardTitle>
              <CardDescription>
                Open opportunities older than {data.staleThresholdDays} days without an active pursuit.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={hasStaleOpportunities ? "border-amber-300 bg-amber-50 text-amber-800" : undefined}>
                <CalendarClock data-icon="inline-start" />
                {formatNumber(staleCount)} stale
              </Badge>
              {data.oldestOpenDays !== null && (
                <Badge variant="secondary">
                  <Clock3 data-icon="inline-start" />
                  Oldest open: {data.oldestOpenDays > 3_650 ? "legacy import" : `${formatNumber(data.oldestOpenDays)} days`}
                </Badge>
              )}
              {data.openWithoutDate > 0 && (
                <Badge variant="outline">{formatNumber(data.openWithoutDate)} open without date</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-4">
          {hasStaleOpportunities ? (
            <>
              <Alert className="border-amber-300 bg-amber-50/70 text-amber-950 [&>svg]:text-amber-700">
                <AlertTriangle className="text-amber-700" />
                <AlertTitle>
                  {formatNumber(staleCount)} {staleCount === 1 ? "opportunity needs" : "opportunities need"} a freshness decision
                </AlertTitle>
                <AlertDescription>
                  Confirm whether to follow up with the source, pause the opportunity, archive it, or move a repreneur into active pursuit.
                </AlertDescription>
              </Alert>

              <div className="overflow-hidden rounded-md border border-border/70">
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
                    {visibleReminders.map((reminder) => (
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
                          {formatAge(reminder.daysOpen)}
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing the {visibleReminders.length} oldest of {formatNumber(staleCount)} stale opportunities.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/opportunities/find">Review opportunity inventory</Link>
                </Button>
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

          <p className="border-t pt-3 text-xs text-muted-foreground">
            June rule: stale means active, paused, or draft opportunity older than {data.staleThresholdDays} days with no active pursuit.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
