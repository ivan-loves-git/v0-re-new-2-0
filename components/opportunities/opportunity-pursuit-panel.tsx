"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useUiLanguage } from "@/components/i18n/ui-text"
import { CheckCircle2, FileCheck2, FileText, History, LockKeyhole, Send, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getExternalMemoApprovalContext } from "@/lib/actions/external-memo-approval"
import type { ExternalMemoContext } from "@/lib/external-memo-approval"
import { ExternalPursuitHandoffDialog } from "@/components/opportunities/external-pursuit-handoff-dialog"
import { PursuitDropReasonFields, usePursuitDropForm } from "@/components/opportunities/pursuit-drop-reason-fields"
import { OpportunityNdaArtifactManager } from "@/components/opportunities/opportunity-nda-artifact-manager"
import { DocumentRowActions } from "@/components/opportunities/document-row-actions"
import { OpportunityReviewSubmitButton } from "@/components/opportunities/opportunity-review-submit-button"
import { StaffMemoFeedbackControl } from "@/components/opportunities/staff-memo-feedback-control"
import { removeUnusedRetainedOpportunityDocument } from "@/lib/actions/opportunity-documents"
import { toast } from "sonner"
import {
  grantOpportunityPursuitConfidentialAccess,
  passOpportunityPursuitGate1,
  passOpportunityPursuitGate2,
  qualifyOpportunityPursuit,
  requestOpportunityPursuitQualification,
  recordOpportunityPursuitDispatch,
  runOpportunityPursuitJourneyAction,
  transitionOpportunityPursuit,
  validateOpportunityPursuitSignedCopy,
  validateOpportunityPursuitTemplate,
  sendOpportunityPursuitNdaReady,
  startOpportunityPursuit,
} from "@/lib/actions/opportunity-pursuit-journey"
import type { StaffCurrentPursuit } from "@/lib/data/current-pursuit"
import type { ExternalHandoffChannel } from "@/lib/external-pursuit-handoff"
import { getOpportunityDocumentPolicy } from "@/lib/opportunity-document-policy"
import { formatPursuitDateTime } from "@/lib/utils/pursuit-date-time"
import {
  getOpportunityPursuitDropReasonLabel,
  getOpportunityPursuitStageLabel,
  type OpportunityDocument,
  type OpportunityMatch,
  type OpportunityNdaArtifact,
} from "@/lib/types/opportunity"

interface OpportunityPursuitPanelProps {
  opportunityId: string
  recipientImRequired: boolean
  matches: OpportunityMatch[]
  documents: OpportunityDocument[]
  ndaArtifacts: OpportunityNdaArtifact[]
  projection: StaffCurrentPursuit | null
  legacyEventCount: number
}

const externalEvidenceCopy = {
  en: {
    e4_qualification_requested: "Qualification request completed outside WAVE",
    e6_nda_ready_notified: "NDA-ready notice completed outside WAVE",
    e7_signed_copies_and_memo_requested: "Signed copies and memo request completed outside WAVE",
    memoNotice: "Memo access approved; notice completed outside WAVE",
    dateOnly: "date only",
    channels: { email: "Email", phone: "Phone", meeting: "Meeting", other: "Other" },
  },
  fr: {
    e4_qualification_requested: "Demande de qualification réalisée hors WAVE",
    e6_nda_ready_notified: "Avis de NDA prêt communiqué hors WAVE",
    e7_signed_copies_and_memo_requested: "Copies signées transmises et mémorandum demandé hors WAVE",
    memoNotice: "Accès au mémo approuvé ; avis communiqué hors WAVE",
    dateOnly: "date seule",
    channels: { email: "E-mail", phone: "Téléphone", meeting: "Réunion", other: "Autre" },
  },
} as const

const EVENT_LABELS: Record<string, string> = {
  mutual_interest_validated: "Mutual interest validated",
  e4_qualification_requested: "Qualification and blank-NDA request sent",
  intermediary_qualified: "Intermediary qualified",
  template_validated: "Blank template validated",
  gate_1_passed: "Gate 1 passed",
  renew_signed_copy_validated: "Re-New signed copy validated",
  repreneur_signed_copy_validated: "Repreneur signed copy validated",
  gate_2_passed: "Gate 2 passed",
  e6_nda_ready_notified: "NDA-ready notice sent",
  e7_signed_copies_and_memo_requested: "Signed copies and memo request sent",
  memo_approved: "Information memorandum approved",
  e8_memo_enabled_completed: "Memo access enabled",
  confidential_access_granted: "Confidential access granted",
  memo_feedback_received: "Substantive memo feedback received",
  access_revoked: "Access revoked",
  continued: "Continue recorded",
  dropped: "Pursuit dropped",
  reopened: "Pursuit reopened",
  completed: "Pursuit completed",
}

