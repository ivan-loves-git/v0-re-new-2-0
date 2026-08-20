"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Mail, Phone, Users, FileText, Calendar } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { CardLinkButton } from "./card-link-button"
import { formatDistance } from "date-fns"
import Link from "next/link"
import { initialDateLabel, useHydratedNow } from "@/hooks/use-hydrated-now"

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string | null
  duration_minutes: number | null
  created_at: string
  repreneur_id: string | null
  repreneur_name: string
  owner?: string
}

interface GlobalActivityStreamProps {
  activities: ActivityItem[]
  maxHeight?: string
}

const activityIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  interview: Calendar,
  default: Activity,
}

const kpiInfo = {
  activityStream: {
    title: "Activity Stream",
    description: "Real-time feed of all logged activities across repreneurs: calls, meetings, emails, notes, and interviews. Shows who did what and when.",
    why: "Monitor team activity and engagement. Ensures no repreneur falls through the cracks. Helps managers track team workload and follow-up consistency.",
  },
}

export function GlobalActivityStream({ activities, maxHeight = "400px" }: GlobalActivityStreamProps) {
  const now = useHydratedNow()
  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="flex min-h-14 flex-row items-center justify-between border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Activity Stream
          <CardInfoButton info={kpiInfo.activityStream} />
        </CardTitle>
        <CardLinkButton href="/analytics_re" tooltip="View activity analytics" />
      </CardHeader>
      <CardContent className="py-2">
        <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
          {activities.length > 0 ? (
            activities.map((activity) => {
              const Icon = activityIcons[activity.type.toLowerCase()] || activityIcons.default
              return (
                <div
                  key={activity.id}
                  className="flex min-h-[52px] items-start gap-3 border-b py-2.5 last:border-0"
                >
                  <div className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted/60 text-muted-foreground">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm capitalize">{activity.title || activity.type}</span>
                      {activity.duration_minutes && (
                        <span className="text-xs text-muted-foreground">{activity.duration_minutes} min</span>
                      )}
                    </div>
                    {activity.repreneur_id ? (
                      <Link
                        href={`/repreneurs/${activity.repreneur_id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {activity.repreneur_name}
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">{activity.repreneur_name}</span>
                    )}
                    {activity.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{activity.description}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {now === null ? initialDateLabel(activity.created_at) : formatDistance(new Date(activity.created_at), new Date(now), { addSuffix: true })}
                      {activity.owner && <span> · by {activity.owner}</span>}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
