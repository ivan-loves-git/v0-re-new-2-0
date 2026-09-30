import { AlertCircle, CheckCircle2, Clock3, DollarSign, Gauge, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { WaveAiLedgerSnapshot } from "@/lib/ai/ledger"

const INTEGER = new Intl.NumberFormat("en-GB")
const featureLabels: Record<string, string> = {
  email_draft: "Email drafts",
  next_action: "Next actions",
  match_review: "Match review",
  pdr_screening: "PDR screening",
}

function percent(value: number | null) {
  return value === null ? "N/A"
    : new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(value)
}

function money(value: number) {
  return new Intl.NumberFormat("en", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 8,
  }).format(value)
}

function duration(value: number | null) {
  if (value === null) return "N/A"
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`
}

function timestamp(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" })
      .format(new Date(value))
    : "No recorded activity in this window"
}

const incompleteCopy: Record<Extract<WaveAiLedgerSnapshot, { state: "incomplete" }>["reason"], string> = {
  read_failed: "A ledger read failed.",
  count_unavailable: "The ledger did not return an exact row count.",
  row_cap: "The bounded read limit was reached.",
  page_changed: "Ledger rows changed or a page was incomplete during the read.",
  invalid_row: "A returned row did not match the production cohort.",
}

export function WaveAiUsageDashboard({ snapshot }: { snapshot: WaveAiLedgerSnapshot }) {
  const capture = <p className="text-xs text-muted-foreground">
    Supabase AI metadata ledger, {snapshot.days}-day window from {timestamp(snapshot.windowStart)}
    {" "}through {timestamp(snapshot.asOf)}. Captured as of {snapshot.asOf}.
  </p>

  if (snapshot.state === "incomplete") {
    return <Card>
      <CardHeader>
        <CardTitle>WAVE AI ledger: Incomplete</CardTitle>
        <CardDescription>Partial totals are withheld.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p role="status" className="text-sm">{incompleteCopy[snapshot.reason]} Retry the read before interpreting usage.</p>
        {capture}
      </CardContent>
    </Card>
  }

  const metrics = snapshot.metrics
  const summary = [
    { label: "Recorded runs", value: INTEGER.format(metrics.attempts), icon: Sparkles },
    { label: "Success / completed", value: percent(metrics.successRate), icon: CheckCircle2 },
    { label: "Recorded follow-through", value: `${metrics.recordedFollowThrough} (${percent(metrics.followThroughRate)})`, icon: Gauge },
    { label: "Recorded USD estimate", value: money(metrics.totalCostUsd), icon: DollarSign },
    { label: "Pending runs", value: INTEGER.format(metrics.pending), icon: Clock3 },
    { label: "Median / p95 latency", value: `${duration(metrics.medianLatencyMs)} / ${duration(metrics.p95LatencyMs)}`, icon: Clock3 },
  ]
  const outcomeEvents = [
    { label: "Copied drafts", value: metrics.eventCounts.copied ?? 0 },
    { label: "Successful sends", value: metrics.eventCounts.send_succeeded ?? 0 },
    { label: "Confirmed actions", value: metrics.eventCounts.workflow_action_confirmed ?? 0 },
  ]
  const feedbackEvents = [
    { label: "Helpful votes recorded", value: metrics.recordedHelpfulFeedback },
    { label: "Not helpful votes recorded", value: metrics.recordedUnhelpfulFeedback },
    { label: "Edits started", value: metrics.eventCounts.edit_started ?? 0 },
  ]

  return <div className="space-y-4">
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>WAVE AI ledger: last {snapshot.days} days</CardTitle>
        <CardDescription>
          Production, non-test runs and their same-window linked events. Follow-through means a recorded copy,
          successful send or confirmed existing action; it does not measure business value.
        </CardDescription>
        {capture}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-3">
          {summary.map((metric) => <div key={metric.label}
            className="flex min-h-24 items-start gap-3 border-b border-r p-4 last:border-b-0">
            <metric.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="wave-micro-label">{metric.label}</p>
              <p className="mt-2 break-words text-xl font-semibold tabular-nums">{metric.value}</p>
            </div>
          </div>)}
        </div>
        <p className="text-xs text-muted-foreground">
          USD is the recorded pricing estimate for covered runs, not a provider bill or all-provider cost.
          Zero counts are actual zero; N/A means there is no denominator.
        </p>
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Recorded outcomes by feature</CardTitle>
          <CardDescription>Follow-through is a metadata event proxy, not confirmed usefulness.</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(metrics.featureCounts).length === 0
            ? <p className="text-sm text-muted-foreground">No production AI runs in this window.</p>
            : <div className="divide-y rounded-lg border">
              {Object.entries(metrics.featureCounts).map(([feature, counts]) => <div key={feature}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{featureLabels[feature] ?? "Other recorded feature"}</span>
                <span className="text-muted-foreground">{counts.attempts} runs, {counts.successes} successful</span>
                <Badge variant={counts.followThrough > 0 ? "secondary" : "outline"}>
                  {counts.followThrough} follow-through
                </Badge>
              </div>)}
            </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reliability and tokens</CardTitle>
          <CardDescription>Completed runs: {metrics.successes} succeeded, {metrics.failures} failed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
            <span className="text-muted-foreground">Input tokens</span><span className="text-right font-medium tabular-nums">{INTEGER.format(metrics.inputTokens)}</span>
            <span className="text-muted-foreground">Cached input</span><span className="text-right font-medium tabular-nums">{INTEGER.format(metrics.cachedInputTokens)}</span>
            <span className="text-muted-foreground">Cache writes</span><span className="text-right font-medium tabular-nums">{INTEGER.format(metrics.cacheWriteTokens)}</span>
            <span className="text-muted-foreground">Output tokens</span><span className="text-right font-medium tabular-nums">{INTEGER.format(metrics.outputTokens)}</span>
            <span className="text-muted-foreground">Reasoning tokens</span><span className="text-right font-medium tabular-nums">{INTEGER.format(metrics.reasoningTokens)}</span>
            <span className="text-muted-foreground">Linked events</span><span className="text-right font-medium tabular-nums">{INTEGER.format(metrics.linkedEventCount)}</span>
          </div>
          {Object.keys(metrics.errorCounts).length > 0 && <div className="border-t pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><AlertCircle className="size-4" /> Safe error codes</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.errorCounts).map(([code, count]) => <Badge key={code} variant="outline">{code}: {count}</Badge>)}
            </div>
          </div>}
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Recorded follow-through</CardTitle>
          <CardDescription>Only events linked to selected runs.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {outcomeEvents.map((event) => <div key={event.label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{event.label}</span>
            <span className="font-medium tabular-nums">{event.value}</span>
          </div>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recorded review signals</CardTitle>
          <CardDescription>Votes are recorded feedback, not measured usefulness.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {feedbackEvents.map((event) => <div key={event.label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{event.label}</span>
            <span className="font-medium tabular-nums">{event.value}</span>
          </div>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Freshness</CardTitle>
          <CardDescription>Latest bounded ledger activity, separate from capture time.</CardDescription></CardHeader>
        <CardContent><p className="text-sm font-medium">{timestamp(metrics.lastLedgerActivityAt)}</p></CardContent>
      </Card>
    </div>
  </div>
}
