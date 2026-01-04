"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Mail, Phone, Users, FileText, Calendar } from "lucide-react"
import { CardInfoButton } from "./card-info-button"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string | null
  duration_minutes: number | null
  created_at: string
  repreneur_id: string
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
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-gray-900" />
          Activity Stream
          <CardInfoButton info={kpiInfo.activityStream} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight }}>
          {activities.length > 0 ? (
            activities.map((activity) => {
              const Icon = activityIcons[activity.type.toLowerCase()] || activityIcons.default
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
                >
                  <div className="p-2 rounded-full bg-blue-50 text-blue-600 shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm capitalize">{activity.title || activity.type}</span>
                      {activity.duration_minutes && (
                        <span className="text-xs text-gray-400">{activity.duration_minutes} min</span>
                      )}
                    </div>
                    <Link
                      href={`/repreneurs/${activity.repreneur_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {activity.repreneur_name}
                    </Link>
                    {activity.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{activity.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
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
