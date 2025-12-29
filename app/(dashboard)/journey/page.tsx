import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { JourneyStageBadge, stageConfig } from "@/components/journey/journey-stage-badge"
import { Compass, BookOpen, FileCheck, Trophy, ArrowRight, User } from "lucide-react"
import Link from "next/link"
import type { JourneyStage, Repreneur } from "@/lib/types/repreneur"

const stages: JourneyStage[] = ["explorer", "learner", "ready", "serial_acquirer"]

const stageIcons: Record<JourneyStage, React.ElementType> = {
  explorer: Compass,
  learner: BookOpen,
  ready: FileCheck,
  serial_acquirer: Trophy,
}

export default async function JourneyPage() {
  const supabase = await createClient()

  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  // Group repreneurs by journey stage
  const byStage = stages.reduce(
    (acc, stage) => {
      acc[stage] = repreneurs?.filter((r) => r.journey_stage === stage) || []
      return acc
    },
    {} as Record<JourneyStage, Repreneur[]>,
  )

  // Count repreneurs without a journey stage
  const unassigned = repreneurs?.filter((r) => !r.journey_stage) || []

  const totalRepreneurs = repreneurs?.length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Repreneur Journey</h1>
        <p className="text-gray-600 mt-1">Track repreneurs through their acquisition readiness journey</p>
      </div>

      {/* Journey Progress Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Journey Overview</CardTitle>
          <CardDescription>Visual representation of repreneur distribution across journey stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 py-4">
            {stages.map((stage, index) => {
              const Icon = stageIcons[stage]
              const config = stageConfig[stage]
              const count = byStage[stage].length
              const percentage = totalRepreneurs > 0 ? Math.round((count / totalRepreneurs) * 100) : 0

              return (
                <div key={stage} className="flex items-center flex-1">
                  <div className="flex-1">
                    <div
                      className={`rounded-lg p-4 text-center ${config.color} border transition-all hover:shadow-md`}
                    >
                      <Icon className="h-8 w-8 mx-auto mb-2" />
                      <p className="font-semibold text-lg">{count}</p>
                      <p className="text-sm opacity-75">{config.label}</p>
                      <p className="text-xs opacity-60">{percentage}%</p>
                    </div>
                  </div>
                  {index < stages.length - 1 && (
                    <ArrowRight className="h-6 w-6 mx-2 text-gray-300 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
              {stages.map((stage) => {
                const count = byStage[stage].length
                const percentage = totalRepreneurs > 0 ? (count / totalRepreneurs) * 100 : 0
                const config = stageConfig[stage]
                const bgColor = config.color.split(" ")[0] // Extract just the bg color

                return (
                  <div
                    key={stage}
                    className={`${bgColor} transition-all`}
                    style={{ width: `${percentage}%` }}
                    title={`${config.label}: ${count} (${Math.round(percentage)}%)`}
                  />
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unassigned warning */}
      {unassigned.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-800">
              <User className="h-5 w-5" />
              <span className="font-medium">
                {unassigned.length} repreneur{unassigned.length > 1 ? "s" : ""} without a journey stage assigned
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage Columns */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const Icon = stageIcons[stage]
          const config = stageConfig[stage]
          const stageRepreneurs = byStage[stage]

          return (
            <Card key={stage} className="h-fit">
              <CardHeader className={`${config.color} rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-white">
                    {stageRepreneurs.length}
                  </Badge>
                </div>
                <CardDescription className={config.color.includes("text-") ? "" : "text-gray-600"}>
                  {config.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {stageRepreneurs.length > 0 ? (
                  <div className="space-y-2">
                    {stageRepreneurs.slice(0, 5).map((repreneur) => (
                      <Link
                        key={repreneur.id}
                        href={`/repreneurs/${repreneur.id}`}
                        className="block p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-sm">
                          {repreneur.first_name} {repreneur.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{repreneur.email}</p>
                      </Link>
                    ))}
                    {stageRepreneurs.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{stageRepreneurs.length - 5} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No repreneurs</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Stage Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Journey Stages Explained</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {stages.map((stage) => {
              const Icon = stageIcons[stage]
              const config = stageConfig[stage]

              return (
                <div key={stage} className="flex gap-3 p-3 rounded-lg border">
                  <div className={`p-2 rounded-lg ${config.color} h-fit`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                    {stage === "explorer" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Typically new leads who are still learning about the process
                      </p>
                    )}
                    {stage === "learner" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Attending training, workshops, or actively researching
                      </p>
                    )}
                    {stage === "ready" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Has financing, knows their criteria, ready to make offers
                      </p>
                    )}
                    {stage === "serial_acquirer" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Has successfully completed at least one acquisition
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
