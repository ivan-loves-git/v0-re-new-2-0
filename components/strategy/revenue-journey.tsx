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
  commission: "bg-purple-500",
}

export function RevenueJourney({ persona }: RevenueJourneyProps) {
  const { revenue, projectedCommission, projectedDeal } = persona
  const total = revenue.subscription + revenue.consulting + revenue.certification + revenue.commission
  const projectedTotal = total + projectedCommission
  const displayMax = Math.max(total, projectedCommission > 0 ? projectedTotal : total) * 1.1 || 1

  function pct(v: number) {
    return `${((v / displayMax) * 100).toFixed(1)}%`
  }

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
          <span className="text-2xl font-bold">{total.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground ml-1">EUR</span>
          {projectedCommission > 0 && (
            <p className="mt-0.5 text-xs text-primary">
              Projected if deal closes: +{projectedCommission.toLocaleString()} EUR commission ({projectedDeal}) = {projectedTotal.toLocaleString()} EUR total
            </p>
          )}
        </div>

        {/* Stacked bar */}
        <div className="h-8 bg-muted rounded-md overflow-hidden flex">
          {total === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              No revenue yet. Journey begins here.
            </div>
          ) : (
            <>
              {revenue.subscription > 0 && (
                <div
                  className={cn("h-full transition-all duration-500", REVENUE_COLORS.subscription)}
                  style={{ width: pct(revenue.subscription) }}
                  title={`Subscription: ${revenue.subscription} EUR`}
                />
              )}
              {revenue.consulting > 0 && (
                <div
                  className={cn("h-full transition-all duration-500", REVENUE_COLORS.consulting)}
                  style={{ width: pct(revenue.consulting) }}
                  title={`Consulting: ${revenue.consulting} EUR`}
                />
              )}
              {revenue.certification > 0 && (
                <div
                  className={cn("h-full transition-all duration-500", REVENUE_COLORS.certification)}
                  style={{ width: pct(revenue.certification) }}
                  title={`Certification: ${revenue.certification} EUR`}
                />
              )}
              {revenue.commission > 0 && (
                <div
                  className={cn("h-full transition-all duration-500", REVENUE_COLORS.commission)}
                  style={{ width: pct(revenue.commission) }}
                  title={`Commission: ${revenue.commission} EUR`}
                />
              )}
              {projectedCommission > 0 && (
                <div
                  className="h-full bg-primary/25 transition-all duration-500"
                  style={{ width: pct(projectedCommission) }}
                  title={`Projected commission: ${projectedCommission} EUR`}
                />
              )}
            </>
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
                  ? `(projected: ${projectedCommission.toLocaleString()})`
                  : revenue[key].toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
