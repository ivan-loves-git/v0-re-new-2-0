import { Users, Target, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { KpiMetricGrid, KpiMetricTile, type KpiTrend } from "@/components/ui/kpi-metric-tile"
import type { AnalyticsData } from "@/lib/actions/analytics"

interface KpiCardsProps {
  data: AnalyticsData
  period: string
}

function periodLabel(period: string) {
  if (period === "week") return "This week"
  if (period === "month") return "This month"
  if (period === "quarter") return "This quarter"
  return "All time"
}

function deltaTrend(delta: number | null): KpiTrend | null {
  if (delta === null) return null
  if (delta > 0) return { value: `+${delta}`, direction: "up", tone: "positive" }
  if (delta < 0) return { value: delta, direction: "down", tone: "negative" }
  return { value: "-", direction: "flat", tone: "neutral" }
}

export function KpiCards({ data, period }: KpiCardsProps) {
  const delta = period !== "all"
    ? data.newProfilesThisPeriod - data.newProfilesPreviousPeriod
    : null
  const selectedPeriod = periodLabel(period)

  const cards = [
    {
      title: "Total profiles",
      value: data.totalProfiles,
      icon: Users,
      tone: "repreneur" as const,
      period: selectedPeriod,
      trend: deltaTrend(delta),
      info: {
        title: "Total profiles",
        description: "All repreneur profiles included in the selected analytics view.",
        why: "Shows the size of the repreneur base and whether the top of the pipeline is growing.",
      },
    },
    {
      title: "Average WHO score",
      value: data.avgWhoScore !== null ? <>{data.avgWhoScore}<span className="ml-0.5 text-xs font-medium text-muted-foreground">/100</span></> : "--",
      icon: Target,
      tone: "score" as const,
      period: selectedPeriod,
      info: {
        title: "Average WHO score",
        description: "Average WHO score across scored repreneurs in the selected period.",
        why: "Indicates the strength of the repreneur profile mix.",
      },
    },
    {
      title: "Average WHEN score",
      value: data.avgWhenScore !== null ? <>{data.avgWhenScore}<span className="ml-0.5 text-xs font-medium text-muted-foreground">/100</span></> : "--",
      icon: Clock,
      tone: "repreneur" as const,
      period: selectedPeriod,
      info: {
        title: "Average WHEN score",
        description: "Average WHEN score across scored repreneurs in the selected period.",
        why: "Shows how ready the current repreneur base is to move into acquisition activity.",
      },
    },
    {
      title: "Above threshold",
      value: `${data.aboveThresholdPercent}%`,
      icon: CheckCircle,
      tone: "repreneur" as const,
      period: "WHO & WHEN >= 60",
      info: {
        title: "Above threshold",
        description: "Share of scored repreneurs with both WHO and WHEN scores at or above 60.",
        why: "Helps the team see how much of the base is strong enough for serious follow-up.",
      },
    },
    {
      title: "Stale leads",
      value: data.staleLeadCount,
      icon: AlertTriangle,
      tone: data.staleLeadCount > 5 ? "risk" as const : "attention" as const,
      period: "No activity > 7 days",
      info: {
        title: "Stale leads",
        description: "Leads that have not had recent activity or follow-up.",
        why: "Highlights follow-up risk before promising repreneurs go cold.",
      },
    },
  ]

  return (
    <KpiMetricGrid className="grid-cols-1 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <KpiMetricTile key={card.title} {...card} />
      ))}
    </KpiMetricGrid>
  )
}
