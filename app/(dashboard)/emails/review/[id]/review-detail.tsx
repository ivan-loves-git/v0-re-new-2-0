"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Send, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { EmailReviewQueueRow } from "@/lib/email/review-queue-query"
import { TEMPLATE_METADATA } from "@/lib/email/templates"
import type { EmailTemplateKey } from "@/lib/types/email"
import "../../components/review-queue.css"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  approveAndSendStaffEmailReview,
  getStaffEmailReview,
  archiveStaffEmailReview,
  cancelStaffEmailReview,
  editStaffEmailReview,
  applyNewerStaffEmailTemplate,
  recordOpportunityFreshnessReply,
  refreshOpportunityFreshnessReview,
  restoreStaffEmailReview,
  type StaffEmailReview,
} from "@/lib/actions/staff-email-review"
import { PURSUIT_REVIEW_COPY_VERSION } from "@/lib/email/review-copy-version"
import { formatDisplayDateTime } from "@/lib/utils/display-date-time"
import { readReviewedMessageForConfirmation } from "@/lib/email/review-ui-transitions"
import { SingleEmailConfirmation } from "../../components/single-confirmation"

type ReviewRecord = Awaited<
  ReturnType<
    typeof import("@/lib/actions/staff-email-review").getStaffEmailReview
  >
>

