import { Eye, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { TabsContent } from "@/components/ui/tabs"
import { PreviewLanguageScope, StaffEnglishBoundary } from "@/components/i18n/preview-language-scope"
import { StaffPortalPreviewAreas } from "@/components/repreneurs/staff-portal-preview-areas"
import { previewUiLanguage } from "@/lib/i18n/server-language"
import { PortalDealsContent } from "@/components/portal/portal-deals-content"
import { PortalProfileContent } from "@/components/portal/portal-profile-content"
import { PortalPursuitsContent } from "@/components/portal/portal-pursuits-content"
import { parseRepreneurDealSort } from "@/lib/utils/repreneur-deal-flow"
import { unavailablePortalNextActions } from "@/lib/portal-next-actions"
import { RepreneurPursuitWorkspace, type SidebarDeal } from "@/components/portal/repreneur-pursuit-workspace"
import { StaffPortalPreviewSelector } from "@/components/repreneurs/staff-portal-preview-selector"
import { StaffPortalPreviewTabs } from "@/components/repreneurs/staff-portal-preview-tabs"
import { StaffOpportunityResponseControls } from "@/components/repreneurs/staff-opportunity-response-controls"
import { StaffTargetThesisAction } from "@/components/repreneurs/staff-target-thesis-action"
import { StaffLdcAssistance } from "@/components/repreneurs/staff-ldc-assistance"
import { StaffReceivedNdaUpload } from "@/components/repreneurs/staff-received-nda-upload"
import { getExternalPursuitAttachmentMap } from "@/lib/actions/external-pursuit-attachments"
import {
  getStaffPortalPreviewProfile,
  getStaffPortalPreviewOpportunity,
  listStaffPortalPreviewOwnedOpportunities,
  listStaffPortalPreviewExternalPursuits,
  listStaffPortalPreviewOpportunities,
  listStaffPortalPreviewOptions,
} from "@/lib/actions/repreneur-portal-preview"
import { requireStaffAccess } from "@/lib/access-control"
import { readPortalCurrentPursuit, readPortalDealActionIndicators } from "@/lib/data/current-pursuit"
import { readPortalNextActions } from "@/lib/data/portal-next-actions"
import {
  createPortalPreviewDealHrefMap,
  createPortalPreviewDocumentHref,
  createPortalPreviewHref,
  resolvePortalPreviewRepreneur,
  type PortalPreviewPursuitStatus,
  type PortalPreviewSection,
} from "@/lib/portal-preview-routes"
import { isUuid } from "@/lib/uuid"
import { createAdminClient } from "@/lib/supabase/admin"
import { currentStaffPortalSelectionToken, parseStaffPortalSelection } from "@/lib/staff-portal-selection"
import { interestWithdrawalOperationsPaused } from "@/lib/interest-withdrawal-operations"

interface StaffPortalPreviewPageProps {
  searchParams: Promise<{
    repreneurId?: string
    dealId?: string
    matchId?: string
    view?: string
    workspaceId?: string
    q?: string
    status?: string
    returnView?: string
    sort?: string
  }>
}

export default async function StaffPortalPreviewPage({ searchParams }: StaffPortalPreviewPageProps) {
  const access = await requireStaffAccess()
  const previewLanguage = await previewUiLanguage()
  const params = await searchParams
  const options = await listStaffPortalPreviewOptions()
  const requestedRepreneurId = params.repreneurId
  const selectedOption = resolvePortalPreviewRepreneur(options, requestedRepreneurId)
  const selectedRepreneurId = selectedOption?.id ?? null
  const workspaceId = isUuid(params.workspaceId ?? "") ? params.workspaceId! : null
  const hasUnknownRepreneur = requestedRepreneurId !== undefined && !selectedOption
  const requestedDealId = params.dealId ?? params.matchId
  const invalidDealSelection = requestedDealId !== undefined && (
    !isUuid(requestedDealId) || (params.dealId !== undefined && params.matchId !== undefined && params.dealId !== params.matchId)
  )
  const selectedDealId = !invalidDealSelection ? requestedDealId ?? null : null
  const section: PortalPreviewSection = params.view === "profile" || params.view === "renew-pursuits" || params.view === "external-pursuits"
    ? params.view
    : "deals"
  const status: PortalPreviewPursuitStatus = params.status === "active" || params.status === "awaiting" || params.status === "ended"
    ? params.status : "all"
  const sort = parseRepreneurDealSort(params.sort)
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : ""
  const returnView: PortalPreviewSection = params.returnView === "profile" || params.returnView === "renew-pursuits" || params.returnView === "external-pursuits"
    ? params.returnView : "deals"
  const selectedOwnerToken = selectedRepreneurId
    ? await currentStaffPortalSelectionToken(workspaceId ?? undefined, selectedRepreneurId, access.user.id) : null
  const selectedOwnerSelection = selectedOwnerToken && selectedRepreneurId
    ? parseStaffPortalSelection(selectedOwnerToken, selectedRepreneurId, access.user.id) : null
  const currentWorkspace = !workspaceId || Boolean(selectedOwnerToken)

  // Only the selected screen reads its required projection. The cross-space
  // next-actions panel needs owned matches, never the full live Deal Flow.
  const readable = Boolean(selectedRepreneurId && currentWorkspace && !invalidDealSelection)
  const [profileData, dealFlow, ownedSource, externalPursuits, selectedOpportunity] = await Promise.all([
    readable && section === "profile" && !selectedDealId
      ? getStaffPortalPreviewProfile(selectedRepreneurId!) : Promise.resolve({ repreneur: null }),
    readable && section === "deals" && !selectedDealId
      ? listStaffPortalPreviewOpportunities(selectedRepreneurId!, undefined, sort) : Promise.resolve(null),
    readable && (selectedDealId || section !== "deals")
      ? listStaffPortalPreviewOwnedOpportunities(selectedRepreneurId!).catch((error: unknown) => {
          // External owned matches are supplemental summary inputs. Required
          // profile, Re-New and detail reads retain their normal failure boundary.
          if (section === "external-pursuits" && !selectedDealId) return null
          throw error
        }) : Promise.resolve({ repreneur: null, opportunities: [] }),
    readable && section === "external-pursuits" && !selectedDealId
      ? listStaffPortalPreviewExternalPursuits(selectedRepreneurId!) : Promise.resolve([]),
    readable && selectedDealId
      ? getStaffPortalPreviewOpportunity(selectedRepreneurId!, selectedDealId) : Promise.resolve(null),
  ])
  const ownedData = ownedSource ?? { repreneur: null, opportunities: [] }
  const opportunityData = dealFlow ?? ownedData
  const detailHrefByOpportunityId = selectedRepreneurId
    ? createPortalPreviewDealHrefMap(selectedRepreneurId, opportunityData.opportunities.map((opportunity) => ({
        opportunityId: opportunity.opportunity_id, matchId: opportunity.match_id,
      })), workspaceId, { returnView: section, sort }) : {}
  const workspaceDeals = opportunityData.opportunities.filter((deal): deal is typeof deal & {
    match_id: string
    match_status: NonNullable<typeof deal.match_status>
  } => Boolean(deal.match_id && deal.match_status))
  const sidebarDeals: SidebarDeal[] = workspaceDeals.map((deal) => ({
    match_id: deal.match_id,
    match_status: deal.match_status,
    pursuit_stage: deal.pursuit_stage,
    interest_rejected: deal.interest_rejected,
    recommendation_expires_at: deal.recommendation_expires_at,
    public_title: deal.public_title,
    canonical_sector: deal.canonical_sector,
    sector: deal.sector,
    activity: deal.activity,
    geography_label: deal.geography_label,
    location: deal.location,
  }))
  const [actions, previewJourney, opportunityVersion, attachmentsByPursuit] = await Promise.all([
    selectedRepreneurId && currentWorkspace && (selectedOpportunity || section === "renew-pursuits")
      ? readPortalDealActionIndicators(workspaceDeals.map((deal) => deal.match_id), {
          kind: "staff-preview", repreneurId: selectedRepreneurId,
        }) : Promise.resolve({}),
    selectedRepreneurId && selectedOpportunity?.match_id && selectedOpportunity.match_status === "active_pursuit"
      ? readPortalCurrentPursuit({ matchId: selectedOpportunity.match_id,
          viewer: { kind: "staff-preview", repreneurId: selectedRepreneurId } }) : Promise.resolve(null),
    selectedOpportunity && selectedOwnerToken
      ? createAdminClient().from("opportunities").select("updated_at")
          .eq("id", selectedOpportunity.opportunity_id).maybeSingle() : Promise.resolve(null),
    externalPursuits.length
      ? getExternalPursuitAttachmentMap(externalPursuits.map((pursuit) => pursuit.id)) : Promise.resolve({}),
  ])
  const opportunityUpdatedAt = opportunityVersion?.data?.updated_at ?? null
  const nextActions = selectedRepreneurId && selectedOwnerToken && currentWorkspace && !selectedDealId
    && (section === "renew-pursuits" || section === "external-pursuits")
    ? ownedSource === null ? unavailablePortalNextActions()
      : await readPortalNextActions({ kind: "staff-preview", repreneurId: selectedRepreneurId,
        selectionToken: selectedOwnerToken }, ownedData, {
          indicators: section === "renew-pursuits" ? actions : undefined,
          external: section === "external-pursuits" ? externalPursuits : undefined,
        })
    : null
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
            {selectedOption && dealFlow && <Badge variant="outline">{dealFlow.deals.length} visible deal(s)</Badge>}
            {selectedOption?.isDemo ? <Badge variant="outline">DEMO namespace</Badge> : null}
          </div>
          <div>
            <p className="text-sm font-medium">{selectedOption ? `Selected repreneur: ${selectedOption.name}` : "Select a repreneur"}</p>
            <p className="text-sm text-muted-foreground">Signed in as staff: {staffName}. A role link does not verify sign-in or grant portal access; you are not signed in as this repreneur.</p>
          </div>
        </div>
        <StaffPortalPreviewSelector options={options} selectedRepreneurId={selectedRepreneurId}
          workspaceId={workspaceId} selectionToken={selectedOwnerToken} />
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

      {selectedRepreneurId && workspaceId && !selectedOwnerToken && (
        <Alert><Eye /><AlertTitle>Staff workspace changed</AlertTitle>
          <AlertDescription>This browser workspace now belongs to another selected repreneur. Choose a repreneur again before acting.</AlertDescription>
        </Alert>
      )}

      <PreviewLanguageScope initialLanguage={previewLanguage}>
      {selectedRepreneurId && selectedDealId && selectedOpportunity && (
        <RepreneurPursuitWorkspace
          key={JSON.stringify([selectedRepreneurId, workspaceId, selectedDealId, query, status, returnView])}
          opportunity={selectedOpportunity}
          deals={sidebarDeals}
          actions={actions}
          journey={previewJourney}
          responseAsOf={new Date().toISOString()}
          withdrawalPaused={interestWithdrawalOperationsPaused()}
          initialQuery={query}
          initialStatus={status}
          returnHref={createPortalPreviewHref(selectedRepreneurId, undefined, workspaceId, { query, status, view: returnView, sort })}
          staffPreview={{
            repreneurId: selectedRepreneurId,
            workspaceId,
            returnView,
            sort,
            documentHrefs: selectedOpportunity.match_id && workspaceId && selectedOwnerSelection ? {
              ndaTemplate: createPortalPreviewDocumentHref(selectedRepreneurId, selectedOpportunity.match_id, { kind: "nda-template" }, workspaceId, selectedOwnerSelection.generation),
              ...(previewJourney?.confidentialGrant ? {
                informationMemorandum: createPortalPreviewDocumentHref(selectedRepreneurId, selectedOpportunity.match_id, {
                  kind: "information-memorandum",
                  documentId: previewJourney.confidentialGrant.informationMemoDocumentId,
                }, workspaceId, selectedOwnerSelection.generation),
              } : {}),
            } : undefined,
          }}
          staffAssistanceControls={opportunityUpdatedAt && selectedOption && selectedOwnerToken ? <StaffEnglishBoundary key="staff-response"><StaffOpportunityResponseControls
              selectionToken={selectedOwnerToken}
              repreneurId={selectedOption.id}
              repreneurName={selectedOption.name}
              opportunityId={selectedOpportunity.opportunity_id}
              opportunityTitle={selectedOpportunity.public_title || "Confidential acquisition opportunity"}
              matchId={selectedOpportunity.match_id}
              matchStatus={selectedOpportunity.match_status}
              expectedOpportunityUpdatedAt={opportunityUpdatedAt}
              expectedMatchUpdatedAt={selectedOpportunity.match_id ? selectedOpportunity.updated_at : null}
              expectedInterestAt={selectedOpportunity.match_id ? selectedOpportunity.interest_expressed_at ?? null : null}
              interestRejected={Boolean(selectedOpportunity.interest_rejected)}
              recommendationExpiresAt={selectedOpportunity.recommendation_expires_at}
              withdrawalPaused={interestWithdrawalOperationsPaused()}
            /></StaffEnglishBoundary> : null}
          staffDocumentAssistanceControls={selectedOption && selectedOwnerToken && selectedOpportunity.match_id
              && previewJourney?.enabled && previewJourney.ndaReadyNotified
              && !previewJourney.revoked && (previewJourney.signedCopyState === "not_submitted" || previewJourney.signedCopyState === "awaiting_validation")
              ? <StaffEnglishBoundary key="staff-document"><StaffReceivedNdaUpload matchId={selectedOpportunity.match_id} selectionToken={selectedOwnerToken}
                  repreneurId={selectedOption.id} repreneurName={selectedOption.name} /></StaffEnglishBoundary> : null}
        />
      )}

      {selectedRepreneurId && selectedDealId && currentWorkspace && !selectedOpportunity && (
        <Alert>
          <Eye />
          <AlertTitle>Deal not visible in portal preview</AlertTitle>
          <AlertDescription>This match is not available in the selected repreneur's portal view.</AlertDescription>
        </Alert>
      )}

      {selectedRepreneurId && currentWorkspace && !selectedDealId && !invalidDealSelection && (
        <StaffPortalPreviewTabs key={selectedRepreneurId} repreneurId={selectedRepreneurId} workspaceId={workspaceId} section={section}>
          <div className="overflow-x-auto"><StaffPortalPreviewAreas repreneurId={selectedRepreneurId} workspaceId={workspaceId} /></div>
          {section === "deals" && dealFlow ? <TabsContent value="deals">
            <PortalDealsContent result={dealFlow} sort={sort} staffPreview={{
              profileHref: `${createPortalPreviewHref(selectedRepreneurId, undefined, workspaceId, { view: "profile" })}#target-thesis`,
              detailHrefByOpportunityId,
            }} />
          </TabsContent> : null}
          {section === "profile" ? <TabsContent value="profile">
            <PortalProfileContent
              repreneur={profileData.repreneur}
              opportunities={ownedData.opportunities}
              dealsHref={createPortalPreviewHref(selectedRepreneurId, undefined, workspaceId)}
              detailHrefByOpportunityId={detailHrefByOpportunityId}
              mode="staff-preview"
              staffTargetThesisAction={profileData.repreneur && selectedOwnerToken ? <StaffEnglishBoundary><StaffTargetThesisAction repreneur={profileData.repreneur} selectionToken={selectedOwnerToken} /></StaffEnglishBoundary> : null}
              staffDocumentAssistanceAction={profileData.repreneur && selectedOption && selectedOwnerToken
                ? <StaffEnglishBoundary><StaffLdcAssistance repreneurId={selectedOption.id} repreneurName={selectedOption.name} selectionToken={selectedOwnerToken} /></StaffEnglishBoundary> : null}
            />
          </TabsContent> : null}
          {section === "renew-pursuits" || section === "external-pursuits" ? <TabsContent value={section}>
            <PortalPursuitsContent key={`${selectedRepreneurId}:${workspaceId}:${section}`}
              view={section === "external-pursuits" ? "external" : "renew"}
              deals={section === "renew-pursuits" ? sidebarDeals : []}
              actions={actions} responseAsOf={new Date().toISOString()}
              initialQuery={query} initialStatus={status}
              external={externalPursuits} attachmentsByPursuit={attachmentsByPursuit}
              nextActions={nextActions ?? unavailablePortalNextActions()}
              staffPreview={{ repreneurId: selectedRepreneurId, workspaceId, selectionToken: selectedOwnerToken ?? undefined, ownerName: selectedOption?.name }} />
          </TabsContent> : null}
        </StaffPortalPreviewTabs>
      )}
      </PreviewLanguageScope>
    </div>
  )
}
