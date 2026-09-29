import Link from "next/link"
import { ArrowUpRight, Database, RadioTower } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WaveAiUsageDashboard } from "@/components/wave-ai/usage-dashboard"
import type { WaveAiLedgerSnapshot } from "@/lib/ai/ledger"

export function ProductIntelligenceCockpit({ snapshot }: { snapshot: WaveAiLedgerSnapshot }) {
  return <div className="space-y-5">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><RadioTower className="size-4" aria-hidden="true" />Product journeys</CardTitle>
            <Badge variant="outline">Missing</Badge>
          </div>
          <CardDescription>PostHog is the intended source for adoption, funnels and workflow learning.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p role="status">No current verified PostHog project, saved-query definitions, links or aggregates are bound to this view.</p>
          <p className="text-muted-foreground">This page makes no adoption, conversion, pilot or stakeholder-usage
            claim until the authorized analytics source can be verified.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><Database className="size-4" aria-hidden="true" />AI ledger</CardTitle>
            <Badge variant={snapshot.state === "complete" ? "secondary" : "outline"}>
              {snapshot.state === "complete" ? "Complete read" : "Incomplete"}
            </Badge>
          </div>
          <CardDescription>Supabase metadata-only generation runs and linked events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>One fixed {snapshot.days}-day production, non-test cohort ending {snapshot.asOf}.</p>
          <Link href={`/tools/wave-ai/usage?window=${snapshot.days}`}
            className="inline-flex min-h-9 items-center gap-1 font-medium underline underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Open the ledger view <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </div>

    <WaveAiUsageDashboard snapshot={snapshot} />

    <Card>
      <CardHeader>
        <CardTitle>Next evidence step</CardTitle>
        <CardDescription>A bounded instrumentation proposal, not an adoption conclusion.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Verify authorized PostHog project access, saved-query definitions and capture freshness. Then compare
          the same 7- and 30-day journey cohorts before proposing one measured product change.</p>
        <p className="text-muted-foreground">Route any iteration through
          {" "}<a href="https://github.com/re-new-team/renew-governance/issues/210"
            className="underline underline-offset-4">Decision #210</a> and
          {" "}<a href="https://github.com/re-new-team/renew-governance/issues/29"
            className="underline underline-offset-4">Product Change #29</a>.
          A real pilot review and review owner remain separate evidence.</p>
      </CardContent>
    </Card>
  </div>
}
