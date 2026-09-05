"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileCheck2, FileText, History, LockKeyhole, Send, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OpportunityNdaArtifactManager } from "@/components/opportunities/opportunity-nda-artifact-manager"
import { DocumentRowActions } from "@/components/opportunities/document-row-actions"
import { OpportunityReviewSubmitButton } from "@/components/opportunities/opportunity-review-submit-button"
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
import { getOpportunityDocumentPolicy } from "@/lib/opportunity-document-policy"
import { formatPursuitDateTime } from "@/lib/utils/pursuit-date-time"
import {
  getOpportunityPursuitDropReasonLabel,
  isOpportunityPursuitDropReason,
  OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS,
  type OpportunityDocument,
  type OpportunityMatch,
  type OpportunityNdaArtifact,
  type OpportunityPursuitDropReason,
} from "@/lib/types/opportunity"

interface OpportunityPursuitPanelProps {
  opportunityId: string
  matches: OpportunityMatch[]
  documents: OpportunityDocument[]
  ndaArtifacts: OpportunityNdaArtifact[]
  projection: StaffCurrentPursuit | null
  legacyEventCount: number
}

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

export function OpportunityPursuitPanel({ opportunityId, matches, documents, ndaArtifacts, projection, legacyEventCount }: OpportunityPursuitPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [outcomeReason, setOutcomeReason] = useState("")
  const [dropReason, setDropReason] = useState<OpportunityPursuitDropReason | "">("")
  const activeMatch = matches.find((match) => match.status === "active_pursuit") ?? null
  const visibleMatch = activeMatch ?? matches.find((match) => match.status === "dropped") ?? null
  const currentTemplate = projection?.currentTemplate ?? ndaArtifacts.find((artifact) => artifact.artifact_role === "blank_template" && !artifact.match_id) ?? null
  const currentRenew = projection?.currentRenewSignedCopy ?? ndaArtifacts.find((artifact) => artifact.artifact_role === "renew_signed_copy" && artifact.match_id === activeMatch?.id) ?? null
  const currentRepreneur = projection?.currentRepreneurSignedCopy ?? ndaArtifacts.find((artifact) => artifact.artifact_role === "repreneur_signed_copy" && artifact.match_id === activeMatch?.id) ?? null
  const imDocuments = documents.filter((document) => document.document_type === "deal_book")
  const repreneurArtifacts = ndaArtifacts.filter((artifact) => artifact.artifact_role === "repreneur_signed_copy")

  function run(action: () => Promise<{ success: boolean; message: string }>) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      setMessage({ tone: result.success ? "success" : "error", text: result.message })
      if (result.success) {
        toast.success(result.message)
        router.refresh()
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
          <CardDescription>The checklist below is derived from immutable evidence. Legacy stage and NDA fields are history only.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!visibleMatch ? <Alert><FileText /><AlertTitle>No active pursuit</AlertTitle><AlertDescription>Validate an interested repreneur before beginning the confidential journey.</AlertDescription></Alert> : null}
          {visibleMatch ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
            <div><p className="font-medium">{repreneurName(visibleMatch)}</p><p className="text-sm text-muted-foreground">{visibleMatch.repreneur?.email ?? "-"}</p></div>
            <Badge variant={activeMatch ? "secondary" : "outline"}>{activeMatch ? "Active pursuit" : "Dropped pursuit"}</Badge>
          </div> : null}
          {projection?.evidenceRequired ? <Alert><ShieldCheck /><AlertTitle>Evidence required</AlertTitle><AlertDescription>Legacy pursuit fields do not establish Gate 1, Gate 2, document validation, or confidential access. Record the missing evidence in order.</AlertDescription></Alert> : null}
          {projection?.blockers.length ? <Alert><LockKeyhole /><AlertTitle>Current blockers</AlertTitle><AlertDescription><ul className="list-disc space-y-1 pl-5">{projection.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></AlertDescription></Alert> : null}
          {message ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{message.text}</p> : null}
          {activeMatch && projection ? <div className="flex flex-wrap gap-2">
            {needsRevalidation ? <div className="space-y-2"><p className="text-sm text-muted-foreground">This pursuit predates the delivery record. Revalidate mutual interest to begin the current checklist; sending remains a separate action.</p><Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => startOpportunityPursuit(activeMatch.id))}>Revalidate mutual interest</Button></div> : null}
            {!needsRevalidation && nextAction === "request_qualification" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => requestOpportunityPursuitQualification(activeMatch.id))}><Send data-icon="inline-start" />{pending ? "Recording..." : "Send qualification and NDA request"}</Button> : null}
            {nextAction === "qualify" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => qualifyOpportunityPursuit(activeMatch.id))}><CheckCircle2 data-icon="inline-start" />{pending ? "Recording..." : "Record intermediary qualification"}</Button> : null}
            {nextAction === "validate_template" ? <Button disabled={pending || !currentTemplate} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => currentTemplate && run(() => validateOpportunityPursuitTemplate(activeMatch.id, currentTemplate.id))}><FileCheck2 data-icon="inline-start" />{pending ? "Validating..." : "Validate blank template"}</Button> : null}
            {nextAction === "pass_gate_1" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => passOpportunityPursuitGate1(activeMatch.id))}><ShieldCheck data-icon="inline-start" />{pending ? "Recording..." : "Pass Gate 1"}</Button> : null}
            {nextAction === "send_nda_ready" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => sendOpportunityPursuitNdaReady(activeMatch.id))}><Send data-icon="inline-start" />{pending ? "Sending..." : "Send NDA-ready notice"}</Button> : null}
            {nextAction === "validate_renew_copy" ? <Button disabled={pending || !currentRenew} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => currentRenew && run(() => validateOpportunityPursuitSignedCopy(activeMatch.id, "renew", currentRenew.id))}><FileCheck2 data-icon="inline-start" />{pending ? "Validating..." : "Validate Re-New copy"}</Button> : null}
            {nextAction === "validate_repreneur_copy" ? <Button disabled={pending || !currentRepreneur} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => currentRepreneur && run(() => validateOpportunityPursuitSignedCopy(activeMatch.id, "repreneur", currentRepreneur.id))}><FileCheck2 data-icon="inline-start" />{pending ? "Validating..." : "Validate repreneur copy"}</Button> : null}
            {nextAction === "pass_gate_2" ? <Button disabled={pending} data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => passOpportunityPursuitGate2(activeMatch.id))}><ShieldCheck data-icon="inline-start" />{pending ? "Recording..." : "Pass Gate 2"}</Button> : null}
            {nextAction === "record_dispatch" ? <Button disabled={pending} variant="outline" data-wave-action="confirm" data-wave-workflow="portal_pursuit" onClick={() => run(() => recordOpportunityPursuitDispatch(activeMatch.id))}><Send data-icon="inline-start" />{pending ? "Recording..." : "Send signed copies and memo request"}</Button> : null}
          </div> : null}
          {activeMatch && canDrop ? <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="pursuit-drop-reason">Choose why this pursuit is ending</Label><Select value={dropReason} onValueChange={(value) => setDropReason(value as OpportunityPursuitDropReason)}><SelectTrigger id="pursuit-drop-reason"><SelectValue placeholder="Choose a Drop reason" /></SelectTrigger><SelectContent><SelectGroup>{OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select></div><Button disabled={pending || !dropReason} variant="destructive" data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => transitionOpportunityPursuit(activeMatch.id, "drop", dropReason))}>Drop pursuit</Button></div> : null}
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
        <CardHeader><CardTitle>Confidential access and outcome</CardTitle><CardDescription>Approve the selected Information Memorandum for this repreneur and grant access only after Gate 2 and the sent intermediary handoff.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!hasLiveGrant && <form action={(formData) => {
            const documentId = String(formData.get("document_id") ?? "")
            const ndaExpiresAt = String(formData.get("nda_expires_at") ?? "")
            run(() => grantOpportunityPursuitConfidentialAccess(activeMatch.id, documentId, ndaExpiresAt))
          }} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)_auto] sm:items-end" data-wave-action="confirm" data-wave-workflow="portal_pursuit">
            <div className="space-y-2"><Label htmlFor="journey-im">Information memorandum</Label><select id="journey-im" name="document_id" className="border-input flex h-9 w-full rounded-md border bg-card px-3 text-sm" defaultValue="" required> <option value="" disabled>Select the exact IM</option>{imDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="journey-nda-expiry">NDA access expires</Label><Input id="journey-nda-expiry" name="nda_expires_at" type="datetime-local" required /></div>
            <OpportunityReviewSubmitButton label="Approve IM and grant access" pendingLabel="Granting..." disabled={imDocuments.length === 0} />
          </form>}
          {!hasLiveGrant && projection.confidentialGrant ? <Alert><LockKeyhole /><AlertTitle>Confidential access is no longer live</AlertTitle><AlertDescription>The prior grant is revoked, expired, or no longer bound to the current evidence. Select the IM and set a new expiry to grant access again.</AlertDescription></Alert> : null}
          {hasLiveGrant ? <div className="flex flex-col gap-3"><div className="flex flex-wrap gap-2"><Badge variant="secondary">Access granted</Badge>{canContinue ? <Button disabled={pending} variant="outline" data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => transitionOpportunityPursuit(activeMatch.id, "continue"))}>Record Continue</Button> : null}<Button disabled={pending} variant="outline" data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => runOpportunityPursuitJourneyAction({ matchId: activeMatch.id, action: "revoke_access", reason: outcomeReason || "staff_revocation" }))}>Revoke access</Button></div>{canComplete ? <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="pursuit-complete-reason">Reason required to complete</Label><Input id="pursuit-complete-reason" value={outcomeReason} onChange={(event) => setOutcomeReason(event.target.value)} placeholder="Record the external outcome" /></div><Button disabled={pending || !outcomeReason.trim()} data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => transitionOpportunityPursuit(activeMatch.id, "complete", outcomeReason.trim()))}>Complete pursuit</Button></div> : null}</div> : null}
        </CardContent>
      </Card> : null}

      {visibleMatch?.status === "dropped" && projection ? <Card><CardHeader><CardTitle>Reopen pursuit</CardTitle><CardDescription>Reopening revokes access. Gate evidence must be earned again.</CardDescription></CardHeader><CardContent><Button disabled={pending} data-wave-action="update" data-wave-workflow="portal_pursuit" onClick={() => run(() => transitionOpportunityPursuit(visibleMatch.id, "reopen"))}>Reopen as interested</Button></CardContent></Card> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History data-icon="inline-start" />Evidence log</CardTitle><CardDescription>Append-only operational history for this pursuit. {legacyEventCount ? `${legacyEventCount} legacy stage record${legacyEventCount === 1 ? " is" : "s are"} retained as read-only history.` : ""}</CardDescription></CardHeader>
        <CardContent>{projection?.entries.length ? <div className="divide-y rounded-md border">{projection.entries.map((entry) => { const evidenceReference = entry.event_type === "dropped" && isOpportunityPursuitDropReason(entry.evidence_reference) ? getOpportunityPursuitDropReasonLabel(entry.evidence_reference) : entry.evidence_reference; return <div key={entry.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{EVENT_LABELS[entry.event_type] ?? entry.event_type}</p>{evidenceReference ? <p className="text-xs text-muted-foreground">{evidenceReference}</p> : null}</div><p className="text-xs text-muted-foreground">{entry.actor} · {formatPursuitDateTime(entry.recorded_at)}</p></div> })}</div> : <p className="text-sm text-muted-foreground">No canonical evidence has been recorded yet.</p>}</CardContent>
      </Card>
    </div>
  )
}
