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
      title: "Total Profiles",
      value: data.totalProfiles,
      icon: Users,
      tone: "repreneur" as const,
      period: selectedPeriod,
      trend: deltaTrend(delta),
      info: {
        title: "Total Profiles",
        description: "All repreneur profiles included in the selected analytics view.",
        why: "Shows the size of the repreneur base and whether the top of the pipeline is growing.",
      },
    },
    {
      title: "Avg WHO Score",
      value: data.avgWhoScore !== null ? <>{data.avgWhoScore}<span className="ml-0.5 text-xs font-medium text-muted-foreground">/100</span></> : "--",
      icon: Target,
      tone: "score" as const,
      period: selectedPeriod,
      info: {
        title: "Avg WHO Score",
        description: "Average WHO score across scored repreneurs in the selected period.",
        why: "Indicates the strength of the repreneur profile mix.",
      },
    },
    {
      title: "Avg WHEN Score",
      value: data.avgWhenScore !== null ? <>{data.avgWhenScore}<span className="ml-0.5 text-xs font-medium text-muted-foreground">/100</span></> : "--",
      icon: Clock,
      tone: "repreneur" as const,
      period: selectedPeriod,
      info: {
        title: "Avg WHEN Score",
        description: "Average WHEN score across scored repreneurs in the selected period.",
        why: "Shows how ready the current repreneur base is to move into acquisition activity.",
      },
    },
    {
      title: "Above Threshold",
      value: `${data.aboveThresholdPercent}%`,
      icon: CheckCircle,
      tone: "repreneur" as const,
      period: "WHO & WHEN >= 60",
      info: {
        title: "Above Threshold",
        description: "Share of scored repreneurs with both WHO and WHEN scores at or above 60.",
        why: "Helps the team see how much of the base is strong enough for serious follow-up.",
      },
    },
    {
      title: "Stale Leads",
      value: data.staleLeads.length,
      icon: AlertTriangle,
      tone: data.staleLeads.length > 5 ? "risk" as const : "attention" as const,
      period: "No activity > 14 days",
      info: {
        title: "Stale Leads",
        description: "Leads that have not had recent activity or follow-up.",
        why: "Highlights follow-up risk before promising repreneurs go cold.",
      },
    },
  ]

  return (
    <KpiMetricGrid className="xl:grid-cols-5">
      {cards.map((card) => (
        <KpiMetricTile key={card.title} {...card} />
      ))}
    </KpiMetricGrid>
  )
}
