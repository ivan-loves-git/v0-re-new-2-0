import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Target, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AnalyticsData } from "@/lib/actions/analytics"

interface KpiCardsProps {
  data: AnalyticsData
  period: string
}

export function KpiCards({ data, period }: KpiCardsProps) {
  const delta = period !== "all"
    ? data.newProfilesThisPeriod - data.newProfilesPreviousPeriod
    : null

  const cards = [
    {
      label: "Total Profiles",
      value: data.totalProfiles,
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      delta,
    },
    {
      label: "Avg WHO Score",
      value: data.avgWhoScore !== null ? data.avgWhoScore : "--",
      icon: Target,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      delta: null,
      suffix: data.avgWhoScore !== null ? "/100" : undefined,
    },
    {
      label: "Avg WHEN Score",
      value: data.avgWhenScore !== null ? data.avgWhenScore : "--",
      icon: Clock,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      delta: null,
      suffix: data.avgWhenScore !== null ? "/100" : undefined,
    },
    {
      label: "Above Threshold",
      value: `${data.aboveThresholdPercent}%`,
      icon: CheckCircle,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      delta: null,
      description: "WHO & WHEN >= 60",
    },
    {
      label: "Stale Leads",
      value: data.staleLeads.length,
      icon: AlertTriangle,
      iconColor: data.staleLeads.length > 5 ? "text-red-600" : "text-amber-600",
      iconBg: data.staleLeads.length > 5 ? "bg-red-50" : "bg-amber-50",
      delta: null,
      alert: data.staleLeads.length > 5,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className={cn(card.alert && "border-red-200")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2", card.iconBg)}>
                <card.icon className={cn("h-4 w-4", card.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-semibold tabular-nums">
                    {card.value}
                  </p>
                  {card.suffix && (
                    <span className="text-xs text-muted-foreground">{card.suffix}</span>
                  )}
                </div>
                {card.delta !== null && card.delta !== undefined && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-1 text-[10px] px-1.5 py-0",
                      card.delta > 0
                        ? "border-green-200 bg-green-50 text-green-700"
                        : card.delta < 0
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-gray-200 bg-gray-50 text-gray-600"
                    )}
                  >
                    {card.delta > 0 ? `+${card.delta}` : card.delta === 0 ? "0" : card.delta} vs prev
                  </Badge>
                )}
                {card.description && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{card.description}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
