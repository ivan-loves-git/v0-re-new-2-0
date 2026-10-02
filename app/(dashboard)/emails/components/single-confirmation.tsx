"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Send } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  approveAndSendStaffEmailReview,
  type getStaffEmailReview,
} from "@/lib/actions/staff-email-review"
import { PURSUIT_REVIEW_COPY_VERSION } from "@/lib/email/review-copy-version"

type ReviewRecord = Awaited<ReturnType<typeof getStaffEmailReview>>

// An individual edited draft may have left the filtered list. Use its existing
// guarded single-message service, never substitute a different bulk page query.
export function SingleEmailConfirmation({
  initial,
  onBack,
}: {
  initial: ReviewRecord
  onBack?: () => void
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState("")
  const [outcome, setOutcome] = useState("")
  const { review } = initial
  const display = initial.display?.recipient
  const name =
    display?.recipient_email === review.recipient_email
      ? display.recipient_name
      : null
  const templateCurrent =
    review.source_kind === "ma" || review.source_kind === "freshness"
      ? initial.catalogue?.version === review.template_version
      : PURSUIT_REVIEW_COPY_VERSION[review.source_kind] ===
        review.template_version
  const sendable =
    initial.catalogueEnabled &&
    templateCurrent &&
    review.namespace === "REAL" &&
    review.state === "pending" &&
    !review.archived_at
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Action not completed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <details className="min-w-0 rounded-lg border p-3" open>
        <summary className="cursor-pointer">
          <span className="font-medium break-all">
            {name ?? review.recipient_email}
          </span>{" "}
          {name ? (
            <span className="text-muted-foreground text-xs">
              {review.recipient_email}
            </span>
          ) : null}
          <p className="mt-1 text-sm">{review.subject}</p>
        </summary>
        <p className="mt-3 border-t pt-3 whitespace-pre-wrap break-words text-sm leading-6">
          {review.body_text}
        </p>
        <details className="mt-3 rounded-lg border p-3 text-xs">
          <summary className="cursor-pointer font-medium">More details</summary>
          <div className="mt-2 space-y-2">
            <p>
              Reviewed version {review.version} · {review.namespace}
            </p>
            <p className="break-all">
              {review.source_kind.toUpperCase()} · {review.template_key} ·{" "}
              {review.template_version}
            </p>
            {review.attachment_snapshot.length ? (
              review.attachment_snapshot.map((file) => (
                <p key={file.artifact_id} className="break-all">
                  {file.file_name} · {file.mime_type} · {file.size_bytes} bytes
                  · SHA-256 {file.content_sha256}
                </p>
              ))
            ) : (
              <p>No attachments</p>
            )}
            {review.source_kind === "freshness" ? (
              <p>
                {initial.members.length} exact grouped opportunity members;
                current member and source gates are checked before delivery.
              </p>
            ) : null}
            <Link
              className="underline"
              href={`/emails/review/${encodeURIComponent(review.id)}`}
            >
              Open saved individual review and source history
            </Link>
          </div>
        </details>
        {!outcome ? (
          <label className="mt-3 flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              aria-label="Acknowledge complete message"
              checked={acknowledged}
              disabled={busy}
              onCheckedChange={(value) => setAcknowledged(value === true)}
            />
            <span>
              I have reviewed this complete recipient, subject, message, version
              and any attachments.
            </span>
          </label>
        ) : null}
      </details>
      {outcome ? (
        <p role="status" className="text-sm">
          {outcome}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onBack}>
          Back
        </Button>
        {!outcome ? (
          <Button
            disabled={busy || !acknowledged || !sendable}
            onClick={() => {
              setError("")
              startTransition(async () => {
                try {
                  const result = await approveAndSendStaffEmailReview(
                    review.id,
                    review.version,
                  )
                  if (result.success === false) setError(result.message)
                  else setOutcome(result.message)
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The message changed. Reopen the saved review.",
                  )
                }
                router.refresh()
              })
            }}
          >
            <Send className="size-3.5" />
            {busy ? "Working…" : "Send"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
