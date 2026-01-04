"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { JourneyStageBadge } from "@/components/journey/journey-stage-badge"

interface RecentRepreneur {
  id: string
  first_name: string
  last_name: string
  email: string
  lifecycle_status: string
  journey_stage: string | null
  created_at: string
}

interface RecentlyAddedRepreneursProps {
  repreneurs: RecentRepreneur[]
  maxHeight?: string
}

export function RecentlyAddedRepreneurs({ repreneurs, maxHeight = "300px" }: RecentlyAddedRepreneursProps) {
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-5 w-5 text-gray-900" />
          Recently Added
          <CardInfoButton info="Repreneurs added to the system in the last 7 days. Click to view their full profile and start tracking their journey." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight }}>
          {repreneurs.length > 0 ? (
            repreneurs.map((repreneur) => (
              <Link
                key={repreneur.id}
                href={`/repreneurs/${repreneur.id}`}
                className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {repreneur.first_name} {repreneur.last_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{repreneur.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Added {formatDistanceToNow(new Date(repreneur.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <StatusBadge status={repreneur.lifecycle_status} />
                    {repreneur.journey_stage && (
                      <JourneyStageBadge stage={repreneur.journey_stage} showIcon={false} />
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No recent additions</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
