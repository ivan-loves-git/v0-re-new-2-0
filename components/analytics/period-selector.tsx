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
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => handleSelect(p.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            activePeriod === p.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
