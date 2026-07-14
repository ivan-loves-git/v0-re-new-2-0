"use client"

import { Activity, BarChart3, Palette, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { KpiMetricGrid, KpiMetricTile } from "@/components/ui/kpi-metric-tile"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import { WaveAreaChart, WaveBarChart, WaveRadarChart } from "@/components/wave/charts"
import {
  WaveMicroLabel,
  WavePanel,
  WaveSegmentedMetric,
  WaveSegmentedSummary,
  WaveSemanticPanel,
} from "@/components/wave/visual-foundations"
import { useCollectionFilters } from "@/hooks/use-collection-filters"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"

const FILTERS: CollectionFilterDefinition[] = [
  { key: "status", label: "Status", options: [
    { value: "qualified", label: "Qualified" },
    { value: "client", label: "Client" },
  ] },
  { key: "journey", label: "Journey", options: [
    { value: "learner", label: "Learner" },
    { value: "ready", label: "Ready" },
  ] },
  { key: "source", label: "Source", options: [
    { value: "referral", label: "Referral" },
    { value: "event", label: "Event" },
  ] },
]

const trendData = [
  { month: "Feb", repreneurs: 24, clients: 3 },
  { month: "Mar", repreneurs: 31, clients: 5 },
  { month: "Apr", repreneurs: 38, clients: 6 },
  { month: "May", repreneurs: 46, clients: 8 },
  { month: "Jun", repreneurs: 57, clients: 11 },
]

const distributionData = [
  { stage: "Explorer", count: 22 },
  { stage: "Learner", count: 17 },
  { stage: "Ready", count: 11 },
  { stage: "Execution", count: 7 },
]

const profileData = [
  { dimension: "Experience", score: 78 },
  { dimension: "Leadership", score: 64 },
  { dimension: "M&A", score: 55 },
  { dimension: "Readiness", score: 81 },
  { dimension: "Finance", score: 70 },
]

const VISUAL_RULES = [
  ["Compact labels", "Uppercase micro-labels are retained and must use the governed WAVE pattern."],
  ["Container edges", "One neutral full border. No colored side or top stripes."],
  ["Persistent panels", "Eight-pixel radius, quiet border, no wide soft shadow."],
  ["Semantic emphasis", "Light token-based tint with a complete one-pixel border."],
  ["Metric summaries", "Related values share one segmented surface."],
  ["Page surfaces", "Flat canvas and muted headers. No decorative gradients."],
  ["Color language", "Re-New semantic tokens only. No isolated purple or decorative stripes."],
  ["Motion", "State feedback only. No staggered page-load choreography."],
]

export default function DesignSystemPage() {
  const filters = useCollectionFilters({ definitions: FILTERS })
  const activeCount = Object.values(filters.values).filter(Boolean).length
  const resultCount = Math.max(3, 57 - activeCount * 14 - (filters.search ? 9 : 0))

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <SectionPageHeader
        title="WAVE Product UI"
        subtitle="The approved components and data language for a calmer, more coherent Wave 2.0."
        icon={Palette}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Governed visual language</h2>
          <p className="text-sm text-muted-foreground">These defaults apply to every new screen and component. They are implementation rules, not product strategy.</p>
        </div>

        <WavePanel asChild>
          <div>
            <div className="wave-section-header">
              <div>
                <WaveMicroLabel>Re-New visual contract</WaveMicroLabel>
                <h3 className="mt-1 text-base font-semibold">Quiet operational confidence</h3>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">Impeccable may test visual implementation against these rules. It may not redefine KPIs, workflows, filters, hierarchy, architecture, or strategy.</p>
            </div>
            <div className="divide-y">
              {VISUAL_RULES.map(([rule, defaultTreatment]) => (
                <div key={rule} className="grid gap-1 px-5 py-3 sm:grid-cols-[180px_1fr] sm:gap-5">
                  <p className="text-sm font-medium text-foreground">{rule}</p>
                  <p className="text-sm text-muted-foreground">{defaultTreatment}</p>
                </div>
              ))}
            </div>
          </div>
        </WavePanel>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
          <WaveSegmentedSummary>
            <WaveSegmentedMetric value="14" label="Milestones" />
            <WaveSegmentedMetric value="32" label="Product updates" />
            <WaveSegmentedMetric value="21" label="UX improvements" />
            <WaveSegmentedMetric value="18" label="QA / audits" />
          </WaveSegmentedSummary>
          <WaveSemanticPanel className="flex flex-col justify-center gap-1 px-4 py-3">
            <WaveMicroLabel>Semantic emphasis</WaveMicroLabel>
            <p className="text-sm text-foreground">A restrained tint communicates importance without becoming a promotional card.</p>
          </WaveSemanticPanel>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Operational metrics</h2>
          <p className="text-sm text-muted-foreground">Consistent hierarchy, compact density, and semantic tones.</p>
        </div>
        <KpiMetricGrid>
          <KpiMetricTile title="Active repreneurs" value="57" period="Current portfolio" icon={Users} tone="repreneur" trend={{ value: "12%", direction: "up", tone: "positive" }} info={{ title: "Active repreneurs", description: "People currently progressing through the acquisition journey." }} />
          <KpiMetricTile title="Client conversion" value="19%" period="Last 90 days" icon={Activity} tone="score" trend={{ value: "3 pts", direction: "up", tone: "positive" }} info={{ title: "Client conversion", description: "Qualified repreneurs who became paying clients." }} />
          <KpiMetricTile title="Open opportunities" value="31" period="Live inventory" icon={BarChart3} tone="opportunity" trend={{ value: "4", direction: "up", tone: "neutral" }} info={{ title: "Open opportunities", description: "Opportunities available for matching or active pursuit." }} />
        </KpiMetricGrid>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Progressive collection filtering</h2>
          <p className="text-sm text-muted-foreground">Search stays visible; optional criteria appear only when chosen.</p>
        </div>
        <CollectionFilterBar search={filters.search} onSearchChange={filters.setSearch} searchPlaceholder="Search repreneurs..." definitions={FILTERS} values={filters.values} onFilterChange={filters.setFilter} onFilterRemove={filters.removeFilter} onClearFilters={filters.clearFilters} onReset={filters.reset} resultCount={resultCount} totalCount={57} resultLabel="repreneur" />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">WAVE charts</h2>
          <p className="text-sm text-muted-foreground">EvilCharts foundations, customized for Re-New and exposed through one stable product API.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Portfolio growth</CardTitle><CardDescription>Area charts for development over time.</CardDescription></CardHeader>
            <CardContent><WaveAreaChart data={trendData} label="Portfolio growth example" xKey="month" series={[{ key: "repreneurs", label: "Repreneurs" }, { key: "clients", label: "Clients" }]} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Journey distribution</CardTitle><CardDescription>Bars for clear category comparison.</CardDescription></CardHeader>
            <CardContent><WaveBarChart data={distributionData} label="Journey distribution example" xKey="stage" series={[{ key: "count", label: "Repreneurs" }]} /></CardContent>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader><CardTitle>Profile balance</CardTitle><CardDescription>Radar charts only when dimensions share a comparable scale.</CardDescription></CardHeader>
            <CardContent className="mx-auto w-full max-w-xl"><WaveRadarChart data={profileData} label="Repreneur profile example" categoryKey="dimension" series={[{ key: "score", label: "Score" }]} /></CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
