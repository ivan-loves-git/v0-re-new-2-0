"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MailOpen, MousePointerClick, AlertCircle } from "lucide-react"
import { KpiMetricGrid, KpiMetricTile } from "@/components/ui/kpi-metric-tile"
import type { EmailStats } from "@/lib/actions/emails"

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
  const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1)

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

      {/* Simple Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Emails Sent Per Day</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyCounts.length > 0 ? (
            <div className="flex items-end gap-2 h-48">
              {dailyCounts.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                    style={{
                      height: `${(day.count / maxCount) * 160}px`,
                      minHeight: day.count > 0 ? "4px" : "0",
                    }}
                    title={`${day.count} email(s)`}
                  />
                  <span className="text-xs text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
