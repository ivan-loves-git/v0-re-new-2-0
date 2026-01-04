"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Mail, MailOpen, MousePointerClick, AlertCircle, Info } from "lucide-react"
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
    title: "Bounces",
    description: "Emails that failed to deliver due to invalid addresses, full inboxes, or server issues. Bounce rate = (Bounced ÷ Sent) × 100.",
    why: "High bounce rates (>2%) can damage sender reputation. Clean your email list if bounces are high.",
  },
}

function InfoTooltip({ info }: { info: { title: string; description: string; why: string } }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{info.title}</p>
            <p className="text-xs">{info.description}</p>
            <p className="text-xs text-muted-foreground"><strong>Why it matters:</strong> {info.why}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function EmailOverview({ stats, dailyCounts }: EmailOverviewProps) {
  const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              Emails Sent
              <InfoTooltip info={kpiInfo.sent} />
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              Open Rate
              <InfoTooltip info={kpiInfo.openRate} />
            </CardTitle>
            <MailOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalOpened} opened / {stats.totalDelivered} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              Click Rate
              <InfoTooltip info={kpiInfo.clickRate} />
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clickRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalClicked} clicked / {stats.totalOpened} opened
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              Bounces
              <InfoTooltip info={kpiInfo.bounced} />
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBounced}</div>
            <p className="text-xs text-muted-foreground">
              {stats.bounceRate.toFixed(1)}% bounce rate
            </p>
          </CardContent>
        </Card>
      </div>

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
