import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Compass, Map, Flag, Trophy, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { JourneyStage, Repreneur } from "@/lib/types/repreneur"
import { extractMilestones, countMilestones, deriveJourneyStage } from "@/lib/utils/journey-derivation"
import { cn } from "@/lib/utils"

// Cache for 30 seconds
export const revalidate = 30

const stages: JourneyStage[] = ["explorer", "learner", "ready", "serial_acquirer"]

const stageConfig: Record<JourneyStage, {
  label: string
  icon: typeof Compass
  color: string
  bgColor: string
  borderColor: string
  description: string
}> = {
  explorer: {
    label: "Explorer",
    icon: Compass,
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    description: "0-2 milestones",
  },
  learner: {
    label: "Learner",
    icon: Map,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "3-6 milestones",
  },
  ready: {
    label: "Ready",
    icon: Flag,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "7-9 milestones",
  },
  serial_acquirer: {
    label: "Serial Acquirer",
    icon: Trophy,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "10 milestones",
  },
}

function getMilestoneCount(repreneur: Repreneur): number {
  const milestones = extractMilestones(repreneur as any)
  return countMilestones(milestones)
}

function getDerivedStage(repreneur: Repreneur): JourneyStage {
  const milestoneCount = getMilestoneCount(repreneur)
  return deriveJourneyStage(milestoneCount, repreneur.persona)
}

export default async function JourneyPage() {
  const supabase = await createClient()

  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .neq("lifecycle_status", "rejected")
    .order("created_at", { ascending: false })

  // Group repreneurs by derived journey stage
  const byStage = stages.reduce(
    (acc, stage) => {
      acc[stage] = repreneurs?.filter((r) => {
        const derivedStage = getDerivedStage(r as Repreneur)
        return derivedStage === stage
      }) || []
      return acc
    },
    {} as Record<JourneyStage, Repreneur[]>,
  )

  const totalRepreneurs = repreneurs?.length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Journey</h1>
        <p className="text-gray-600 mt-1">Track repreneurs through their acquisition readiness journey</p>
      </div>

      {/* Stage Pipeline */}
      <div className="flex items-stretch gap-2">
        {stages.map((stage, index) => {
          const config = stageConfig[stage]
          const Icon = config.icon
          const count = byStage[stage].length
          const percentage = totalRepreneurs > 0 ? Math.round((count / totalRepreneurs) * 100) : 0

          return (
            <div key={stage} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex-1 rounded-lg border-2 p-4 text-center transition-all hover:shadow-md",
                  config.bgColor,
                  config.borderColor
                )}
              >
                <Icon className={cn("h-8 w-8 mx-auto mb-2", config.color)} />
                <p className={cn("text-2xl font-bold", config.color)}>{count}</p>
                <p className={cn("font-medium", config.color)}>{config.label}</p>
                <p className="text-xs text-gray-500 mt-1">{config.description}</p>
              </div>
              {index < stages.length - 1 && (
                <ChevronRight className="h-6 w-6 mx-1 text-gray-300 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Stage Lists */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const config = stageConfig[stage]
          const Icon = config.icon
          const stageRepreneurs = byStage[stage]

          return (
            <Card key={stage} className="overflow-hidden">
              <CardHeader className={cn("py-3", config.bgColor)}>
                <CardTitle className={cn("flex items-center justify-between text-base", config.color)}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </div>
                  <Badge variant="secondary" className="bg-white/80">
                    {stageRepreneurs.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 max-h-80 overflow-y-auto">
                {stageRepreneurs.length > 0 ? (
                  <div className="space-y-1">
                    {stageRepreneurs.map((repreneur) => {
                      const milestoneCount = getMilestoneCount(repreneur as Repreneur)
                      return (
                        <Link
                          key={repreneur.id}
                          href={`/repreneurs/${repreneur.id}`}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate group-hover:text-blue-600">
                              {repreneur.first_name} {repreneur.last_name}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs ml-2 shrink-0">
                            {milestoneCount}/10
                          </Badge>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No repreneurs
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