function repreneurName(match: OpportunityMatch | null) {
  if (!match?.repreneur) return "Unknown repreneur"
  return [match.repreneur.first_name, match.repreneur.last_name].filter(Boolean).join(" ") || match.repreneur.email
}

export function OpportunityPursuitPanel({ opportunityId, recipientImRequired, matches, documents, ndaArtifacts, projection, legacyEventCount }: OpportunityPursuitPanelProps) {
  const initialLanguage = useUiLanguage()
  const [externalLanguage, setExternalLanguage] = useState(initialLanguage)
  const externalCopy = externalEvidenceCopy[externalLanguage]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [externalMemoContext, setExternalMemoContext] = useState<ExternalMemoContext | null>(null)
  const [outcomeReason, setOutcomeReason] = useState("")
  const dropForm = usePursuitDropForm()
  const activeMatch = matches.find((match) => match.status === "active_pursuit") ?? null
  const historyConfirmedStage = activeMatch?.pursuit_stage_provenance === "staff_confirmed_history"
  const visibleMatch = activeMatch ?? matches.find((match) => match.status === "dropped") ?? null
  const currentTemplate = projection?.currentTemplate ?? ndaArtifacts.find((artifact) => artifact.artifact_role === "blank_template" && !artifact.match_id) ?? null
  const currentRenew = projection?.currentRenewSignedCopy ?? ndaArtifacts.find((artifact) => artifact.artifact_role === "renew_signed_copy" && artifact.match_id === activeMatch?.id) ?? null
  const currentRepreneur = projection?.currentRepreneurSignedCopy ?? ndaArtifacts.find((artifact) => artifact.artifact_role === "repreneur_signed_copy" && artifact.match_id === activeMatch?.id) ?? null
  const imDocuments = documents.filter((document) => document.document_type === "deal_book"
    && !document.recipient_im_cleanup_status
    && (document.recipient_match_id
      ? document.recipient_match_id === activeMatch?.id && document.recipient_repreneur_id === activeMatch?.repreneur_id
      : !recipientImRequired))
  const repreneurArtifacts = ndaArtifacts.filter((artifact) => artifact.artifact_role === "repreneur_signed_copy")

  function run(action: () => Promise<{ success: boolean; message: string; reviewId?: string }>) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      setMessage({ tone: result.success ? "success" : "error", text: result.message })
      if (result.success) {
        toast.success(result.message)
        if (result.reviewId) router.push(`/emails/review/${result.reviewId}`)
        else router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  function removeUnusedArtifact(artifact: OpportunityNdaArtifact) {
    const title = artifact.document?.title ?? `NDA version ${artifact.version_number}`
    if (!window.confirm(`Remove this unused NDA version: ${title}? Used versions cannot be deleted.`)) return
    run(() => removeUnusedRetainedOpportunityDocument({ opportunityId, documentId: artifact.document_id }))
  }

  const nextAction = projection?.nextAction
  const hasLiveGrant = Boolean(projection?.hasLiveConfidentialGrant)
  const needsRevalidation = Boolean(activeMatch && projection?.currentCycleId && !hasLiveGrant && typeof projection.entries.find((event) => event.id === projection.currentCycleId)?.metadata?.blank_nda_present_at_validation !== "boolean")
  const canDrop = projection?.allowedActions.includes("drop") ?? false
  const canContinue = projection?.allowedActions.includes("continue") ?? false
  const canComplete = projection?.allowedActions.includes("complete") ?? false

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LockKeyhole data-icon="inline-start" />Canonical pursuit</CardTitle>
          <CardDescription>{historyConfirmedStage ? "The displayed business progress was confirmed by staff. The checklist below separately tracks WAVE document and access requirements." : "The checklist below is derived from immutable evidence. Legacy stage and NDA fields are history only."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!visibleMatch ? <Alert><FileText /><AlertTitle>No active pursuit</AlertTitle><AlertDescription>Validate an interested repreneur before beginning the confidential journey.</AlertDescription></Alert> : null}
          {visibleMatch ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <div><p className="font-medium">{repreneurName(visibleMatch)}</p><p className="text-sm text-muted-foreground">{visibleMatch.repreneur?.email ?? "-"}</p></div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant={activeMatch ? "secondary" : "outline"}>{activeMatch ? "Active pursuit" : "Dropped pursuit"}</Badge>{activeMatch?.pursuit_stage ? <Badge variant="outline">{getOpportunityPursuitStageLabel(activeMatch.pursuit_stage)}</Badge> : null}{historyConfirmedStage ? <Badge variant="outline">Stage confirmed by Re-New</Badge> : null}</div>
          </div> : null}
          {projection?.evidenceRequired ? <Alert><ShieldCheck /><AlertTitle>Evidence required</AlertTitle><AlertDescription>Legacy pursuit fields do not establish Gate 1, Gate 2, document validation, or confidential access. Record the missing evidence in order.</AlertDescription></Alert> : null}
          {historyConfirmedStage ? <Alert><History /><AlertTitle>Staff-confirmed business progress</AlertTitle><AlertDescription>The displayed pursuit stage reflects staff-confirmed historical progress. Importing it does not send emails or unlock documents; the checklist below tracks the separate WAVE document process.</AlertDescription></Alert> : null}
          {projection?.blockers.length ? <Alert><LockKeyhole /><AlertTitle>Current blockers</AlertTitle><AlertDescription><ul className="list-disc space-y-1 pl-5">{projection.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></AlertDescription></Alert> : null}
          {message ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{message.text}</p> : null}
          {activeMatch && projection ? <div className="flex flex-wrap gap-2">
            {needsRevalidation ? <div className="space-y-2"><p className="text-sm text-muted-foreground">This pursuit predates the delivery record. Revalidate mutual interest to begin the current checklist; sending remains a separate action.</p><Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => startOpportunityPursuit(activeMatch.id))}>Revalidate mutual interest</Button></div> : null}
            {!needsRevalidation && nextAction === "request_qualification" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => requestOpportunityPursuitQualification(activeMatch.id))}><Send data-icon="inline-start" />{pending ? "Preparing..." : "Prepare qualification and NDA request"}</Button> : null}
            {nextAction === "qualify" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => qualifyOpportunityPursuit(activeMatch.id))}><CheckCircle2 data-icon="inline-start" />{pending ? "Recording..." : "Record intermediary qualification"}</Button> : null}
            {nextAction === "validate_template" ? <Button disabled={pending || !currentTemplate} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => currentTemplate && run(() => validateOpportunityPursuitTemplate(activeMatch.id, currentTemplate.id))}><FileCheck2 data-icon="inline-start" />{pending ? "Validating..." : "Validate blank template"}</Button> : null}
            {nextAction === "pass_gate_1" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => passOpportunityPursuitGate1(activeMatch.id))}><ShieldCheck data-icon="inline-start" />{pending ? "Recording..." : "Pass Gate 1"}</Button> : null}
            {nextAction === "send_nda_ready" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => sendOpportunityPursuitNdaReady(activeMatch.id))}><Send data-icon="inline-start" />{pending ? "Preparing..." : "Prepare NDA-ready notice"}</Button> : null}
            {nextAction === "validate_renew_copy" ? <Button disabled={pending || !currentRenew} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => currentRenew && run(() => validateOpportunityPursuitSignedCopy(activeMatch.id, "renew", currentRenew.id))}><FileCheck2 data-icon="inline-start" />{pending ? "Validating..." : "Validate Re-New copy"}</Button> : null}
            {nextAction === "validate_repreneur_copy" ? <Button disabled={pending || !currentRepreneur} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => currentRepreneur && run(() => validateOpportunityPursuitSignedCopy(activeMatch.id, "repreneur", currentRepreneur.id))}><FileCheck2 data-icon="inline-start" />{pending ? "Validating..." : "Validate repreneur copy"}</Button> : null}
            {nextAction === "pass_gate_2" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => passOpportunityPursuitGate2(activeMatch.id))}><ShieldCheck data-icon="inline-start" />{pending ? "Recording..." : "Pass Gate 2"}</Button> : null}
            {nextAction === "record_dispatch" ? <Button disabled={pending} variant="outline" data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => recordOpportunityPursuitDispatch(activeMatch.id))}><Send data-icon="inline-start" />{pending ? "Preparing..." : "Prepare signed copies and memo request"}</Button> : null}
          </div> : null}
          {activeMatch && !needsRevalidation && projection?.externalHandoffContext ? <ExternalPursuitHandoffDialog matchId={activeMatch.id} context={projection.externalHandoffContext} language={externalLanguage} onLanguageChange={setExternalLanguage} /> : null}
          {activeMatch && canDrop ? <div className="space-y-4 border-t pt-4">
            <PursuitDropReasonFields id="pursuit-drop" value={dropForm.value} onChange={dropForm.onChange} disabled={pending} />
            <Button disabled={pending || !dropForm.canSubmit} variant="destructive" data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(async () => {
              const result = await transitionOpportunityPursuit(activeMatch.id, "drop", dropForm.value.primaryReason, dropForm.getIdempotencyKey(), dropForm.value.secondaryReasons, dropForm.value.note)
              if (result.success) dropForm.reset()
              return result
            })}>Confirm Drop pursuit</Button>
          </div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Evidence checklist</CardTitle><CardDescription>Each completed step is immutable and tied to the active pursuit.</CardDescription></CardHeader>
        <CardContent className="divide-y rounded-md border">
          {projection?.steps.map((step) => <div key={step.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{step.label}</p>{step.status === "complete" && step.recordedAt ? <p className="text-xs text-muted-foreground">{step.actor} · {formatPursuitDateTime(step.recordedAt)}</p> : step.blocker ? <p className="text-xs text-muted-foreground">{step.blocker}</p> : null}</div><Badge variant={step.status === "complete" ? "secondary" : step.status === "current" ? "default" : "outline"}>{step.status === "complete" ? "Recorded" : step.status === "current" ? "Next action" : "Pending"}</Badge></div>) ?? <p className="p-3 text-sm text-muted-foreground">Start an active pursuit to see its canonical checklist.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>NDA artifacts</CardTitle><CardDescription>Staff records the blank template and Re-New copy. The repreneur uploads their own signed copy in the portal after Gate 1.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-5"><OpportunityNdaArtifactManager opportunityId={opportunityId} activeMatchId={activeMatch?.id ?? null} artifacts={ndaArtifacts} /><section className="flex flex-col gap-3 border-t pt-5"><div><h3 className="font-medium">Repreneur-signed copies</h3><p className="text-sm text-muted-foreground">All retained pursuit versions stay visible. Staff can validate only the current copy for its exact pursuit.</p></div>{repreneurArtifacts.length ? <div className="divide-y rounded-md border">{repreneurArtifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between gap-3 p-3"><span className="text-sm">v{artifact.version_number} · {artifact.document?.title ?? "Signed NDA"}<span className="block text-xs text-muted-foreground">Pursuit {artifact.match_id?.slice(0, 8) ?? "unknown"}</span>{!artifact.can_remove_unused_retained && <span className="block text-xs text-muted-foreground">Locked after use or supersession. Record a corrected next version instead.</span>}</span><DocumentRowActions policy={{ ...getOpportunityDocumentPolicy("nda", true), canRemove: artifact.can_remove_unused_retained === true }} state={pending ? "pending" : artifact.can_remove_unused_retained ? "available" : "locked"} viewHref={`/opportunities/${opportunityId}/nda-artifacts/${artifact.id}`} downloadHref={`/opportunities/${opportunityId}/nda-artifacts/${artifact.id}?download`} onRemove={artifact.can_remove_unused_retained ? () => removeUnusedArtifact(artifact) : undefined} /></div>)}</div> : <p className="text-sm text-muted-foreground">No repreneur-signed copy has been uploaded yet.</p>}</section></CardContent>
      </Card>

      {activeMatch && projection?.gate2Passed && projection.dispatched ? <Card>
        <CardHeader><CardTitle>Confidential access and outcome</CardTitle><CardDescription>Approve the selected Information Memorandum for this repreneur and grant access only after Gate 2 and the completed intermediary handoff. {recipientImRequired ? "This opportunity requires a fresh recipient-specific PDF uploaded in Documents for this exact pursuit." : "Ordinary reusable IMs remain available through a separate grant for each pursuit."}</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!hasLiveGrant && recipientImRequired && imDocuments.length === 0 ? <Alert><FileText /><AlertTitle>Recipient IM not uploaded yet</AlertTitle><AlertDescription>Approval and NDA steps remain available. Only IM access waits for staff to upload a new personalized copy for {repreneurName(activeMatch)}.</AlertDescription></Alert> : null}
          {!hasLiveGrant && <form action={(formData) => {
            const documentId = String(formData.get("document_id") ?? "")
            const ndaExpiresAt = String(formData.get("nda_expires_at") ?? "")
            if (formData.get("approval_mode") === "external") {
              startTransition(async () => {
                const context = await getExternalMemoApprovalContext(activeMatch.id, documentId, ndaExpiresAt)
                if (context) setExternalMemoContext(context)
                else toast.error(externalLanguage === "fr" ? "Les documents et validations actuels n’ont pas pu être vérifiés." : "Current documents and approvals could not be verified.")
              })
            } else run(() => grantOpportunityPursuitConfidentialAccess(activeMatch.id, documentId, ndaExpiresAt))
          }} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)_auto] sm:items-end" data-wave-action="confirm" data-wave-workflow="portal_pursuit">
            <div className="space-y-2"><Label htmlFor="journey-im">Information memorandum</Label><select id="journey-im" name="document_id" className="border-input flex h-9 w-full rounded-md border bg-card px-3 text-sm" defaultValue="" required> <option value="" disabled>Select the exact IM</option>{imDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="journey-nda-expiry">NDA access expires</Label><Input id="journey-nda-expiry" name="nda_expires_at" type="datetime-local" required /></div>
            <div className="flex flex-col gap-2"><OpportunityReviewSubmitButton label="Approve IM and grant access" pendingLabel="Granting..." disabled={imDocuments.length === 0} />
              {projection.externalRecordingEnabled ? <Button type="submit" variant="outline" name="approval_mode" value="external" disabled={pending || imDocuments.length === 0}>{externalLanguage === "fr" ? "Approuver avec avis externe" : "Approve with external notice"}</Button> : null}</div>
          </form>}
          {!hasLiveGrant && projection.externalRecordingEnabled && externalMemoContext && externalMemoContext.repreneur_id === activeMatch.repreneur_id ? <ExternalPursuitHandoffDialog key={JSON.stringify(externalMemoContext)} matchId={activeMatch.id} context={externalMemoContext} language={externalLanguage} onLanguageChange={setExternalLanguage} initiallyOpen onClose={() => setExternalMemoContext(null)} /> : null}
          {!hasLiveGrant && projection.confidentialGrant ? <Alert><LockKeyhole /><AlertTitle>Confidential access is no longer live</AlertTitle><AlertDescription>The prior grant is revoked, expired, or no longer bound to the current evidence. Select the IM and set a new expiry to grant access again.</AlertDescription></Alert> : null}
          {hasLiveGrant ? <div className="flex flex-col gap-3"><div className="flex flex-wrap gap-2"><Badge variant="secondary">Access granted</Badge>{canContinue ? <Button disabled={pending} variant="outline" data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => transitionOpportunityPursuit(activeMatch.id, "continue"))}>Record Continue</Button> : null}<Button disabled={pending} variant="outline" data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => runOpportunityPursuitJourneyAction({ matchId: activeMatch.id, action: "revoke_access", reason: outcomeReason || "staff_revocation" }))}>Revoke access</Button></div>{canComplete ? <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="pursuit-complete-reason">Reason required to complete</Label><Input id="pursuit-complete-reason" value={outcomeReason} onChange={(event) => setOutcomeReason(event.target.value)} placeholder="Record the external outcome" /></div><Button disabled={pending || !outcomeReason.trim()} data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => transitionOpportunityPursuit(activeMatch.id, "complete", outcomeReason.trim()))}>Complete pursuit</Button></div> : null}</div> : null}
          {projection.memoFeedback ? <StaffMemoFeedbackControl matchId={activeMatch.id} feedback={projection.memoFeedback} canRecord={hasLiveGrant} /> : null}
        </CardContent>
      </Card> : null}

      {visibleMatch?.status === "dropped" && projection ? <Card><CardHeader><CardTitle>Reopen pursuit</CardTitle><CardDescription>Reopening revokes access. Gate evidence must be earned again.</CardDescription></CardHeader><CardContent><Button disabled={pending} data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => transitionOpportunityPursuit(visibleMatch.id, "reopen"))}>Reopen as interested</Button></CardContent></Card> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History data-icon="inline-start" />Evidence log</CardTitle><CardDescription>Append-only operational history for this pursuit. {legacyEventCount ? `${legacyEventCount} legacy stage record${legacyEventCount === 1 ? " is" : "s are"} retained as read-only history.` : ""}</CardDescription></CardHeader>
        <CardContent>{projection?.entries.length ? <div className="divide-y rounded-md border">{projection.entries.map((entry) => {
          const externalMemoNotice = entry.event_type === "e8_memo_enabled_completed" && typeof entry.metadata?.grant_evidence_id === "string" ? projection.externalMemoNotices?.[entry.metadata.grant_evidence_id] : null
          const dropped = entry.event_type === "dropped"
          const evidenceReference = dropped && entry.evidence_reference ? getOpportunityPursuitDropReasonLabel(entry.evidence_reference) : entry.evidence_reference
          const secondaryReasons = dropped && Array.isArray(entry.metadata?.secondary_reasons) ? entry.metadata?.secondary_reasons.filter((reason): reason is string => typeof reason === "string") : []
          const note = dropped && typeof entry.metadata?.reason_note === "string" ? entry.metadata?.reason_note : null
          return <div key={entry.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1"><p className="text-sm font-medium">{externalMemoNotice ? externalCopy.memoNotice : entry.metadata?.qualifying_origin === "external_staff_v1" ? externalCopy[entry.event_type as "e4_qualification_requested" | "e6_nda_ready_notified" | "e7_signed_copies_and_memo_requested"] : EVENT_LABELS[entry.event_type] ?? entry.event_type}</p>
              {entry.metadata?.qualifying_origin === "external_staff_v1" ? <p className="text-xs text-muted-foreground">{String(entry.metadata.exchange_date)}{entry.metadata.exchange_time ? ` · ${String(entry.metadata.exchange_time).slice(0, 5)} Europe/Paris` : ` · ${externalCopy.dateOnly}`} · {externalCopy.channels[String(entry.metadata.channel) as ExternalHandoffChannel] ?? externalCopy.channels.other}</p> : null}
              {entry.event_type === "e4_qualification_requested" && entry.metadata?.qualifying_origin === "external_staff_v1" && typeof entry.metadata.external_handoff_id === "string" && entry.metadata.context && typeof entry.metadata.context === "object" && "ldc" in entry.metadata.context ? <a className="block text-sm underline" href={`/api/pursuit-handoffs/${entry.metadata.external_handoff_id}/ldc?download`}>{externalLanguage === "fr" ? "Télécharger la Fiche de cadrage attestée (PDF)" : "Download the attested Fiche de cadrage (PDF)"}</a> : null}
              {externalMemoNotice ? <><p className="text-xs text-muted-foreground">{externalMemoNotice.exchange_date}{externalMemoNotice.exchange_time ? ` · ${externalMemoNotice.exchange_time.slice(0, 5)} Europe/Paris` : ` · ${externalCopy.dateOnly}`} · {externalCopy.channels[externalMemoNotice.channel]}</p><p className="text-xs text-muted-foreground">{externalMemoNotice.reference} · {externalMemoNotice.staff_user_id} · {formatPursuitDateTime(externalMemoNotice.recorded_at)}</p></> : null}
              {evidenceReference ? <p className="text-xs text-muted-foreground">{dropped ? "Main: " : ""}{evidenceReference}</p> : null}
              {secondaryReasons.length ? <p className="text-xs text-muted-foreground">Secondary: {secondaryReasons.map(getOpportunityPursuitDropReasonLabel).join("; ")}</p> : null}
              {note ? <p className="whitespace-pre-wrap break-words text-sm">{note}</p> : null}
            </div><p className="shrink-0 text-xs text-muted-foreground">{entry.actor} · {formatPursuitDateTime(entry.recorded_at)}</p>
          </div>
        })}</div> : <p className="text-sm text-muted-foreground">No canonical evidence has been recorded yet.</p>}</CardContent>
      </Card>
    </div>
  )
}
