import { AlertCircle, CheckCircle2, Clock3, Copy, DollarSign, Gauge, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { WaveAiMetrics } from "@/lib/ai/metrics"

const INTEGER_NUMBER_FORMAT = new Intl.NumberFormat("en-GB")

function percent(value: number) {
  return new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(value)
}

function money(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
}

function duration(value: number) {
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`
}

const featureLabels: Record<string, string> = {
  email_draft: "Email drafts",
  next_action: "Next actions",
  match_review: "Match review",
}

export function WaveAiUsageDashboard({ metrics, days }: { metrics: WaveAiMetrics; days: 7 | 30 }) {
  const summary = [
    { label: "Attempts", value: INTEGER_NUMBER_FORMAT.format(metrics.attempts), icon: Sparkles },
    { label: "Successful", value: percent(metrics.successRate), icon: CheckCircle2 },
    { label: "Useful outcomes", value: `${metrics.usefulOutcomes} · ${percent(metrics.usefulOutcomeRate)}`, icon: Copy },
    { label: "Estimated cost", value: money(metrics.totalCostUsd), icon: DollarSign },
    { label: "Cost / useful", value: money(metrics.costPerUsefulOutcomeUsd), icon: Gauge },
    { label: "Median / p95", value: `${duration(metrics.medianLatencyMs)} · ${duration(metrics.p95LatencyMs)}`, icon: Clock3 },
  ]
  const outcomeEvents = [
    { label: "Copied drafts", value: metrics.eventCounts.copied ?? 0 },
    { label: "Successful sends", value: metrics.eventCounts.send_succeeded ?? 0 },
    { label: "Confirmed actions", value: metrics.eventCounts.workflow_action_confirmed ?? 0 },
  ]
  const feedbackEvents = [
    { label: "Helpful", value: metrics.eventCounts.feedback_helpful ?? 0 },
    { label: "Not helpful", value: metrics.eventCounts.feedback_not_helpful ?? 0 },
    { label: "Edits started", value: metrics.eventCounts.edit_started ?? 0 },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Last {days} days</CardTitle>
              <CardDescription>Metadata-only model usage and verified human outcomes.</CardDescription>
            </div>
            <Badge variant="outline">gpt-5.6-luna · max</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid overflow-hidden rounded-lg border p-0 sm:grid-cols-2 xl:grid-cols-3">
          {summary.map((metric) => (
            <div key={metric.label} className="flex min-h-28 items-start gap-3 border-b border-r p-4 last:border-b-0">
              <metric.icon className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="wave-micro-label">{metric.label}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">{metric.value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Outcomes by feature</CardTitle>
            <CardDescription>Only copied, sent, or confirmed existing actions count as useful.</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(metrics.featureCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">No AI runs in this window.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {Object.entries(metrics.featureCounts).map(([feature, counts]) => (
                  <div key={feature} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 text-sm">
                    <span className="font-medium">{featureLabels[feature] ?? feature}</span>
                    <span className="text-muted-foreground">{counts.attempts} attempts</span>
                    <span className="text-muted-foreground">{counts.successes} successful</span>
                    <Badge variant={counts.useful > 0 ? "secondary" : "outline"}>{counts.useful} useful</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reliability and tokens</CardTitle>
            <CardDescription>Operational totals; no prompts or generated text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
              <span className="text-muted-foreground">Failures</span><span className="text-right font-medium tabular-nums">{metrics.failures}</span>
              <span className="text-muted-foreground">Input tokens</span><span className="text-right font-medium tabular-nums">{INTEGER_NUMBER_FORMAT.format(metrics.inputTokens)}</span>
              <span className="text-muted-foreground">Cached input</span><span className="text-right font-medium tabular-nums">{INTEGER_NUMBER_FORMAT.format(metrics.cachedInputTokens)}</span>
              <span className="text-muted-foreground">Cache writes</span><span className="text-right font-medium tabular-nums">{INTEGER_NUMBER_FORMAT.format(metrics.cacheWriteTokens)}</span>
              <span className="text-muted-foreground">Output tokens</span><span className="text-right font-medium tabular-nums">{INTEGER_NUMBER_FORMAT.format(metrics.outputTokens)}</span>
              <span className="text-muted-foreground">Reasoning tokens</span><span className="text-right font-medium tabular-nums">{INTEGER_NUMBER_FORMAT.format(metrics.reasoningTokens)}</span>
            </div>
            {Object.keys(metrics.errorCounts).length > 0 && (
              <div className="border-t pt-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium"><AlertCircle className="size-4" /> Safe error codes</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(metrics.errorCounts).map(([code, count]) => <Badge key={code} variant="outline">{code}: {count}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Verified outcomes</CardTitle>
            <CardDescription>Separate human actions after review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {outcomeEvents.map((event) => (
              <div key={event.label} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{event.label}</span>
                <span className="font-medium tabular-nums">{event.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Review signals</CardTitle>
            <CardDescription>Diagnostic only; not counted as useful.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {feedbackEvents.map((event) => (
              <div key={event.label} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{event.label}</span>
                <span className="font-medium tabular-nums">{event.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Freshness</CardTitle>
            <CardDescription>Latest confirmed model completion.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {metrics.lastSuccessfulAt
                ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(metrics.lastSuccessfulAt))
                : "No successful run yet"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
