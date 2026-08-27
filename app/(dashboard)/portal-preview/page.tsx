import Link from "next/link"
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { StaffPortalPreviewSelector } from "@/components/repreneurs/staff-portal-preview-selector"
import {
  getStaffPortalPreviewOpportunity,
  getStaffPortalPreviewProfile,
  listStaffPortalPreviewOpportunities,
  listStaffPortalPreviewOptions,
} from "@/lib/actions/repreneur-portal-preview"
import { readPortalCurrentPursuit } from "@/lib/data/current-pursuit"
import {
  createPortalPreviewDealHrefMap,
  createPortalPreviewHref,
  resolvePortalPreviewRepreneur,
} from "@/lib/portal-preview-routes"
import { isUuid } from "@/lib/uuid"


interface StaffPortalPreviewPageProps {
  searchParams: Promise<{
    repreneurId?: string
    matchId?: string
    view?: string
  }>
}

export default async function StaffPortalPreviewPage({ searchParams }: StaffPortalPreviewPageProps) {
  const params = await searchParams
  const options = await listStaffPortalPreviewOptions()
  const requestedRepreneurId = params.repreneurId
  const selectedOption = resolvePortalPreviewRepreneur(options, requestedRepreneurId)
  const selectedRepreneurId = selectedOption?.id ?? null
  const hasUnknownRepreneur = requestedRepreneurId !== undefined && !selectedOption
  const selectedMatchId = params.matchId && isUuid(params.matchId) ? params.matchId : null

  const [profileData, opportunityData, selectedOpportunity] = selectedRepreneurId
    ? await Promise.all([
        getStaffPortalPreviewProfile(selectedRepreneurId),
        listStaffPortalPreviewOpportunities(selectedRepreneurId),
        selectedMatchId ? getStaffPortalPreviewOpportunity(selectedRepreneurId, selectedMatchId) : Promise.resolve(null),
      ])
    : [
        { repreneur: null },
        { repreneur: null, opportunities: [] },
        null,
      ]

  const defaultTab = params.view === "profile" ? "profile" : "deals"
  const detailHrefByOpportunityId = selectedRepreneurId
    ? createPortalPreviewDealHrefMap(
        selectedRepreneurId,
        opportunityData.opportunities.map((opportunity) => ({
          opportunityId: opportunity.opportunity_id,
          matchId: opportunity.match_id,
        })),
      )
    : {}
  const previewJourney = selectedRepreneurId && selectedOpportunity?.match_id && selectedOpportunity.match_status === "active_pursuit"
    ? await readPortalCurrentPursuit({
        matchId: selectedOpportunity.match_id,
        viewer: { kind: "staff-preview", repreneurId: selectedRepreneurId },
      })
    : null

  return (
    <div className="space-y-6">
      <SectionPageHeader
        title="Portal preview"
        subtitle="Staff-only view of the external repreneur portal"
        icon={Eye}
        tone="repreneur"
      />

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <ShieldCheck className="size-3" />
              Staff only
            </Badge>
            {selectedOption?.hasPortalAccess ? (
              <Badge variant="outline">Portal access enabled</Badge>
            ) : (
              <Badge variant="outline">Portal access not enabled</Badge>
            )}
            {selectedOption && <Badge variant="outline">{selectedOption.visibleOpportunityCount} visible deal(s)</Badge>}
            {selectedOption?.isDemo ? <Badge variant="outline">DEMO namespace</Badge> : null}
          </div>
          <div>
            <p className="text-sm font-medium">Preview as</p>
            <p className="text-sm text-muted-foreground">Responses are disabled while previewing.</p>
          </div>
        </div>
        <StaffPortalPreviewSelector options={options} selectedRepreneurId={selectedRepreneurId} />
      </section>

      {options.length === 0 && (
        <Alert>
          <Eye />
          <AlertTitle>No repreneurs found</AlertTitle>
          <AlertDescription>Add a repreneur before using the portal preview.</AlertDescription>
        </Alert>
      )}

      {hasUnknownRepreneur && (
        <Alert>
          <Eye />
          <AlertTitle>Repreneur not found</AlertTitle>
          <AlertDescription>Select a repreneur to open their portal preview.</AlertDescription>
        </Alert>
      )}

      {selectedRepreneurId && selectedMatchId && selectedOpportunity && (
        <div className="flex flex-col gap-6">
          <Button asChild variant="ghost" className="w-fit">
            <Link href={createPortalPreviewHref(selectedRepreneurId)}>
              <ArrowLeft data-icon="inline-start" />
              Back to preview
            </Link>
          </Button>
          <RepreneurOpportunityDetail
            opportunity={selectedOpportunity}
            readOnly
            journey={previewJourney}
            documentHrefForDocument={(document) =>
              `/portal-preview/deals/${selectedOpportunity.match_id}/documents/${document.id}?repreneurId=${selectedRepreneurId}`
            }
          />
        </div>
      )}

      {selectedRepreneurId && selectedMatchId && !selectedOpportunity && (
        <Alert>
          <Eye />
          <AlertTitle>Deal not visible in portal preview</AlertTitle>
          <AlertDescription>This match is not available in the selected repreneur's portal view.</AlertDescription>
        </Alert>
      )}

      {selectedRepreneurId && !selectedMatchId && (
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
          <TabsContent value="deals">
            <RepreneurOpportunityList
              repreneur={opportunityData.repreneur}
              opportunities={opportunityData.opportunities}
              detailHrefByOpportunityId={detailHrefByOpportunityId}
              detailLabel="Preview detail"
              readOnly
            />
          </TabsContent>
          <TabsContent value="profile">
            <RepreneurProfileSummary
              repreneur={profileData.repreneur}
              opportunities={opportunityData.opportunities}
              dealsHref={createPortalPreviewHref(selectedRepreneurId)}
              detailHrefByOpportunityId={detailHrefByOpportunityId}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