function time(value: string | null) {
  return value
    ? formatDisplayDateTime(value, "fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—"
}

export function ReviewDetail({
  initial,
  recipient,
  embedded = false,
  onUpdated,
  onSaved,
  onSend,
}: {
  initial: ReviewRecord
  recipient?: EmailReviewQueueRow
  embedded?: boolean
  onUpdated?: () => Promise<void>
  onSaved?: () => void
  onSend?: (record: ReviewRecord) => void
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [subject, setSubject] = useState(initial.review.subject)
  const [body, setBody] = useState(initial.review.body_text)
  const [reason, setReason] = useState("")
  const [replyMember, setReplyMember] = useState(
    initial.members[0]?.opportunity_id ?? "",
  )
  const [replyOutcome, setReplyOutcome] = useState<
    "confirmed_open" | "closed" | "paused" | "unclear"
  >("confirmed_open")
  const [replyAt, setReplyAt] = useState("")
  const [replyEvidence, setReplyEvidence] = useState("")
  const [error, setError] = useState("")
  const [templateOpen, setTemplateOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<ReviewRecord | null>(null)
  const review: StaffEmailReview = initial.review
  const recipientDisplay =
    initial.display?.recipient ??
    (recipient?.recipient_email === review.recipient_email ? recipient : null)
  const opportunityDisplay = initial.display?.opportunity
  const templateName =
    review.source_kind === "e6"
      ? "E6 NDA-ready · code-governed"
      : (TEMPLATE_METADATA[review.template_key as EmailTemplateKey]?.name ??
        review.template_key)
  const changed = subject !== review.subject || body !== review.body_text
  const editable =
    !review.archived_at &&
    review.state === "pending"
  const sendable =
    !review.archived_at &&
    (review.state === "pending" ||
      review.state === "uncertain" ||
      review.state === "sending" ||
      (review.state === "failed" && review.source_kind !== "ma"))
  const cancellable =
    !review.archived_at &&
    (review.state === "pending" || review.state === "failed")
  const answeredMembers = new Set(
    initial.replies.map((reply) => reply.opportunity_id),
  )
  const answeredCount = initial.members.filter((member) =>
    answeredMembers.has(member.opportunity_id),
  ).length
  const allMembersAnswered =
    initial.members.length > 0 && answeredCount === initial.members.length
  const catalogueVersionIsReviewVersion =
    review.source_kind === "ma" || review.source_kind === "freshness" || review.source_kind === "business"
  const catalogueChanged =
    catalogueVersionIsReviewVersion &&
    initial.catalogue?.version !== review.template_version
  const currentCodeVersion =
    review.source_kind === "e4" ||
    review.source_kind === "e6" ||
    review.source_kind === "e7"
      ? PURSUIT_REVIEW_COPY_VERSION[review.source_kind]
      : null

  function run(action: () => Promise<{ message: string; success?: boolean }>) {
    setError("")
    startTransition(async () => {
      try {
        const result = await action()
        if (result.success === false) {
          setError(result.message)
          toast.error(result.message)
        } else toast.success(result.message)
        if (onUpdated) await onUpdated()
        router.refresh()
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "The review action failed. Refresh this record."
        setError(message)
        toast.error(message)
        router.refresh()
      }
    })
  }

  function save() {
    setError("")
    startTransition(async () => {
      try {
        const result = await editStaffEmailReview(
          review.id,
          review.version,
          subject,
          body,
        )
        toast.success(result.message)
        if (onSaved) onSaved()
        else if (onUpdated) await onUpdated()
        router.refresh()
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "The reviewed text was not saved."
        setError(message)
        toast.error(message)
      }
    })
  }

  function send() {
    if (review.state === "pending") {
      setError("")
      startTransition(async () => {
        try {
          const canonical = await readReviewedMessageForConfirmation(
            review,
            subject,
            body,
            { edit: editStaffEmailReview, read: getStaffEmailReview },
          )
          if (onSend) onSend(canonical)
          else setConfirmation(canonical)
          router.refresh()
        } catch (cause) {
          const message =
            cause instanceof Error
              ? cause.message
              : "The exact reviewed message changed. Reopen it before confirming."
          setError(message)
          toast.error(message)
        }
      })
    } else if (
      window.confirm(
        `Approve and send this exact version to ${review.recipient_email}?`,
      )
    ) {
      run(() => approveAndSendStaffEmailReview(review.id, review.version))
    }
  }

  return (
    <div
      className={`email-review-scope ${embedded ? "email-review-message" : "mx-auto w-full max-w-4xl"}`}
    >
      {!embedded ? (
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Review message</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/emails">Back to emails</Link>
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-5">
        <div className="flex justify-between gap-2">
          <Badge
            variant="outline"
            className={
              review.state === "sent"
                ? "email-purpose-success"
                : "email-purpose-warning"
            }
          >
            {review.archived_at
              ? "Archived"
              : review.state === "pending"
                ? "Pending review"
                : review.state === "sent"
                  ? "Accepted by provider"
                  : review.state}
          </Badge>
          <Badge variant="outline">{review.namespace}</Badge>
        </div>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Action not completed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div>
          <span className="email-field-label">To</span>
          <div className="font-medium">
            {recipientDisplay?.recipient_name ?? "Name unavailable"}
          </div>
          <div className="break-all">{review.recipient_email}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {recipientDisplay?.company_name ?? "Company not recorded"}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <span className="email-field-label">Related opportunity</span>
          {review.source_kind === "business" ? (
            <span>Original business event · {String(review.source_context?.kind ?? "manual")}</span>
          ) : review.source_kind === "freshness" ? (
            <span>{initial.members.length} exact grouped opportunities</span>
          ) : (
            <Link
              className="underline"
              href={`/opportunities/${review.opportunity_id}`}
            >
              {opportunityDisplay
                ? `${opportunityDisplay.public_title ?? "Title not recorded"} · ${opportunityDisplay.reference}`
                : "Opportunity details unavailable"}
            </Link>
          )}
        </div>
        <div>
          <span className="email-field-label">Email template</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
            onClick={() => setTemplateOpen(true)}
          >
            {templateName}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </button>
        </div>
        <label className="block">
          <span className="email-field-label">Subject</span>
          <Input
            id="review-subject"
            aria-label="Subject"
            value={subject}
            readOnly={!editable}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="email-field-label">Message</span>
          <Textarea
            id="review-body"
            aria-label="Message"
            className="min-h-72 leading-6"
            value={body}
            readOnly={!editable}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Prepared {time(review.created_at)}.{" "}
          {editable
            ? "Edits affect this reviewed draft only."
            : "Only unattempted pending drafts can be edited."}
        </p>
        <div className="flex justify-end gap-2">
          {editable ? (
            <Button
              variant="outline"
              disabled={busy || !changed || !subject.trim() || !body.trim()}
              onClick={save}
            >
              Save reviewed text
            </Button>
          ) : null}
          <Button
            disabled={
              busy ||
              (changed && !editable) ||
              !subject.trim() ||
              !body.trim() ||
              !sendable ||
              review.namespace !== "REAL" ||
              !initial.catalogueEnabled ||
              Boolean(
                currentCodeVersion &&
                currentCodeVersion !== review.template_version,
              )
            }
            onClick={send}
          >
            <Send aria-hidden="true" className="size-3.5" />
            {busy
              ? "Working..."
              : review.state === "failed"
                ? "Retry unchanged after failure"
                : review.state === "uncertain" || review.state === "sending"
                  ? "Retry unchanged operation"
                  : "Send"}
          </Button>
        </div>
        <details className="email-review-extra rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">More details</summary>
          <div className="mt-4 flex flex-col gap-5">
            {review.archived_at ? (
              <Alert>
                <AlertTitle>Put aside</AlertTitle>
                <AlertDescription>
                  Archived by {review.archived_by} at {time(review.archived_at)}
                  . This same draft cannot send until restored and checked
                  again.
                </AlertDescription>
              </Alert>
            ) : null}
            {review.restored_at && !review.archived_at ? (
              <Alert>
                <AlertTitle>Previously restored</AlertTitle>
                <AlertDescription>
                  Restored by {review.restored_by} at {time(review.restored_at)}
                  . Current recipient and source gates still apply.
                </AlertDescription>
              </Alert>
            ) : null}
            {review.namespace === "DEMO" ? (
              <Alert>
                <AlertTitle>DEMO draft</AlertTitle>
                <AlertDescription>
                  Production delivery is disabled for this draft.
                </AlertDescription>
              </Alert>
            ) : null}
            {!initial.catalogueEnabled ? (
              <Alert>
                <AlertTitle>
                  Catalogue template disabled or unavailable
                </AlertTitle>
                <AlertDescription>
                  This draft can be reviewed, but Send is blocked while{" "}
                  {review.template_key} is inactive or missing in Templates.
                  This review does not change the existing switch.
                </AlertDescription>
              </Alert>
            ) : null}
            {catalogueChanged && initial.catalogue ? (
              <Alert>
                <AlertTitle>Template updated</AlertTitle>
                <AlertDescription>
                  The prepared words remain unchanged and can still be sent after the current business and delivery checks. Applying newer template copy is a separate explicit replacement.
                  {editable ? <Button variant="outline" size="sm" disabled={busy} onClick={()=>run(async()=>applyNewerStaffEmailTemplate(review.id,review.version))}>Apply newer template copy</Button> : null}
                </AlertDescription>
              </Alert>
            ) : null}
            {currentCodeVersion &&
            currentCodeVersion !== review.template_version ? (
              <Alert>
                <AlertTitle>Fixed copy version changed</AlertTitle>
                <AlertDescription>
                  The retained review uses an earlier code version. The existing
                  send gate will block this draft.
                </AlertDescription>
              </Alert>
            ) : null}
            {review.source_kind === "freshness" ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Generating rule · v1</p>
                <Link
                  className="underline"
                  href="/emails/automations/opportunity-freshness"
                >
                  View the internal 45-day rule
                </Link>
                <p className="mt-2 text-muted-foreground">
                  The rule link is internal only; it is not in the customer
                  message.
                </p>
              </div>
            ) : null}
            {review.state === "uncertain" || review.state === "sending" ? (
              <Alert>
                <AlertTitle>Outcome needs care</AlertTitle>
                <AlertDescription>
                  Retry only this unchanged operation after its two-minute
                  lease. After 23 hours, reconcile with the provider; do not
                  create another draft to resend.
                </AlertDescription>
              </Alert>
            ) : null}
            {review.state === "failed" && review.source_kind !== "ma" ? (
              <Alert>
                <AlertTitle>Conclusive failure</AlertTitle>
                <AlertDescription>
                  The handoff was not accepted. You may retry only this
                  unchanged review while its safe window and current source
                  gates remain valid, or cancel it with a reason.
                </AlertDescription>
              </Alert>
            ) : null}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Recipient</dt>
                <dd className="break-all font-medium">
                  {review.recipient_email}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Source action / event</dt>
                <dd className="break-all">
                  {review.source_kind} · {review.source_operation_id}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Opportunity</dt>
                <dd>
                  {review.source_kind === "freshness" ? (
                    `${initial.members.length} frozen members below`
                  ) : (
                    <Link
                      className="underline"
                      href={`/opportunities/${review.opportunity_id}`}
                    >
                      {review.opportunity_id}
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pursuit</dt>
                <dd>{review.match_id ?? "None — ordinary M&A action"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Retained template identity
                </dt>
                <dd className="break-all">
                  {review.template_key} · {review.template_version}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reviewed version</dt>
                <dd>{review.version}</dd>
              </div>
            </dl>
            <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm">
              <div>
                <p className="font-medium">Template provenance</p>
                <p className="mt-1 text-muted-foreground">
                  The subject and message below are the retained reviewed copy;
                  staff edits never change a catalogue template.
                </p>
              </div>
              {review.source_kind === "e6" ? (
                <p>
                  E6 NDA-ready is governed by retained code version{" "}
                  <code className="break-all">{review.template_version}</code>;
                  current code version <code>{currentCodeVersion}</code>. It has
                  no editable catalogue template.
                </p>
              ) : (
                <>
                  {review.source_kind === "e4" ||
                  review.source_kind === "e7" ? (
                    <p>
                      This handoff uses retained fixed code copy{" "}
                      <code>{review.template_version}</code>; current code
                      version <code>{currentCodeVersion}</code>. The linked
                      catalogue record is its current availability gate, not the
                      source of those fixed words.
                    </p>
                  ) : (
                    <p>
                      Retained catalogue version:{" "}
                      <code className="break-all">
                        {review.template_version}
                      </code>
                      . The original catalogue source is not stored separately;
                      the reviewed subject and message below are retained.
                    </p>
                  )}
                  <Link
                    className="font-medium underline underline-offset-2"
                    href={`/emails?tab=templates#template-${review.template_key}`}
                  >
                    Open {review.template_key} in Templates
                  </Link>
                  {initial.catalogue ? (
                    <div className="space-y-1">
                      <p>
                        Current catalogue version:{" "}
                        <code className="break-all">
                          {initial.catalogue.version}
                        </code>{" "}
                        · {initial.catalogue.is_active ? "active" : "inactive"}
                      </p>
                      <details className="rounded-md border bg-card p-3">
                        <summary className="cursor-pointer font-medium">
                          View current stored template source
                        </summary>
                        <p className="mt-3 text-muted-foreground">
                          Current stored subject
                        </p>
                        <p className="whitespace-pre-wrap break-words">
                          {initial.catalogue.subject ?? "Empty"}
                        </p>
                        <p className="mt-3 text-muted-foreground">
                          Current stored body
                        </p>
                        <pre className="whitespace-pre-wrap break-words font-sans">
                          {initial.catalogue.body_markdown ?? "No stored body"}
                        </pre>
                        <p className="mt-2 text-xs text-muted-foreground">
                          This is the live catalogue source, not the retained
                          rendered or edited review.
                        </p>
                      </details>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      The current catalogue record could not be read.
                    </p>
                  )}
                </>
              )}
            </div>
            {review.source_kind === "freshness" ? (
              <div className="space-y-2">
                <p className="font-medium">
                  Exact opportunity members and source evidence
                </p>
                {initial.members.map((member) => {
                  const frozen = member.frozen_member
                  return (
                    <div
                      key={member.opportunity_id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <Link
                        href={`/opportunities/${member.opportunity_id}`}
                        className="font-medium underline"
                      >
                        {frozen.reference} · {frozen.title}
                      </Link>
                      <p className="text-muted-foreground">
                        {frozen.firm_name} · {frozen.office_name} ·{" "}
                        {frozen.basis === "older_inventory_no_confirmation"
                          ? `Older inventory / no recorded confirmation · stored date ${frozen.date_added ?? "absent"} · precision ${frozen.date_added_precision ?? "unknown"}`
                          : frozen.basis === "confirmed_open"
                            ? `Source confirmed open ${time(frozen.confirmation_at)}`
                            : `Recorded source day ${frozen.date_added}`}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        Episode {member.episode_key} · office{" "}
                        {frozen.source_office_id} · affiliation{" "}
                        {frozen.affiliation_id} · contact link{" "}
                        {frozen.contact_link_id}
                      </p>
                      {initial.replies
                        .filter(
                          (reply) =>
                            reply.opportunity_id === member.opportunity_id,
                        )
                        .map((reply) => (
                          <p key={reply.id} className="mt-2 text-xs">
                            Reply: {reply.outcome} · {time(reply.reply_at)} ·
                            recorded by {reply.recorded_by} · {reply.evidence}
                          </p>
                        ))}
                    </div>
                  )
                })}
              </div>
            ) : null}
            {review.attachment_snapshot.length ? (
              <div className="flex flex-col gap-2">
                <p className="font-medium">Fixed signed attachments</p>
                {review.attachment_snapshot.map((item) => (
                  <p
                    key={item.artifact_id}
                    className="break-all rounded-md border p-2 text-xs"
                  >
                    {item.file_name} · {item.mime_type} · {item.size_bytes}{" "}
                    bytes · SHA-256 {item.content_sha256}
                    <br />
                    Artifact {item.artifact_id} · Document {item.document_id}
                  </p>
                ))}
              </div>
            ) : null}
            {review.attempted_at ? (
              <Alert>
                <AlertTitle>Delivery evidence</AlertTitle>
                <AlertDescription>
                  Approved by {review.approved_by} at {time(review.approved_at)}
                  . Attempted {time(review.attempted_at)}. Outcome{" "}
                  {time(review.outcome_at)}.{" "}
                  {review.provider_message_id
                    ? `Provider receipt ${review.provider_message_id}. `
                    : ""}
                  {review.delivery_evidence_id
                    ? `Canonical evidence ${review.delivery_evidence_id}. `
                    : ""}
                  {review.delivery_error ?? ""}
                  {review.state === "sent"
                    ? " Sent means accepted by the provider, not delivered or read."
                    : ""}
                </AlertDescription>
              </Alert>
            ) : null}
            {review.source_kind === "freshness" &&
            review.state === "sent" &&
            review.outcome_at ? (
              <Alert>
                <AlertTitle>
                  {allMembersAnswered
                    ? "All source responses recorded"
                    : answeredCount > 0
                      ? "Source response partially recorded"
                      : "Awaiting source response"}
                </AlertTitle>
                <AlertDescription>
                  {answeredCount} of {initial.members.length} member
                  {initial.members.length === 1 ? "" : "s"} answered.{" "}
                  {allMembersAnswered
                    ? ""
                    : `Accepted ${Math.max(0, Math.floor((new Date(initial.asOf).getTime() - new Date(review.outcome_at).getTime()) / 86_400_000))} days ago. `}
                  {review.approved_by} owns follow-up. No automatic chase or
                  deadline is created.
                </AlertDescription>
              </Alert>
            ) : null}
            {review.cancelled_at ? (
              <Alert>
                <AlertTitle>Cancelled</AlertTitle>
                <AlertDescription>
                  {review.cancel_reason} · {review.cancelled_by} ·{" "}
                  {time(review.cancelled_at)}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {review.source_kind === "freshness" &&
              review.state === "pending" &&
              !review.archived_at ? (
                <Button
                  variant="outline"
                  disabled={busy || changed}
                  onClick={() =>
                    run(() =>
                      refreshOpportunityFreshnessReview(
                        review.id,
                        review.version,
                      ),
                    )
                  }
                >
                  Refresh group evidence
                </Button>
              ) : null}
              {initial.archiveEligible ? (
                <Button
                  variant="outline"
                  disabled={busy || changed}
                  onClick={() =>
                    run(() =>
                      review.archived_at
                        ? restoreStaffEmailReview(review.id, review.version)
                        : archiveStaffEmailReview(review.id, review.version),
                    )
                  }
                >
                  {review.archived_at
                    ? "Restore same draft"
                    : "Archive this draft"}
                </Button>
              ) : null}
            </div>
            {cancellable ? (
              <Card>
                <CardHeader>
                  <CardTitle>Cancel this draft</CardTitle>
                  <CardDescription>
                    Requires a reason. Sent and uncertain operations cannot be
                    cancelled.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Label htmlFor="review-cancel-reason">Reason</Label>
                  <Input
                    id="review-cancel-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </CardContent>
                <CardFooter>
                  <Button
                    variant="destructive"
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      run(() =>
                        cancelStaffEmailReview(
                          review.id,
                          review.version,
                          reason,
                        ),
                      )
                    }
                  >
                    Cancel with reason
                  </Button>
                </CardFooter>
              </Card>
            ) : null}
            {review.source_kind === "freshness" && review.state === "sent" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Record an exact source reply</CardTitle>
                  <CardDescription>
                    Only “confirmed still open” resets the selected
                    opportunity’s 45-day clock. Lifecycle changes remain
                    separate staff actions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Opportunity</Label>
                    <Select value={replyMember} onValueChange={setReplyMember}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select exact member" />
                      </SelectTrigger>
                      <SelectContent>
                        {initial.members.map((member) => (
                          <SelectItem
                            key={member.opportunity_id}
                            value={member.opportunity_id}
                          >
                            {member.frozen_member.reference} ·{" "}
                            {member.frozen_member.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source response</Label>
                    <Select
                      value={replyOutcome}
                      onValueChange={(value) =>
                        setReplyOutcome(value as typeof replyOutcome)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed_open">
                          Confirmed still open
                        </SelectItem>
                        <SelectItem value="closed">Reported closed</SelectItem>
                        <SelectItem value="paused">Reported paused</SelectItem>
                        <SelectItem value="unclear">
                          Unclear / needs review
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="freshness-reply-at">
                      Actual reply time
                    </Label>
                    <Input
                      id="freshness-reply-at"
                      type="datetime-local"
                      value={replyAt}
                      onChange={(event) => setReplyAt(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="freshness-reply-evidence">
                      Evidence or source reference
                    </Label>
                    <Textarea
                      id="freshness-reply-evidence"
                      value={replyEvidence}
                      onChange={(event) => setReplyEvidence(event.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    disabled={
                      busy ||
                      !replyMember ||
                      !replyAt ||
                      replyEvidence.trim().length < 5
                    }
                    onClick={() =>
                      run(() =>
                        recordOpportunityFreshnessReply({
                          reviewId: review.id,
                          opportunityId: replyMember,
                          outcome: replyOutcome,
                          replyAt: new Date(replyAt).toISOString(),
                          evidence: replyEvidence,
                        }),
                      )
                    }
                  >
                    Record reply for selected member
                  </Button>
                </CardFooter>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>Retained history</CardTitle>
                <CardDescription>
                  Most recent 100 events, with full parent-owned history
                  retained in the database.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {initial.events.map((event) => (
                  <p key={event.id} className="text-sm">
                    <Badge variant="outline">{event.event_kind}</Badge>{" "}
                    {event.actor} · {time(event.occurred_at)} · v{event.version}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </details>
      </div>
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="email-review-scope max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{templateName}</DialogTitle>
            <DialogDescription>
              {catalogueVersionIsReviewVersion
                ? "Retained reviewed version and current read-only catalogue source"
                : "Retained fixed workflow copy; catalogue availability is a separate gate"}
            </DialogDescription>
          </DialogHeader>
          <div>
            <span className="email-field-label">Template key</span>
            <code className="break-all text-xs">{review.template_key}</code>
          </div>
          <div>
            <span className="email-field-label">Retained version</span>
            <code className="break-all text-xs">{review.template_version}</code>
          </div>
          {catalogueVersionIsReviewVersion ? (
            <p className="text-xs text-muted-foreground">
              The original catalogue source is not stored separately; the
              reviewed copy is retained in this draft.
            </p>
          ) : (
            <>
              <div>
                <span className="email-field-label">Retained subject</span>
                <p className="whitespace-pre-wrap break-words">
                  {review.subject}
                </p>
              </div>
              <div>
                <span className="email-field-label">Retained message</span>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {review.body_text}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Current code version: {currentCodeVersion}
              </p>
            </>
          )}
          {initial.catalogue ? (
            <>
              <div>
                <span className="email-field-label">
                  Current catalogue version
                </span>
                <code className="break-all text-xs">
                  {initial.catalogue.version}
                </code>
                <p className="text-xs text-muted-foreground">
                  {initial.catalogue.is_active ? "Active" : "Inactive"} ·
                  current source, not the retained reviewed copy
                </p>
              </div>
              <div>
                <span className="email-field-label">Current subject</span>
                <p className="whitespace-pre-wrap break-words">
                  {initial.catalogue.subject ?? "Empty"}
                </p>
              </div>
              <div>
                <span className="email-field-label">
                  Current message template
                </span>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {initial.catalogue.body_markdown ?? "No stored body"}
                </p>
              </div>
            </>
          ) : review.source_kind !== "e6" ? (
            <p className="text-muted-foreground">
              Current catalogue source unavailable.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              E6 has no editable catalogue template.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              Back to draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null)
        }}
      >
        <DialogContent className="email-review-scope max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm send</DialogTitle>
            <DialogDescription>
              Review the complete saved message below before confirming
              delivery.
            </DialogDescription>
          </DialogHeader>
          {confirmation ? (
            <SingleEmailConfirmation
              key={`${confirmation.review.id}:${confirmation.review.version}`}
              initial={confirmation}
              onBack={() => setConfirmation(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
