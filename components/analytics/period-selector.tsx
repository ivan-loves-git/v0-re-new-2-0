"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const periods = [
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
  { label: "This quarter", value: "quarter" },
  { label: "All time", value: "all" },
]

export function PeriodSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activePeriod = searchParams.get("period") || "all"

  const handleSelect = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") {
      params.delete("period")
    } else {
      params.set("period", value)
    }
    const qs = params.toString()
    router.push(`/analytics_re${qs ? `?${qs}` : ""}`)
  }

  return (
    <div role="group" aria-label="Analytics period" className="inline-flex overflow-hidden rounded-md border bg-card">
      {periods.map((p) => (
        <button
          type="button"
          key={p.value}
          onClick={() => handleSelect(p.value)}
          aria-pressed={activePeriod === p.value}
          className={cn(
            "min-h-9 border-r px-3 text-xs font-medium transition-colors last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            activePeriod === p.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
