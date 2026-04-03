import { Card, CardContent } from "@/components/ui/card"
import { Timer, TrendingDown, CalendarCheck, Send, BarChart3, UserX, Ratio, Target } from "lucide-react"
import { cn } from "@/lib/utils"

interface OperationalKpisProps {
  data: {
    timeToFirstMeeting: number | null
    timeToQualification: number | null
    firstMeetingBookingRate: number
    offerSubmissionRate: number
    dropOffByStage: { stage: string; count: number; dropOff: number }[]
    interviewsHeld: number
    noShowRate: number
    meetingToOfferRatio: number | null
    accuracyStats: { whoAccurate: number; whenAccurate: number; total: number }
  }
}

interface KpiCard {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  description?: string
}

export function OperationalKpis({ data }: OperationalKpisProps) {
  const speedCards: KpiCard[] = [
    {
      label: "Time to First Meeting",
      value: data.timeToFirstMeeting !== null ? `${data.timeToFirstMeeting}d` : "\u2014",
      icon: Timer,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
      description: "median days",
    },
    {
      label: "Time to Qualification",
      value: data.timeToQualification !== null ? `${data.timeToQualification}d` : "\u2014",
      icon: TrendingDown,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
      description: "median days",
    },
  ]

  const conversionCards: KpiCard[] = [
    {
      label: "First Meeting Booking Rate",
      value: `${data.firstMeetingBookingRate}%`,
      icon: CalendarCheck,
      iconColor: "text-teal-600",
      iconBg: "bg-teal-50",
    },
    {
      label: "Offer Submission Rate",
      value: `${data.offerSubmissionRate}%`,
      icon: Send,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
  ]

  const operationalCards: KpiCard[] = [
    {
      label: "Interviews Held",
      value: `${data.interviewsHeld}`,
      icon: BarChart3,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
    },
    {
      label: "No-show Rate",
      value: `${data.noShowRate}%`,
      icon: UserX,
      iconColor: data.noShowRate > 20 ? "text-red-600" : "text-amber-600",
      iconBg: data.noShowRate > 20 ? "bg-red-50" : "bg-amber-50",
    },
    {
      label: "Meeting-to-Offer Ratio",
      value: data.meetingToOfferRatio !== null ? `${data.meetingToOfferRatio}:1` : "\u2014",
      icon: Ratio,
      iconColor: "text-cyan-600",
      iconBg: "bg-cyan-50",
    },
    ...(data.accuracyStats.total > 0
      ? [
          {
            label: "Scoring Accuracy",
            value: `${data.accuracyStats.whoAccurate}% / ${data.accuracyStats.whenAccurate}%`,
            icon: Target,
            iconColor: "text-emerald-600",
            iconBg: "bg-emerald-50",
            description: "WHO / WHEN accurate",
          } satisfies KpiCard,
        ]
      : []),
  ]

  const sections = [
    { title: "Speed", cards: speedCards },
    { title: "Conversion", cards: conversionCards, dropOff: data.dropOffByStage },
    { title: "Operational", cards: operationalCards },
  ]

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {section.title}
          </h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {section.cards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("rounded-lg p-2", card.iconBg)}>
                      <card.icon className={cn("size-4", card.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                      <p className="text-xl font-semibold tabular-nums">{card.value}</p>
                      {card.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{card.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {section.dropOff && section.dropOff.length > 0 && (
            <div className="mt-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Drop-off by Stage</p>
              <div className="space-y-1">
                {section.dropOff.map((row) => (
                  <div key={row.stage} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{row.stage}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="tabular-nums">{row.count} total</span>
                      <span className="tabular-nums text-red-600">{row.dropOff} dropped</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
