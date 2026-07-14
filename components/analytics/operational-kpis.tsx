import {
  BarChart3,
  CalendarCheck,
  Ratio,
  Send,
  Target,
  Timer,
  TrendingDown,
  UserX,
  type LucideIcon,
} from "lucide-react"

import { CardInfoButton } from "@/components/dashboard/card-info-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

interface Metric {
  title: string
  value: string
  icon: LucideIcon
  period: string
  tone?: "default" | "attention" | "risk" | "positive"
  info: {
    title: string
    description: string
    why: string
  }
}

const toneClasses = {
  default: "bg-muted/60 text-muted-foreground",
  attention: "bg-warning/10 text-warning",
  risk: "bg-destructive/10 text-destructive",
  positive: "bg-success/10 text-success",
}

function MetricRow({ metric }: { metric: Metric }) {
  const Icon = metric.icon
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b py-2.5 last:border-b-0">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", toneClasses[metric.tone ?? "default"])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate text-sm font-medium">{metric.title}</p>
          <CardInfoButton info={metric.info} />
        </div>
        <p className="text-[11px] text-muted-foreground">{metric.period}</p>
      </div>
      <p className="shrink-0 text-lg font-semibold tabular-nums tracking-[-0.02em]">{metric.value}</p>
    </div>
  )
}

export function OperationalKpis({ data }: OperationalKpisProps) {
  const speedMetrics: Metric[] = [
    {
      title: "Time to first meeting",
      value: data.timeToFirstMeeting !== null ? `${data.timeToFirstMeeting}d` : "—",
      icon: Timer,
      period: "Median days",
      tone: "attention",
      info: {
        title: "Time to first meeting",
        description: "Median time between application and first logged meeting.",
        why: "Measures how quickly the team turns new interest into a real conversation.",
      },
    },
    {
      title: "Time to qualification",
      value: data.timeToQualification !== null ? `${data.timeToQualification}d` : "—",
      icon: TrendingDown,
      period: "Median days",
      info: {
        title: "Time to qualification",
        description: "Median time needed to move a repreneur into qualified status.",
        why: "Shows whether the assessment process is moving quickly enough.",
      },
    },
  ]

  const conversionMetrics: Metric[] = [
    {
      title: "First meeting booking rate",
      value: `${data.firstMeetingBookingRate}%`,
      icon: CalendarCheck,
      period: "Current rate",
      tone: "positive",
      info: {
        title: "First meeting booking rate",
        description: "Share of profiles that have at least one interview or meeting logged.",
        why: "Indicates whether leads are converting into live conversations.",
      },
    },
    {
      title: "Offer submission rate",
      value: `${data.offerSubmissionRate}%`,
      icon: Send,
      period: "Current rate",
      info: {
        title: "Offer submission rate",
        description: "Share of qualified-or-better repreneurs who received an offer.",
        why: "Measures how often qualified repreneurs move into a commercial next step.",
      },
    },
  ]

  const operationalMetrics: Metric[] = [
    {
      title: "Interviews held",
      value: `${data.interviewsHeld}`,
      icon: BarChart3,
      period: "All time",
      info: {
        title: "Interviews held",
        description: "Total interviews currently logged in the platform.",
        why: "Shows the volume of direct assessment activity.",
      },
    },
    {
      title: "No-show rate",
      value: `${data.noShowRate}%`,
      icon: UserX,
      period: "Current rate",
      tone: data.noShowRate > 20 ? "risk" : "attention",
      info: {
        title: "No-show rate",
        description: "Share of scheduled meetings where the repreneur did not attend.",
        why: "Highlights friction in the meeting process or weak commitment signals.",
      },
    },
    {
      title: "Meeting-to-offer ratio",
      value: data.meetingToOfferRatio !== null ? `${data.meetingToOfferRatio}:1` : "—",
      icon: Ratio,
      period: "Meetings per offer",
      info: {
        title: "Meeting-to-offer ratio",
        description: "Number of interviews held for each offer sent.",
        why: "Shows how efficiently meetings convert into commercial proposals.",
      },
    },
    ...(data.accuracyStats.total > 0
      ? [{
          title: "Scoring accuracy",
          value: `${data.accuracyStats.whoAccurate}% / ${data.accuracyStats.whenAccurate}%`,
          icon: Target,
          period: "WHO / WHEN",
          info: {
            title: "Scoring accuracy",
            description: "Share of reviewed scores considered accurate for WHO and WHEN.",
            why: "Checks whether the scoring model is matching team judgment.",
          },
        } satisfies Metric]
      : []),
  ]

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>Operating rhythm</CardTitle>
        <CardDescription>Speed, conversion, and day-to-day execution in one compact view.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid xl:grid-cols-3 xl:divide-x">
          <section className="px-5 py-4" aria-labelledby="analytics-speed-title">
            <h3 id="analytics-speed-title" className="wave-micro-label text-foreground">Speed</h3>
            <div className="mt-2">{speedMetrics.map((metric) => <MetricRow key={metric.title} metric={metric} />)}</div>
          </section>

          <section className="border-t px-5 py-4 xl:border-t-0" aria-labelledby="analytics-conversion-title">
            <h3 id="analytics-conversion-title" className="wave-micro-label text-foreground">Conversion</h3>
            <div className="mt-2">{conversionMetrics.map((metric) => <MetricRow key={metric.title} metric={metric} />)}</div>
            {data.dropOffByStage.length > 0 && (
              <div className="mt-3 rounded-md border bg-muted/25 p-3">
                <p className="wave-micro-label">Drop-off by stage</p>
                <div className="mt-2 space-y-1.5">
                  {data.dropOffByStage.map((row) => (
                    <div key={row.stage} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-muted-foreground">{row.stage}</span>
                      <span className="shrink-0 tabular-nums"><strong>{row.count}</strong> total · <span className="text-destructive">{row.dropOff} dropped</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="border-t px-5 py-4 xl:border-t-0" aria-labelledby="analytics-operations-title">
            <h3 id="analytics-operations-title" className="wave-micro-label text-foreground">Operations</h3>
            <div className="mt-2">{operationalMetrics.map((metric) => <MetricRow key={metric.title} metric={metric} />)}</div>
          </section>
        </div>
      </CardContent>
    </Card>
  )
}
