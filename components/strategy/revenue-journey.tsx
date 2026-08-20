"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { REVENUE_COLORS, REVENUE_LABELS, type Persona } from "@/lib/data/strategy-data"
import { Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

interface RevenueJourneyProps {
  persona: Persona
}

const LEGEND_DOTS: Record<string, string> = {
  subscription: "bg-emerald-500",
  consulting: "bg-amber-500",
  certification: "bg-blue-500",
  commission: "bg-chart-4",
}

const REVENUE_NUMBER_FORMAT = new Intl.NumberFormat("en-GB")

export function RevenueJourney({ persona }: RevenueJourneyProps) {
  const { revenue, projectedCommission, projectedDeal } = persona
  const total = revenue.subscription + revenue.consulting + revenue.certification + revenue.commission
  const projectedTotal = total + projectedCommission
  const displayMax = Math.max(total, projectedCommission > 0 ? projectedTotal : total) * 1.1 || 1

  const segments = [
    { key: "subscription", value: revenue.subscription, color: REVENUE_COLORS.subscription, label: "Subscription" },
    { key: "consulting", value: revenue.consulting, color: REVENUE_COLORS.consulting, label: "Consulting" },
    { key: "certification", value: revenue.certification, color: REVENUE_COLORS.certification, label: "Certification" },
    { key: "commission", value: revenue.commission, color: REVENUE_COLORS.commission, label: "Commission" },
    { key: "projectedCommission", value: projectedCommission, color: "bg-primary/25", label: "Projected commission" },
  ].map((segment, index, all) => ({
    ...segment,
    startPercent: (all.slice(0, index).reduce((sum, item) => sum + item.value, 0) / displayMax) * 100,
    scale: segment.value / displayMax,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="size-4 text-primary" />
            Revenue Journey
          </CardTitle>
          <div className="text-right text-xs text-muted-foreground">
            {total === 0 ? (
              <>
                <p>{persona.name} just signed up. No revenue yet.</p>
                <p className="text-emerald-600">Potential lifetime value: 47,000-52,000 EUR</p>
              </>
            ) : (
              <>
                <p>{persona.name} | {persona.subscription}</p>
                <p className="text-emerald-600">{persona.badges.length} badges earned</p>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total */}
        <div>
          <span className="text-2xl font-bold">{REVENUE_NUMBER_FORMAT.format(total)}</span>
          <span className="text-sm text-muted-foreground ml-1">EUR</span>
          {projectedCommission > 0 && (
            <p className="mt-0.5 text-xs text-primary">
              Projected if deal closes: +{REVENUE_NUMBER_FORMAT.format(projectedCommission)} EUR commission ({projectedDeal}) = {REVENUE_NUMBER_FORMAT.format(projectedTotal)} EUR total
            </p>
          )}
        </div>

        {/* Stacked bar */}
        <div className="relative h-8 overflow-hidden rounded-md bg-muted">
          {total === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              No revenue yet. Journey begins here.
            </div>
          ) : (
            segments.map((segment) => (
              <div
                key={segment.key}
                className="absolute inset-y-0 left-0 w-full transition-transform duration-wave-standard ease-wave-out motion-reduce:transition-none"
                style={{ transform: `translateX(${segment.startPercent}%)` }}
                aria-hidden={segment.value === 0}
              >
                <div
                  className={cn("h-full w-full origin-left transition-transform duration-wave-standard ease-wave-out motion-reduce:transition-none", segment.color, segment.value === 0 && "hidden")}
                  style={{ transform: `scaleX(${segment.scale})` }}
                  title={`${segment.label}: ${segment.value} EUR`}
                />
              </div>
            ))
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {(Object.keys(REVENUE_LABELS) as Array<keyof typeof REVENUE_LABELS>).map((key) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn("size-2.5 rounded-sm flex-shrink-0", LEGEND_DOTS[key])} />
              <span>{REVENUE_LABELS[key]}</span>
              <span className="font-semibold text-foreground">
                {key === "commission" && projectedCommission > 0
                  ? `(projected: ${REVENUE_NUMBER_FORMAT.format(projectedCommission)})`
                  : REVENUE_NUMBER_FORMAT.format(revenue[key])}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
