"use client"

import Link from "next/link"
import { formatDistance } from "date-fns"
import { UserPlus, UserRound } from "lucide-react"

import { JourneyStageBadge } from "@/components/journey/journey-stage-badge"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { JourneyStage, LifecycleStatus } from "@/lib/types/repreneur"
import { CardInfoButton } from "./card-info-button"
import { CardLinkButton } from "./card-link-button"
import { initialDateLabel, useHydratedNow } from "@/hooks/use-hydrated-now"

interface RecentRepreneur {
  id: string
  first_name: string
  last_name: string
  email: string
  lifecycle_status: LifecycleStatus
  journey_stage?: JourneyStage | null
  created_at: string
  tier1_score?: number | null
  who_score?: number | null
  when_score?: number | null
}

interface RecentlyAddedRepreneursProps {
  repreneurs: RecentRepreneur[]
  maxHeight?: string
}

const kpiInfo = {
  recentlyAdded: {
    title: "Recently added repreneurs",
    description: "Profiles added in the last seven days, with their current status, score, and journey stage.",
    why: "New relationships benefit from fast, visible follow-up.",
  },
}

function ScoreValue({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="font-semibold tabular-nums text-foreground">{value}</span>
}

export function RecentlyAddedRepreneurs({
  repreneurs,
  maxHeight = "420px",
}: RecentlyAddedRepreneursProps) {
  const now = useHydratedNow()
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex min-h-14 flex-row items-center justify-between border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-muted-foreground" />
          Recently added
          <CardInfoButton info={kpiInfo.recentlyAdded} />
        </CardTitle>
        <CardLinkButton href="/repreneurs/explore" tooltip="Find all repreneurs" />
      </CardHeader>
      <CardContent className="px-0">
        {repreneurs.length > 0 ? (
          <div className="overflow-y-auto" style={{ maxHeight }}>
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="min-w-48 pl-5">Name</TableHead>
                  <TableHead className="min-w-56">Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">WHO</TableHead>
                  <TableHead className="text-right">WHEN</TableHead>
                  <TableHead>Journey</TableHead>
                  <TableHead className="pr-5 text-right">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repreneurs.map((repreneur) => (
                  <TableRow key={repreneur.id}>
                    <TableCell className="pl-5">
                      <Link
                        href={`/repreneurs/${repreneur.id}`}
                        className="flex items-center gap-2.5 font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted/60 text-muted-foreground">
                          <UserRound className="size-3.5" />
                        </span>
                        <span>{repreneur.first_name} {repreneur.last_name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{repreneur.email}</TableCell>
                    <TableCell><StatusBadge status={repreneur.lifecycle_status} /></TableCell>
                    <TableCell className="text-right"><ScoreValue value={repreneur.who_score} /></TableCell>
                    <TableCell className="text-right"><ScoreValue value={repreneur.when_score} /></TableCell>
                    <TableCell>
                      {repreneur.journey_stage ? (
                        <JourneyStageBadge stage={repreneur.journey_stage} showIcon={false} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right text-muted-foreground">
                      {now === null ? initialDateLabel(repreneur.created_at) : formatDistance(new Date(repreneur.created_at), new Date(now), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center px-5 text-center">
            <div>
              <p className="text-sm font-medium">No new repreneurs this week</p>
              <p className="mt-1 text-xs text-muted-foreground">New profiles will appear here as they are added.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
