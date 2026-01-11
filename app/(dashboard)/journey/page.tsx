import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { JourneyStageBadge } from "@/components/journey/journey-stage-badge"
import { stageConfig } from "@/lib/journey-config"
import { Compass, BookOpen, FileCheck, Trophy, ArrowRight, CheckCircle2, Target, Map as MapIcon } from "lucide-react"
import Link from "next/link"
import type { JourneyStage, Repreneur } from "@/lib/types/repreneur"
import { extractMilestones, countMilestones, deriveJourneyStage } from "@/lib/utils/journey-derivation"

// Cache for 30 seconds - prevents re-fetching on rapid navigation
export const revalidate = 30

const stages: JourneyStage[] = ["explorer", "learner", "ready", "serial_acquirer"]

const stageIcons: Record<JourneyStage, React.ElementType> = {
  explorer: Compass,
  learner: BookOpen,
  ready: FileCheck,
  serial_acquirer: Trophy,
}

const stageDetails: Record<JourneyStage, string> = {
  explorer: "Typically new leads who are still learning about the process",
  learner: "Attending training, workshops, or actively researching",
  ready: "Has financing, knows their criteria, ready to make offers",
  serial_acquirer: "Has successfully completed at least one acquisition",
}

// Helper to calculate milestone count for a repreneur
function getMilestoneCount(repreneur: Repreneur): number {
  const milestones = extractMilestones(repreneur as any)
  return countMilestones(milestones)
}

// Helper to derive journey stage from milestones
function getDerivedStage(repreneur: Repreneur): JourneyStage {
  const milestoneCount = getMilestoneCount(repreneur)
  return deriveJourneyStage(milestoneCount, repreneur.persona)
}

export default async function JourneyPage() {
  const supabase = await createClient()

  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  // Group repreneurs by derived journey stage (from milestones)
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

  // Calculate milestone stats
  const allMilestoneCounts = repreneurs?.map(r => getMilestoneCount(r as Repreneur)) || []
  const totalMilestonesCompleted = allMilestoneCounts.reduce((sum, count) => sum + count, 0)
  const avgMilestones = totalRepreneurs > 0 ? (totalMilestonesCompleted / totalRepreneurs).toFixed(1) : "0"

  // Calculate average milestones per stage
  const avgByStage = stages.reduce((acc, stage) => {
    const stageRepreneurs = byStage[stage]
    const stageMilestones = stageRepreneurs.map(r => getMilestoneCount(r as Repreneur))
    const stageTotal = stageMilestones.reduce((sum, count) => sum + count, 0)
    acc[stage] = stageRepreneurs.length > 0 ? (stageTotal / stageRepreneurs.length).toFixed(1) : "0"
    return acc
  }, {} as Record<JourneyStage, string>)

  // Milestone completion distribution (how many repreneurs have X milestones)
  const milestoneDistribution = Array.from({ length: 11 }, (_, i) =>
    allMilestoneCounts.filter(count => count === i).length
  )

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

      {/* Milestone Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Total Milestones</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalMilestonesCompleted}</div>
            <p className="text-sm text-muted-foreground">
              completed across all repreneurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">Average Progress</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgMilestones}<span className="text-lg text-muted-foreground">/10</span></div>
            <Progress value={parseFloat(avgMilestones) * 10} className="mt-2 h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              milestones per repreneur
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-base">Stage Averages</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stages.map((stage) => {
                const config = stageConfig[stage]
                return (
                  <div key={stage} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{config.label}</span>
                    <Badge variant="outline" className="font-mono">
                      {avgByStage[stage]}/10
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Columns */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const Icon = stageIcons[stage]
          const config = stageConfig[stage]
          const stageRepreneurs = byStage[stage]

          return (
            <Card key={stage} className="h-fit overflow-hidden pt-0 gap-0">
              <CardHeader className={`${config.color} py-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="bg-white/80">
                    {stageRepreneurs.length}
                  </Badge>
                </div>
                <CardDescription className={config.color.includes("text-") ? "" : "text-gray-600"}>
                  {config.description}
                </CardDescription>
                <p className="text-xs opacity-70 mt-1">{stageDetails[stage]}</p>
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
    </div>
  )
}
