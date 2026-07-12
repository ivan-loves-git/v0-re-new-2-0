import {
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  UserRound,
  Users,
} from "lucide-react"

import {
  KpiMetricGrid,
  KpiMetricTile,
  type KpiTrend,
} from "@/components/ui/kpi-metric-tile"

interface StatsColumnProps {
  totalRepreneurs: number
  leadCount: number
  qualifiedCount: number
  clientCount: number
  toReactivateCount?: number
  lastWeekTotal?: number
  lastWeekLeads?: number
  lastWeekQualified?: number
  lastWeekClients?: number
}

function comparisonTrend(
  current: number,
  previous: number | undefined,
  positiveGrowth = false,
): KpiTrend | null {
  if (previous === undefined) return null
  const difference = current - previous
  if (difference === 0) return { value: "0 vs last week", direction: "flat", tone: "neutral" }

  return {
    value: `${difference > 0 ? "+" : ""}${difference} vs last week`,
    direction: difference > 0 ? "up" : "down",
    tone: positiveGrowth
      ? difference > 0
        ? "positive"
        : "negative"
      : "neutral",
  }
}

export function StatsColumn({
  totalRepreneurs,
  leadCount,
  qualifiedCount,
  clientCount,
  toReactivateCount = 0,
  lastWeekTotal,
  lastWeekLeads,
  lastWeekQualified,
  lastWeekClients,
}: StatsColumnProps) {
  const metrics = [
    {
      title: "Total repreneurs",
      value: totalRepreneurs,
      period: "Current portfolio",
      icon: Users,
      tone: "email" as const,
      trend: comparisonTrend(totalRepreneurs, lastWeekTotal),
      info: {
        title: "Total repreneurs",
        description: "Every repreneur profile currently held in Wave.",
        why: "This is the reference base for the other pipeline measures.",
      },
    },
    {
      title: "Leads",
      value: leadCount,
      period: "Early-stage profiles",
      icon: UserRound,
      tone: "neutral" as const,
      trend: comparisonTrend(leadCount, lastWeekLeads),
      info: {
        title: "Leads",
        description: "Repreneurs currently at the lead stage.",
        why: "Movement is shown neutrally because fewer leads may mean successful qualification.",
      },
    },
    {
      title: "Qualified",
      value: qualifiedCount,
      period: "Validated profiles",
      icon: BadgeCheck,
      tone: "attention" as const,
      trend: comparisonTrend(qualifiedCount, lastWeekQualified, true),
      info: {
        title: "Qualified repreneurs",
        description: "Repreneurs who passed the current qualification threshold.",
        why: "This is the pool ready for a more active commercial relationship.",
      },
    },
    {
      title: "Clients",
      value: clientCount,
      period: "Active relationships",
      icon: BriefcaseBusiness,
      tone: "repreneur" as const,
      trend: comparisonTrend(clientCount, lastWeekClients, true),
      info: {
        title: "Clients",
        description: "Repreneurs currently recorded as clients.",
        why: "This shows the number of relationships that progressed beyond qualification.",
      },
    },
    {
      title: "To reactivate",
      value: toReactivateCount,
      period: "Follow-up required",
      icon: Clock3,
      tone: toReactivateCount > 0 ? "attention" as const : "neutral" as const,
      trend: null,
      info: {
        title: "To reactivate",
        description: "Profiles intentionally set aside for renewed contact.",
        why: "A visible reactivation queue prevents valuable relationships from becoming invisible.",
      },
    },
  ]

  return (
    <KpiMetricGrid className="grid-cols-1 sm:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric) => (
        <KpiMetricTile key={metric.title} {...metric} />
      ))}
    </KpiMetricGrid>
  )
}
