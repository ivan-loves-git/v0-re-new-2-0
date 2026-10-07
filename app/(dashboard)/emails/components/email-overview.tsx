"use client"
import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WaveBarChart } from "@/components/wave/charts"
import {
  WaveSegmentedSummary,
  WaveSegmentedMetric,
} from "@/components/wave/visual-foundations"
import {
  getEmailOperationsAnalytics,
  type EmailOperationsAnalytics,
} from "@/lib/actions/email-operations"
import { formatCivilDate, formatDisplayDateTime } from "@/lib/utils/display-date-time"
const labels: Record<string, string> = {
  status: "Status",
  intake: "Inscription",
  offer: "Offers",
  ma: "M&A",
}
export function EmailOverview({ initial }: { initial: EmailOperationsAnalytics }) {
  const [data, setData] = useState(initial),
    [pending, start] = useTransition()
  const load = (days: number) =>
    start(async () => {
      try {
        setData(await getEmailOperationsAnalytics(days))
      } catch {
        setData((previous) => ({ ...previous, state: "unavailable" }))
      }
    })
  const rate = (value: number | null) =>
    data.state === "unavailable"
      ? "Unavailable"
      : value === null
        ? "Not measured"
        : `${value.toFixed(1)}%`
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <Select value={String(data.days)} onValueChange={(value) => load(Number(value))}>
          <SelectTrigger aria-label="Analytics period" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[7, 30, 90].map((days) => (
              <SelectItem key={days} value={String(days)}>
                Last {days} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={pending} onClick={() => load(data.days)}>
          Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        One unique accepted business send cohort · {formatDisplayDateTime(data.from, "en-GB")} to{" "}
        {formatDisplayDateTime(data.to, "en-GB")} · Europe/Paris. Access, DEMO/test messages, CC
        copies and retries are excluded from volume.
      </p>
      {data.state === "unavailable" ? (
        <p role="alert" className="rounded-md border p-4">
          Analytics unavailable. The retained records could not be read; refresh to recover. No zero
          has been inferred.
        </p>
      ) : null}
      <WaveSegmentedSummary aria-label="Business send cohort summary">
        {[
          {
            name: "Accepted business messages",
            value: data.state === "available" ? data.totalSent : "Unavailable",
            detail: `${data.totalDelivered} delivered · ${data.days} days`,
          },
          {
            name: "Open activity",
            value: rate(data.openRate),
            detail: `${data.totalOpened} messages / ${data.coveredDelivered} covered delivered`,
          },
          {
            name: "Click activity",
            value: rate(data.clickRate),
            detail: `${data.totalClicked} messages / ${data.coveredDelivered} covered delivered`,
          },
          {
            name: "Bounce rate",
            value: rate(data.bounceRate),
            detail: `${data.totalBounced} uniquely bounced / ${data.totalSent} accepted`,
          },
        ].map((item) => (
          <WaveSegmentedMetric
            key={item.name}
            value={item.value}
            label={
              <>
                <span className="block font-medium">{item.name}</span>
                <span className="mt-1 block">
                  {data.state === "available" ? item.detail : "Evidence unavailable"}
                </span>
              </>
            }
          />
        ))}
      </WaveSegmentedSummary>
      {data.state === "available" ? (
        <p className="text-sm text-muted-foreground">
          Coverage: {data.coveredDelivered} delivered messages had tracking verified at send time;{" "}
          {data.uncoveredSent} accepted messages were untracked. Opens indicate image loading; staff
          CC and mail-client proxies may contribute. Message activity does not prove that the
          intended repreneur read or understood the mail.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{data.tracking}</p>
      {data.state === "available" ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily accepted volume · same cohort</CardTitle>
            </CardHeader>
            <CardContent>
              <WaveBarChart
                data={data.daily.map((item) => ({
                  ...item,
                  dateLabel: formatCivilDate(item.date, "en-GB"),
                }))}
                label="Accepted business messages by Paris date"
                xKey="dateLabel"
                series={[{ key: "count", label: "Messages", color: "var(--chart-1)" }]}
                className="h-[240px]"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Business categories · same cohort</CardTitle>
            </CardHeader>
            <CardContent>
              <WaveBarChart
                data={data.categories.map((item) => ({
                  ...item,
                  label: labels[item.category] ?? item.category,
                }))}
                label="Accepted messages by business category"
                xKey="label"
                series={[{ key: "count", label: "Messages", color: "var(--chart-2)" }]}
                className="h-[240px]"
              />
              <div className="flex flex-wrap gap-3 text-xs">
                {data.categories.map((item) => (
                  <span key={item.category}>
                    {labels[item.category]}: {item.count}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Professional-plan evaluation is deferred until at least 20 repreneurs. No purchase or longer
        provider retention is implied.
      </p>
    </div>
  )
}
