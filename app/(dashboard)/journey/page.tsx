import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Compass, Crown, Flag, Map, Rocket, Route } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { MILESTONES } from "@/lib/constants/tier-config"
import { createClient } from "@/lib/supabase/server"
import type { JourneyStage, Repreneur } from "@/lib/types/repreneur"
import { countMilestones, deriveJourneyStage, extractMilestones } from "@/lib/utils/journey-derivation"
import { cn } from "@/lib/utils"

const stages: JourneyStage[] = ["explorer", "learner", "ready", "execution", "post_acquisition"]

const stageConfig: Record<JourneyStage, {
  label: string
  summary: string
  icon: typeof Compass
  tone: string
  iconSurface: string
}> = {
  explorer: {
    label: "Explorer",
    summary: "Clarifying the acquisition path",
    icon: Compass,
    tone: "text-muted-foreground",
    iconSurface: "bg-muted",
  },
  learner: {
    label: "Learner",
    summary: "Building the acquisition thesis",
    icon: Map,
    tone: "text-primary",
    iconSurface: "bg-primary/10",
  },
  ready: {
    label: "Ready",
    summary: "Prepared for active deal flow",
    icon: Flag,
    tone: "text-success",
    iconSurface: "bg-success/10",
  },
  execution: {
    label: "Execution",
    summary: "Working on a live acquisition",
    icon: Rocket,
    tone: "text-info",
    iconSurface: "bg-info/10",
  },
  post_acquisition: {
    label: "Post-acquisition",
    summary: "Leading the acquired business",
    icon: Crown,
    tone: "text-warning",
    iconSurface: "bg-warning/10",
  },
}

function getMilestonesForStage(stage: JourneyStage): string[] {
  if (stage === "explorer") return []
  const stageGroup = stage === "learner" ? 1 : stage === "ready" ? 2 : stage === "execution" ? 3 : 4
  return MILESTONES.filter((milestone) => milestone.stageGroup === stageGroup).map((milestone) => milestone.label)
}

function getMilestoneCount(repreneur: Repreneur): number {
  return countMilestones(extractMilestones(repreneur))
}

function getDerivedStage(repreneur: Repreneur): JourneyStage {
  return deriveJourneyStage(extractMilestones(repreneur))
}

export default async function JourneyPage() {
  await connection()

  const supabase = await createClient()
  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .eq("is_demo", false)
    .not("lifecycle_status", "in", "(rejected,declined,to_reactivate)")
    .order("created_at", { ascending: false })

  const byStage = stages.reduce(
    (accumulator, stage) => {
      accumulator[stage] = (repreneurs ?? []).filter(
        (repreneur) => getDerivedStage(repreneur as Repreneur) === stage,
      ) as Repreneur[]
      return accumulator
    },
    {} as Record<JourneyStage, Repreneur[]>,
  )

  const totalRepreneurs = repreneurs?.length ?? 0

  return (
    <div className="flex flex-col gap-5">
      <SectionPageHeader
        title="Journey"
        subtitle="A single operating view of acquisition readiness, from early exploration through post-acquisition leadership."
        icon={Route}
        tone="repreneur"
        actions={<Badge variant="outline">{totalRepreneurs} active repreneur{totalRepreneurs === 1 ? "" : "s"}</Badge>}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Journey at a glance</CardTitle>
          <CardDescription>Each stage is derived from completed readiness milestones.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ol className="grid gap-px bg-border md:grid-cols-5" aria-label="Repreneur journey stages">
            {stages.map((stage, index) => {
              const config = stageConfig[stage]
              const Icon = config.icon
              const milestoneCount = getMilestonesForStage(stage).length

              return (
                <li key={stage} className="flex min-w-0 flex-col gap-4 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", config.iconSurface)}>
                      <Icon className={cn("size-4", config.tone)} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
                      <span className="text-xl font-semibold tabular-nums text-foreground">{byStage[stage].length}</span>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">{config.summary}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {milestoneCount === 0 ? "Starting point" : `${milestoneCount} readiness markers`}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Repreneurs by stage</CardTitle>
          <CardDescription>Open a record to review readiness evidence or plan the next relationship step.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-5">
            {stages.map((stage) => {
              const config = stageConfig[stage]
              const Icon = config.icon
              const stageRepreneurs = byStage[stage]

              return (
                <section key={stage} className="min-w-0 bg-card" aria-labelledby={`journey-stage-${stage}`}>
                  <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                    <h3 id={`journey-stage-${stage}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className={cn("size-4 shrink-0", config.tone)} aria-hidden="true" />
                      <span className="truncate">{config.label}</span>
                    </h3>
                    <Badge variant="secondary">{stageRepreneurs.length}</Badge>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {stageRepreneurs.length > 0 ? (
                      <ul className="divide-y">
                        {stageRepreneurs.map((repreneur) => {
                          const milestoneCount = getMilestoneCount(repreneur)
                          return (
                            <li key={repreneur.id}>
                              <Link
                                href={`/repreneurs/${repreneur.id}`}
                                className="group flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                              >
                                <span className="min-w-0 truncate text-sm font-medium text-foreground group-hover:text-primary">
                                  {repreneur.first_name} {repreneur.last_name}
                                </span>
                                <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                                  {milestoneCount}/17
                                  <ChevronRight className="size-3.5" aria-hidden="true" />
                                </span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="px-4 py-6 text-sm text-muted-foreground">No repreneurs at this stage.</p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
