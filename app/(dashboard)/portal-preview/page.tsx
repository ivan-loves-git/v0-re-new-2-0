import Link from "next/link"
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { StaffPortalPreviewSelector } from "@/components/repreneurs/staff-portal-preview-selector"
import { StaffPortalPreviewTabs } from "@/components/repreneurs/staff-portal-preview-tabs"
import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import { getExternalPursuitAttachmentMap } from "@/lib/actions/external-pursuit-attachments"
import {
  getStaffPortalPreviewProfile,
  listStaffPortalPreviewExternalPursuits,
  listStaffPortalPreviewOpportunities,
  listStaffPortalPreviewOptions,
} from "@/lib/actions/repreneur-portal-preview"
import { requireStaffAccess } from "@/lib/access-control"
import { readPortalCurrentPursuit } from "@/lib/data/current-pursuit"
import {
  createPortalPreviewDealHrefMap,
  createPortalPreviewDocumentHref,
  createPortalPreviewHref,
  resolvePortalPreviewRepreneur,
  type PortalPreviewSection,
} from "@/lib/portal-preview-routes"
import { projectSelectedReNewPursuits } from "@/lib/portal-preview-pursuits"
import { isUuid } from "@/lib/uuid"

interface StaffPortalPreviewPageProps {
  searchParams: Promise<{
    repreneurId?: string
    dealId?: string
    matchId?: string
    view?: string
  }>
}

export default async function StaffPortalPreviewPage({ searchParams }: StaffPortalPreviewPageProps) {
  const access = await requireStaffAccess()
  const params = await searchParams
  const options = await listStaffPortalPreviewOptions()
  const requestedRepreneurId = params.repreneurId
  const selectedOption = resolvePortalPreviewRepreneur(options, requestedRepreneurId)
  const selectedRepreneurId = selectedOption?.id ?? null
  const hasUnknownRepreneur = requestedRepreneurId !== undefined && !selectedOption
  const requestedDealId = params.dealId ?? params.matchId
  const invalidDealSelection = requestedDealId !== undefined && (
    !isUuid(requestedDealId) || (params.dealId !== undefined && params.matchId !== undefined && params.dealId !== params.matchId)
  )
  const selectedDealId = !invalidDealSelection ? requestedDealId ?? null : null
  const section: PortalPreviewSection = params.view === "profile" || params.view === "renew-pursuits" || params.view === "external-pursuits"
    ? params.view
    : "deals"

  const [profileData, opportunityData, externalPursuits] = selectedRepreneurId
    ? await Promise.all([
        section === "profile" ? getStaffPortalPreviewProfile(selectedRepreneurId) : Promise.resolve({ repreneur: null }),
        listStaffPortalPreviewOpportunities(selectedRepreneurId),
        section === "external-pursuits" ? listStaffPortalPreviewExternalPursuits(selectedRepreneurId) : Promise.resolve([]),
      ])
    : [
        { repreneur: null },
        { repreneur: null, opportunities: [] },
        [],
      ]

  const selectedOpportunity = selectedDealId
    ? opportunityData.opportunities.find((opportunity) => opportunity.match_id === selectedDealId || opportunity.opportunity_id === selectedDealId) ?? null
    : null
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
  const renewPursuits = selectedRepreneurId
    ? projectSelectedReNewPursuits(selectedRepreneurId, opportunityData.opportunities)
    : []
  const attachmentsByPursuit = externalPursuits.length
    ? await getExternalPursuitAttachmentMap(externalPursuits.map((pursuit) => pursuit.id))
    : {}
  const staffName = access.user.name?.trim() || access.user.email

  return (
    <div className="space-y-6">
      <SectionPageHeader
        title="Portal preview"
        subtitle="The selected repreneur's portal content, with staff assistance kept under your own identity"
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
            {selectedOption?.portalRoleLinked ? (
              <Badge variant="outline">Portal role linked</Badge>
            ) : (
              <Badge variant="outline">No portal role linked</Badge>
            )}
            {selectedOption && <Badge variant="outline">{opportunityData.opportunities.length} visible deal(s)</Badge>}
            {selectedOption?.isDemo ? <Badge variant="outline">DEMO namespace</Badge> : null}
          </div>
          <div>
            <p className="text-sm font-medium">{selectedOption ? `Selected repreneur: ${selectedOption.name}` : "Select a repreneur"}</p>
            <p className="text-sm text-muted-foreground">Signed in as staff: {staffName}. A role link does not verify sign-in or grant portal access; you are not signed in as this repreneur.</p>
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

      {selectedRepreneurId && invalidDealSelection && (
        <Alert>
          <Eye />
          <AlertTitle>Invalid deal link</AlertTitle>
          <AlertDescription>The selected deal or match link is invalid. Choose a deal from this repreneur's list.</AlertDescription>
        </Alert>
      )}

      {selectedRepreneurId && selectedDealId && selectedOpportunity && (
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
            documentHrefs={selectedOpportunity.match_id ? {
              ndaTemplate: createPortalPreviewDocumentHref(selectedRepreneurId, selectedOpportunity.match_id, { kind: "nda-template" }),
              ...(previewJourney?.confidentialGrant ? {
                informationMemorandum: createPortalPreviewDocumentHref(selectedRepreneurId, selectedOpportunity.match_id, {
                  kind: "information-memorandum",
                  documentId: previewJourney.confidentialGrant.informationMemoDocumentId,
                }),
              } : {}),
            } : undefined}
          />
        </div>
      )}

      {selectedRepreneurId && selectedDealId && !selectedOpportunity && (
        <Alert>
          <Eye />
          <AlertTitle>Deal not visible in portal preview</AlertTitle>
          <AlertDescription>This match is not available in the selected repreneur's portal view.</AlertDescription>
        </Alert>
      )}

      {selectedRepreneurId && !selectedDealId && !invalidDealSelection && (
        <StaffPortalPreviewTabs key={selectedRepreneurId} repreneurId={selectedRepreneurId} section={section}>
          <div className="overflow-x-auto">
            <TabsList aria-label="Selected repreneur portal areas">
              <TabsTrigger value="deals">Deals</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="renew-pursuits">Re-New Pursuits</TabsTrigger>
              <TabsTrigger value="external-pursuits">External Pursuits</TabsTrigger>
            </TabsList>
          </div>
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
              mode="staff-preview"
            />
          </TabsContent>
          <TabsContent value="renew-pursuits">
            <ExternalPursuitBoard key={`${selectedRepreneurId}:renew`} external={[]} renew={renewPursuits} isStaff readOnly selectedOwnerId={selectedRepreneurId} />
          </TabsContent>
          <TabsContent value="external-pursuits">
            <ExternalPursuitBoard
              key={`${selectedRepreneurId}:external`}
              external={externalPursuits}
              renew={[]}
              attachmentsByPursuit={attachmentsByPursuit}
              isStaff
              readOnly
              selectedOwnerId={selectedRepreneurId}
            />
          </TabsContent>
        </StaffPortalPreviewTabs>
      )}
    </div>
  )
}
