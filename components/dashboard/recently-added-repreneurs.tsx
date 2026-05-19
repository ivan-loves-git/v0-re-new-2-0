"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { JourneyStageBadge } from "@/components/journey/journey-stage-badge"
import type { JourneyStage, LifecycleStatus } from "@/lib/types/repreneur"

interface RecentRepreneur {
  id: string
  first_name: string
  last_name: string
  email: string
  lifecycle_status: LifecycleStatus
  journey_stage: JourneyStage | null
  created_at: string
  tier1_score?: number | null
  who_score?: number | null
  when_score?: number | null
}

function getScoreColor(who: number, when: number) {
  const total = who + when
  if (total >= 140) return "text-green-600 bg-green-50"
  if (total >= 100) return "text-blue-600 bg-blue-50"
  if (total >= 60) return "text-yellow-600 bg-yellow-50"
  return "text-gray-500 bg-gray-50"
}

interface RecentlyAddedRepreneursProps {
  repreneurs: RecentRepreneur[]
  maxHeight?: string
}

const kpiInfo = {
  recentlyAdded: {
    title: "Recently Added",
    description: "Repreneurs added to the system in the last 7 days. Shows their current lifecycle status and journey stage at a glance.",
    why: "New leads need fast follow-up. Studies show contacting within 24h dramatically increases conversion. This list helps prioritize fresh opportunities.",
  },
}

export function RecentlyAddedRepreneurs({ repreneurs, maxHeight = "300px" }: RecentlyAddedRepreneursProps) {
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-5 text-gray-900" />
          Recently Added
          <CardInfoButton info={kpiInfo.recentlyAdded} />
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {repreneur.first_name} {repreneur.last_name}
                      </p>
                      {(() => {
                        const who = repreneur.who_score ?? 0
                        const when = repreneur.when_score ?? 0
                        const hasWhoWhen = repreneur.who_score != null || repreneur.when_score != null
                        if (hasWhoWhen) {
                          return (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getScoreColor(who, when)}`}>
                              {who} / {when}
                            </span>
                          )
                        }
                        if (repreneur.tier1_score != null && repreneur.tier1_score > 0) {
                          return (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded text-gray-500 bg-gray-50">
                              {repreneur.tier1_score}
                            </span>
                          )
                        }
                        return null
                      })()}
                    </div>
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
