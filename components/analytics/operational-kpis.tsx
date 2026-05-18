import { Timer, TrendingDown, CalendarCheck, Send, BarChart3, UserX, Ratio, Target, type LucideIcon } from "lucide-react"
import { KpiMetricGrid, KpiMetricTile } from "@/components/ui/kpi-metric-tile"

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
  title: string
  value: string
  icon: LucideIcon
  tone: "email" | "repreneur" | "score" | "opportunity" | "attention" | "risk" | "neutral"
  period: string
  info: {
    title: string
    description: string
    why?: string
  }
}

export function OperationalKpis({ data }: OperationalKpisProps) {
  const speedCards: KpiCard[] = [
    {
      title: "Time to First Meeting",
      value: data.timeToFirstMeeting !== null ? `${data.timeToFirstMeeting}d` : "\u2014",
      icon: Timer,
      tone: "attention",
      period: "Median days",
      info: {
        title: "Time to First Meeting",
        description: "Median time between application and first logged meeting.",
        why: "Measures how quickly the team turns new interest into a real conversation.",
      },
    },
    {
      title: "Time to Qualification",
      value: data.timeToQualification !== null ? `${data.timeToQualification}d` : "\u2014",
      icon: TrendingDown,
      tone: "score",
      period: "Median days",
      info: {
        title: "Time to Qualification",
        description: "Median time needed to move a repreneur into qualified status.",
        why: "Shows whether the assessment process is moving quickly enough.",
      },
    },
  ]

  const conversionCards: KpiCard[] = [
    {
      title: "First Meeting Booking Rate",
      value: `${data.firstMeetingBookingRate}%`,
      icon: CalendarCheck,
      tone: "opportunity",
      period: "Current rate",
      info: {
        title: "First Meeting Booking Rate",
        description: "Share of profiles that have at least one interview or meeting logged.",
        why: "Indicates whether leads are converting into live conversations.",
      },
    },
    {
      title: "Offer Submission Rate",
      value: `${data.offerSubmissionRate}%`,
      icon: Send,
      tone: "email",
      period: "Current rate",
      info: {
        title: "Offer Submission Rate",
        description: "Share of qualified-or-better repreneurs who received an offer.",
        why: "Measures how often qualified repreneurs move into a commercial next step.",
      },
    },
  ]

  const operationalCards: KpiCard[] = [
    {
      title: "Interviews Held",
      value: `${data.interviewsHeld}`,
      icon: BarChart3,
      tone: "score",
      period: "All time",
      info: {
        title: "Interviews Held",
        description: "Total interviews currently logged in the platform.",
        why: "Shows the volume of direct assessment activity.",
      },
    },
    {
      title: "No-show Rate",
      value: `${data.noShowRate}%`,
      icon: UserX,
      tone: data.noShowRate > 20 ? "risk" : "attention",
      period: "Current rate",
      info: {
        title: "No-show Rate",
        description: "Share of scheduled meetings where the repreneur did not attend.",
        why: "Highlights friction in the meeting process or weak commitment signals.",
      },
    },
    {
      title: "Meeting-to-Offer Ratio",
      value: data.meetingToOfferRatio !== null ? `${data.meetingToOfferRatio}:1` : "\u2014",
      icon: Ratio,
      tone: "opportunity",
      period: "Meetings per offer",
      info: {
        title: "Meeting-to-Offer Ratio",
        description: "Number of interviews held for each offer sent.",
        why: "Shows how efficiently meetings convert into commercial proposals.",
      },
    },
    ...(data.accuracyStats.total > 0
      ? [
          {
            title: "Scoring Accuracy",
            value: `${data.accuracyStats.whoAccurate}% / ${data.accuracyStats.whenAccurate}%`,
            icon: Target,
            tone: "score",
            period: "WHO / WHEN",
            info: {
              title: "Scoring Accuracy",
              description: "Share of reviewed scores considered accurate for WHO and WHEN.",
              why: "Checks whether the scoring model is matching team judgment.",
            },
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
          <KpiMetricGrid className="xl:grid-cols-4">
            {section.cards.map((card) => (
              <KpiMetricTile key={card.title} {...card} />
            ))}
          </KpiMetricGrid>

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
