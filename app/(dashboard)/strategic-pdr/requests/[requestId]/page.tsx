import { notFound } from "next/navigation"
import { requireStaffAccess } from "@/lib/access-control"
import { dispositionStrategicPdrRequest } from "@/lib/actions/strategic-pdr"
import { canDispositionPdr, getPdrRequestHistory } from "@/lib/pdr/intake-server"
import { listPdrSavedScreenings } from "@/lib/pdr/intake-server"
import { isDispositionEligiblePdrRequest } from "@/lib/pdr/disposition-eligibility"
import { readCurrentGovernanceProjection } from "@/lib/governance-projection/server"
import { isGovernanceProjectionStale } from "@/lib/governance-projection/freshness"
import { PDR_WAVE_STAFF_INTAKE_PROVENANCE } from "@/lib/pdr/disposition-eligibility"
import { PdrScreeningEditor } from "@/components/strategic-pdr/pdr-screening-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { isUuid } from "@/lib/uuid"

export default async function StrategicPdrRequestDetail({ params }: { params: Promise<{ requestId: string }> }) {
  const access = await requireStaffAccess(); const { requestId } = await params
  if (!isUuid(requestId)) notFound()
  const request = await getPdrRequestHistory(requestId); if (!request) notFound()
  const isCurrentStaffRequest = request.provenance === "proposal" && request.intakeProvenance === PDR_WAVE_STAFF_INTAKE_PROVENANCE
  const [governance, savedScreenings] = await Promise.all([
    isCurrentStaffRequest ? readCurrentGovernanceProjection() : Promise.resolve(null),
    isCurrentStaffRequest ? listPdrSavedScreenings(request.id) : Promise.resolve([]),
  ])
  const canDisposition = await canDispositionPdr(access.user.id)
  const dispositionEligible = isDispositionEligiblePdrRequest({ provenance: request.provenance, status: request.screening.status, requesterActor: request.requester.actor, requesterUserId: request.requester.userId, intakeProvenance: request.intakeProvenance, dispositionKind: request.disposition.kind })
  return <div className="space-y-6"><div><p className="wave-micro-label">Strategic PDR request</p><h1 className="text-2xl font-semibold">{request.title}</h1><p className="text-sm text-muted-foreground">Submitted by {request.requester.displayName ?? request.requester.legacyLabel}</p></div>
    <Card><CardHeader><CardTitle>Original request</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{request.originalText}</CardContent></Card>
    <Card><CardHeader><CardTitle>Screening and clarification record</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Source: {request.provenance} · type: {request.screening.proposalType} · status: {request.screening.status}</p><p>{request.screening.problemStatement}</p><p className="text-muted-foreground">{request.screening.aiRationale || "Screening has not been completed."}</p><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(request.conversation, null, 2)}</pre></CardContent></Card>
    {isCurrentStaffRequest ? <>
      <Card><CardHeader><CardTitle>Governance context</CardTitle></CardHeader><CardContent className="text-sm">{governance?.state === "available" ? <>Strategy revision {governance.projection.registryRevision} · snapshot {new Date(governance.projection.snapshotAt).toLocaleString()} · {isGovernanceProjectionStale(governance.projection.snapshotAt) ? "stale: clarifications and framing only" : "fresh: placement suggestions remain advisory"}.</> : "Unavailable: no AI screening can run until the validated GitHub snapshot is restored."}</CardContent></Card>
      <PdrScreeningEditor requestId={request.id}/>
      <Card><CardHeader><CardTitle>Saved AI screening history</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{savedScreenings.length ? savedScreenings.map((screening) => <div key={screening.id} className="border p-3"><p>{new Date(screening.createdAt).toLocaleString()} · strategy {screening.registryRevision} · {screening.freshness}</p><pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(screening.output, null, 2)}</pre></div>) : <p className="text-muted-foreground">No screening preview has been explicitly saved.</p>}</CardContent></Card>
    </> : null}
    <Card><CardHeader><CardTitle>Private attachments</CardTitle></CardHeader><CardContent><ul>{request.attachments.map((item) => <li key={item.id}><a className="underline" href={`/api/strategic-pdr/attachments/${item.id}`}>{item.originalFilename}</a></li>)}{request.attachments.length === 0 ? <li className="text-sm text-muted-foreground">No private attachments are registered for this request.</li> : null}</ul></CardContent></Card>
    {canDisposition && dispositionEligible ? <Card><CardHeader><CardTitle>Ivan disposition</CardTitle></CardHeader><CardContent><form action={dispositionStrategicPdrRequest} className="space-y-3"><input type="hidden" name="request_id" value={request.id}/><Textarea name="reviewer_note" maxLength={2000} placeholder="Reason or boundary (optional)"/><div className="flex gap-2"><Button name="disposition" value="approved">Approve intake</Button><Button name="disposition" value="declined" variant="outline">Decline intake</Button></div></form></CardContent></Card> : <Card><CardHeader><CardTitle>Disposition</CardTitle></CardHeader><CardContent className="text-sm">{request.disposition.kind ?? "This historical record is read-only."}{request.disposition.note ? ` ${request.disposition.note}` : ""}</CardContent></Card>}
  </div>
}
