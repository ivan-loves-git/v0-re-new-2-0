"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown } from "lucide-react"
import { DECLINE_REASON_OPTIONS } from "@/lib/types/repreneur"

interface DeclineReasonsProps {
  breakdown: { category: string; count: number }[]
}

const LABEL_BY_VALUE: Record<string, string> = {
  ...Object.fromEntries(DECLINE_REASON_OPTIONS.map(o => [o.value, o.label])),
  unspecified: "Not specified",
}

export function DeclineReasons({ breakdown }: DeclineReasonsProps) {
  const total = breakdown.reduce((sum, b) => sum + b.count, 0)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingDown className="size-4 text-muted-foreground" />
          Decline Reasons
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {total} declined
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No declined offers yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {breakdown.map(({ category, count }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{LABEL_BY_VALUE[category] || category}</span>
                    <span className="text-muted-foreground text-xs">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
