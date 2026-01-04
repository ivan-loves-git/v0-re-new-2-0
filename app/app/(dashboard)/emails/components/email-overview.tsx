"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MailOpen, MousePointerClick, AlertCircle } from "lucide-react"
import type { EmailStats } from "@/lib/actions/emails"

interface EmailOverviewProps {
  stats: EmailStats
  dailyCounts: { date: string; count: number }[]
}

export function EmailOverview({ stats, dailyCounts }: EmailOverviewProps) {
  const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails envoyés</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent}</div>
            <p className="text-xs text-muted-foreground">30 derniers jours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d&apos;ouverture</CardTitle>
            <MailOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalOpened} ouvert(s) / {stats.totalDelivered} livré(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de clic</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clickRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalClicked} cliqué(s) / {stats.totalOpened} ouvert(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rebonds</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBounced}</div>
            <p className="text-xs text-muted-foreground">
              {stats.bounceRate.toFixed(1)}% taux de rebond
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Simple Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Emails envoyés par jour</CardTitle>
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
                    {new Date(day.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Aucune donnée disponible
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
