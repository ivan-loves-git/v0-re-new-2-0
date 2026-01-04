"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { StatusBadge } from "@/components/repreneurs/status-badge"

interface StaleRepreneur {
  id: string
  first_name: string
  last_name: string
  lifecycle_status: string
  last_activity_date: string | null
  days_since_activity: number
}

interface StaleRepreneursAlertProps {
  repreneurs: StaleRepreneur[]
  maxHeight?: string
}

export function StaleRepreneursAlert({ repreneurs, maxHeight = "250px" }: StaleRepreneursAlertProps) {
  const hasStale = repreneurs.length > 0

  return (
    <Card className={hasStale ? "border-orange-200 bg-orange-50/30" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className={`h-5 w-5 ${hasStale ? "text-orange-500" : "text-gray-400"}`} />
          Needs Attention
          <CardInfoButton info="Repreneurs with no logged activity in the last 14 days. Excludes clients. Consider reaching out to keep the relationship warm." />
          {hasStale && (
            <span className="ml-auto text-xs font-normal bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {repreneurs.length} stale
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight }}>
          {hasStale ? (
            repreneurs.map((repreneur) => (
              <Link
                key={repreneur.id}
                href={`/repreneurs/${repreneur.id}`}
                className="block p-2 rounded-lg border border-orange-200 bg-white hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {repreneur.first_name} {repreneur.last_name}
                    </p>
                    <p className="text-xs text-orange-600">
                      {repreneur.last_activity_date
                        ? `No activity for ${repreneur.days_since_activity} days`
                        : "No activity recorded"
                      }
                    </p>
                  </div>
                  <StatusBadge status={repreneur.lifecycle_status} />
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-green-600 font-medium">All caught up!</p>
              <p className="text-xs text-gray-500 mt-1">No repreneurs need immediate attention</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
