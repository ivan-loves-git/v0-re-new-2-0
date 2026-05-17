import { CalendarDays, MapPin, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MaSourcePanel } from "@/components/opportunities/ma-source-panel"
import { OpportunityDocumentsPanel } from "@/components/opportunities/opportunity-documents-panel"
import { OpportunityForm } from "@/components/opportunities/opportunity-form"
import { OpportunityMatchesPanel } from "@/components/opportunities/opportunity-matches-panel"
import { OpportunityPursuitPanel } from "@/components/opportunities/opportunity-pursuit-panel"
import { OpportunityStatusBadge, OpportunityVisibilityBadge } from "@/components/opportunities/opportunity-status-badge"
import type { OpportunityDocument, OpportunityMatch, OpportunityMatchCandidate, OpportunityPursuitEvent, OpportunityWithSource } from "@/lib/types/opportunity"

interface OpportunityDetailProps {
  opportunity: OpportunityWithSource
  documents: OpportunityDocument[]
  matches: OpportunityMatch[]
  matchCandidates: OpportunityMatchCandidate[]
  pursuitEvents: OpportunityPursuitEvent[]
  updateAction: (formData: FormData) => Promise<void>
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "-"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function OpportunityDetail({ opportunity, documents, matches, matchCandidates, pursuitEvents, updateAction }: OpportunityDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <OpportunityStatusBadge status={opportunity.status} />
            <OpportunityVisibilityBadge visibility={opportunity.repreneur_visibility} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{opportunity.reference}</p>
            <h1 className="text-2xl font-semibold tracking-normal">{opportunity.public_title || opportunity.sector || "Opportunity"}</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {opportunity.location ?? "No location"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              {formatDate(opportunity.date_added)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {opportunity.headcount ?? "-"} people
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="pursuit">Pursuit</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Revenue</CardDescription>
                <CardTitle>{formatNumber(opportunity.revenue_meur, "M EUR")}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>EBITDA</CardDescription>
                <CardTitle>{formatNumber(opportunity.ebitda_keur, "K EUR")}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Headcount</CardDescription>
                <CardTitle>{opportunity.headcount ?? "-"}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Staff View</CardTitle>
                  <CardDescription>Internal opportunity context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Sector / activity</p>
                    <p className="font-medium">{[opportunity.sector, opportunity.activity].filter(Boolean).join(" / ") || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="whitespace-pre-wrap text-sm">{opportunity.description || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Staff notes</p>
                    <p className="whitespace-pre-wrap text-sm">{opportunity.staff_notes || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Repreneur-visible Version</CardTitle>
                  <CardDescription>Content eligible for matching or later disclosure.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <OpportunityVisibilityBadge visibility={opportunity.repreneur_visibility} />
                    <Badge variant="outline">Source hidden unless approved</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Public title</p>
                    <p className="font-medium">{opportunity.public_title || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Anonymized description</p>
                    <p className="whitespace-pre-wrap text-sm">{opportunity.anonymized_description || "-"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <MaSourcePanel
              source={opportunity.source}
              sourceLabel={opportunity.source_label}
              sourceVisibility={opportunity.source_visibility}
            />
          </div>
        </TabsContent>

        <TabsContent value="recommendations">
          <OpportunityMatchesPanel opportunityId={opportunity.id} matches={matches} candidates={matchCandidates} />
        </TabsContent>

        <TabsContent value="pursuit">
          <OpportunityPursuitPanel opportunityId={opportunity.id} matches={matches} events={pursuitEvents} />
        </TabsContent>

        <TabsContent value="edit">
          <OpportunityForm opportunity={opportunity} action={updateAction} submitLabel="Save changes" />
        </TabsContent>

        <TabsContent value="documents">
          <OpportunityDocumentsPanel opportunityId={opportunity.id} documents={documents} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
