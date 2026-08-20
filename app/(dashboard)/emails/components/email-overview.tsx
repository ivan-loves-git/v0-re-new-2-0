"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MailOpen, MousePointerClick, AlertCircle } from "lucide-react"
import { KpiMetricGrid, KpiMetricTile } from "@/components/ui/kpi-metric-tile"
import type { EmailStats } from "@/lib/actions/emails"
import { WaveBarChart } from "@/components/wave/charts"
import { formatCivilDate } from "@/lib/utils/display-date-time"

interface EmailOverviewProps {
  stats: EmailStats
  dailyCounts: { date: string; count: number }[]
}

const kpiInfo = {
  sent: {
    title: "Emails Sent",
    description: "Total number of emails sent through the system in the last 30 days. Includes all template types (welcome, offers, reminders, etc.).",
    why: "Track overall email volume to monitor system usage and stay within rate limits (100/day, 3,000/month on free tier).",
  },
  openRate: {
    title: "Open Rate",
    description: "Percentage of delivered emails that were opened by recipients. Calculated as: (Opened ÷ Delivered) × 100.",
    why: "Measures email engagement. Industry average is 20-25%. Low rates may indicate subject lines need improvement or emails landing in spam.",
  },
  clickRate: {
    title: "Click Rate",
    description: "Percentage of opened emails where recipients clicked a link. Calculated as: (Clicked ÷ Opened) × 100.",
    why: "Shows how compelling your email content is. Higher rates mean recipients are taking action. Industry average is 2-5%.",
  },
  bounced: {
    title: "Bounce Rate",
    description: "Emails that failed to deliver due to invalid addresses, full inboxes, or server issues. Bounce rate = (Bounced ÷ Sent) × 100.",
    why: "High bounce rates (>2%) can damage sender reputation. Clean your email list if bounces are high.",
  },
}

export function EmailOverview({ stats, dailyCounts }: EmailOverviewProps) {
  const chartData = dailyCounts.map((day) => ({
    day: formatCivilDate(day.date, "en-GB", { day: "2-digit", month: "short" }),
    count: day.count,
  }))

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <KpiMetricGrid className="xl:grid-cols-4">
        <KpiMetricTile
          title="Emails Sent"
          value={stats.totalSent}
          period="Last 30 days"
          icon={Mail}
          tone="email"
          info={kpiInfo.sent}
        />
        <KpiMetricTile
          title="Open Rate"
          value={<>{stats.openRate.toFixed(1)}<span className="ml-0.5 text-xs font-medium text-muted-foreground">%</span></>}
          period={`${stats.totalOpened} opened / ${stats.totalDelivered} delivered`}
          icon={MailOpen}
          tone="email"
          info={kpiInfo.openRate}
        />
        <KpiMetricTile
          title="Click Rate"
          value={<>{stats.clickRate.toFixed(1)}<span className="ml-0.5 text-xs font-medium text-muted-foreground">%</span></>}
          period={`${stats.totalClicked} clicked / ${stats.totalOpened} opened`}
          icon={MousePointerClick}
          tone="email"
          info={kpiInfo.clickRate}
        />
        <KpiMetricTile
          title="Bounce Rate"
          value={<>{stats.bounceRate.toFixed(1)}<span className="ml-0.5 text-xs font-medium text-muted-foreground">%</span></>}
          period={`${stats.totalBounced} bounced`}
          icon={AlertCircle}
          tone={stats.bounceRate > 2 ? "risk" : "attention"}
          info={kpiInfo.bounced}
        />
      </KpiMetricGrid>

      <Card>
        <CardHeader>
          <CardTitle>Daily send volume</CardTitle>
        </CardHeader>
        <CardContent>
          <WaveBarChart data={chartData} label="Emails sent per day" xKey="day" series={[{ key: "count", label: "Emails", color: "var(--chart-1)" }]} className="h-[240px]" />
        </CardContent>
      </Card>
    </div>
  )
}
