"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { approveAndSendStaffEmailReview, cancelStaffEmailReview, editStaffEmailReview, type StaffEmailReview } from "@/lib/actions/staff-email-review"

type ReviewRecord = Awaited<ReturnType<typeof import("@/lib/actions/staff-email-review").getStaffEmailReview>>

function time(value: string | null) { return value ? new Date(value).toLocaleString("fr-FR") : "—" }

export function ReviewDetail({ initial }: { initial: ReviewRecord }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [subject, setSubject] = useState(initial.review.subject)
  const [body, setBody] = useState(initial.review.body_text)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const review: StaffEmailReview = initial.review
  useEffect(() => { setSubject(review.subject); setBody(review.body_text) }, [review.version, review.subject, review.body_text])
  const changed = subject !== review.subject || body !== review.body_text
  const editable = review.source_kind === "ma" && review.state === "pending"
  const sendable = review.state === "pending" || review.state === "uncertain" || review.state === "sending"
  const cancellable = review.state === "pending" || review.state === "failed"

  function run(action: () => Promise<{ message: string; success?: boolean }>) {
    setError("")
    startTransition(async () => {
      try {
        const result = await action()
        if (result.success === false) { setError(result.message); toast.error(result.message) }
        else toast.success(result.message)
        router.refresh()
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "The review action failed. Refresh this record."
        setError(message); toast.error(message); router.refresh()
      }
    })
  }

  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="wave-micro-label">Email operations</p><h1 className="text-2xl font-semibold">Review &amp; send</h1></div>
      <Button asChild variant="outline" size="sm"><Link href="/emails">Back to emails</Link></Button>
    </div>
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle>{review.source_kind === "ma" ? "M&A opportunity email" : `${review.source_kind.toUpperCase()} pursuit handoff`}</CardTitle><Badge variant="secondary">{review.state}</Badge><Badge variant="outline">{review.namespace}</Badge></div>
        <CardDescription>Prepared by {review.created_by} at {time(review.created_at)}. Subject and message are editable only for ordinary M&amp;A drafts.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error ? <Alert variant="destructive"><AlertTitle>Action not completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {review.namespace === "DEMO" ? <Alert><AlertTitle>DEMO draft</AlertTitle><AlertDescription>Production delivery is disabled for this draft.</AlertDescription></Alert> : null}
        {!initial.catalogueEnabled ? <Alert><AlertTitle>Catalogue template disabled</AlertTitle><AlertDescription>This draft can be reviewed, but Send is blocked while {review.template_key} is inactive or missing in Templates. This review does not change the existing switch.</AlertDescription></Alert> : null}
        {review.state === "uncertain" || review.state === "sending" ? <Alert><AlertTitle>Outcome needs care</AlertTitle><AlertDescription>Retry only this unchanged operation after its two-minute lease. After 23 hours, reconcile with the provider; do not create another draft to resend.</AlertDescription></Alert> : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Recipient</dt><dd className="break-all font-medium">{review.recipient_email}</dd></div>
          <div><dt className="text-muted-foreground">Source action / event</dt><dd className="break-all">{review.source_kind} · {review.source_operation_id}</dd></div>
          <div><dt className="text-muted-foreground">Opportunity</dt><dd><Link className="underline" href={`/opportunities/${review.opportunity_id}`}>{review.opportunity_id}</Link></dd></div>
          <div><dt className="text-muted-foreground">Pursuit</dt><dd>{review.match_id ?? "None — ordinary M&A action"}</dd></div>
          <div><dt className="text-muted-foreground">Template / version</dt><dd className="break-all">{review.template_key} · {review.template_version}</dd></div>
          <div><dt className="text-muted-foreground">Reviewed version</dt><dd>{review.version}</dd></div>
        </dl>
        <div className="flex flex-col gap-2"><Label htmlFor="review-subject">Subject</Label><Input id="review-subject" value={subject} readOnly={!editable} onChange={(event) => setSubject(event.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="review-body">Message</Label><Textarea id="review-body" rows={13} value={body} readOnly={!editable} onChange={(event) => setBody(event.target.value)} /></div>
        {review.attachment_snapshot.length ? <div className="flex flex-col gap-2"><p className="font-medium">Fixed signed attachments</p>{review.attachment_snapshot.map((item) => <p key={item.artifact_id} className="break-all rounded-md border p-2 text-xs">{item.file_name} · {item.mime_type} · {item.size_bytes} bytes · SHA-256 {item.content_sha256}<br />Artifact {item.artifact_id} · Document {item.document_id}</p>)}</div> : null}
        {review.attempted_at ? <Alert><AlertTitle>Delivery evidence</AlertTitle><AlertDescription>Approved by {review.approved_by} at {time(review.approved_at)}. Attempted {time(review.attempted_at)}. Outcome {time(review.outcome_at)}. {review.provider_message_id ? `Provider receipt ${review.provider_message_id}. ` : ""}{review.delivery_evidence_id ? `Canonical evidence ${review.delivery_evidence_id}. ` : ""}{review.delivery_error ?? ""}{review.state === "sent" ? " Sent means accepted by the provider, not delivered or read." : ""}</AlertDescription></Alert> : null}
        {review.cancelled_at ? <Alert><AlertTitle>Cancelled</AlertTitle><AlertDescription>{review.cancel_reason} · {review.cancelled_by} · {time(review.cancelled_at)}</AlertDescription></Alert> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {editable && changed ? <Button disabled={busy || !subject.trim() || !body.trim()} onClick={() => run(() => editStaffEmailReview(review.id, review.version, subject, body))}>Save reviewed text</Button> : null}
        {sendable ? <Button disabled={busy || changed || review.namespace !== "REAL" || !initial.catalogueEnabled} onClick={() => {
          if (window.confirm(`Approve and send this exact version to ${review.recipient_email}?`)) run(() => approveAndSendStaffEmailReview(review.id, review.version))
        }}>{busy ? "Working..." : review.state === "pending" ? "Approve and send" : "Retry unchanged operation"}</Button> : null}
      </CardFooter>
    </Card>
    {cancellable ? <Card><CardHeader><CardTitle>Cancel this draft</CardTitle><CardDescription>Requires a reason. Sent and uncertain operations cannot be cancelled.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><Label htmlFor="review-cancel-reason">Reason</Label><Input id="review-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></CardContent><CardFooter><Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => run(() => cancelStaffEmailReview(review.id, review.version, reason))}>Cancel with reason</Button></CardFooter></Card> : null}
    <Card><CardHeader><CardTitle>Retained history</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{initial.events.map((event) => <p key={event.id} className="text-sm"><Badge variant="outline">{event.event_kind}</Badge> {event.actor} · {time(event.occurred_at)} · v{event.version}</p>)}</CardContent></Card>
  </div>
}
