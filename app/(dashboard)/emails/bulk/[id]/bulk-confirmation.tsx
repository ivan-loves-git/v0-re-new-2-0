"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Send } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  acknowledgeStaffEmailBulkItem,
  confirmStaffEmailBulk,
  dispatchStaffEmailBulkItem,
  getStaffEmailBulk,
  reconcileStaffEmailBulkItem,
} from "@/lib/actions/staff-email-bulk"

type Record = Awaited<ReturnType<typeof getStaffEmailBulk>>

const outcomeText = {
  not_attempted: "Not attempted",
  started: "Claimed; result pending",
  accepted: "Accepted by provider",
  blocked: "Blocked before provider I/O",
  failed: "Conclusive failure",
  uncertain: "Outcome uncertain",
} as const

export function BulkEmailConfirmation({
  initial,
  embedded = false,
  onBack,
}: {
  initial: Record
  embedded?: boolean
  onBack?: () => void
}) {
  const router = useRouter()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [record, setRecord] = useState(initial)
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const { batch, items } = record
  const complete =
    items.length === batch.item_count &&
    items.every((item) => item.acknowledged_by === batch.prepared_by)
  const next = items.find((item) => item.state === "not_attempted")
  const started = items.find((item) => item.state === "started")
  const finished = items.filter(
    (item) => item.state !== "not_attempted" && item.state !== "started",
  )

  async function refresh() {
    const updated = await getStaffEmailBulk(batch.id)
    setRecord(updated)
    router.refresh()
    return updated
  }

  function run(action: () => Promise<void>) {
    setError("")
    setNotice("")
    startTransition(async () => {
      try {
        await action()
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "This batch changed. Reload and inspect it.",
        )
      }
    })
  }

  async function processRemaining() {
    const began = Date.now()
    let latest = await refresh()
    for (;;) {
      if (latest.items.length !== batch.item_count) {
        setNotice(
          "A selected message is no longer present. Stop this batch and inspect the individual source history.",
        )
        break
      }
      const pending = latest.items.find(
        (item) => item.state === "not_attempted",
      )
      if (
        !pending ||
        latest.items.some(
          (item) => item.ordinal < pending.ordinal && item.state === "started",
        )
      )
        break
      if (
        !mounted.current ||
        document.visibilityState !== "visible" ||
        Date.now() - began > 45_000
      ) {
        setNotice(
          "The remaining messages were not attempted. Reopen this same confirmed batch to continue.",
        )
        break
      }
      // Each awaited server action is one item and one request. Reload/status
      // reads never send, and a claimed item can never be dispatched twice.
      const outcome = await dispatchStaffEmailBulkItem(
        batch.id,
        pending.ordinal,
      )
      latest = await refresh()
      if (outcome.state === "started" || outcome.state === "uncertain") {
        setNotice(
          "An item needs receipt-only reconciliation. Later messages remain not attempted.",
        )
        break
      }
    }
  }

  function acknowledge(item: Record["items"][number]) {
    run(async () => {
      await acknowledgeStaffEmailBulkItem(batch.id, item.ordinal, item.snapshot_sha256)
      await refresh()
    })
  }
  function confirmAndSend() {
    run(async () => {
      await confirmStaffEmailBulk(batch.id, batch.manifest_sha256)
      await refresh()
      await processRemaining()
    })
  }

  if (embedded)
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Action not completed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {items.length !== batch.item_count ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Batch record incomplete</AlertTitle>
            <AlertDescription>
              A selected message is no longer present. Stop this batch and
              inspect the individual source history.
            </AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}
        {items.map((item) => {
          const message = item.review_snapshot
          const recipient = record.recipients?.[item.review_id]
          const name = recipient?.recipient_email === message.recipient_email ? recipient.recipient_name : null
          const acknowledged = item.acknowledged_by === batch.prepared_by
          return (
            <details
              key={item.ordinal}
              className="min-w-0 rounded-lg border p-3"
              open={batch.item_count === 1 || undefined}
            >
              <summary className="cursor-pointer">
                <span className="font-medium break-all">
                  {name ?? message.recipient_email}
                </span>{" "}
                {name ? <span className="text-muted-foreground text-xs">{message.recipient_email}</span> : null}
                <p className="mt-1 text-sm">{message.subject}</p>
                {batch.confirmed_at ? (
                  <Badge
                    variant={
                      item.state === "uncertain" ? "destructive" : "outline"
                    }
                  >
                    {outcomeText[item.state]}
                  </Badge>
                ) : null}
              </summary>
              <p className="mt-3 border-t pt-3 whitespace-pre-wrap break-words text-sm leading-6">
                {message.body_text}
              </p>
              <details className="mt-3 rounded-lg border p-3 text-xs">
                <summary className="cursor-pointer font-medium">
                  More details
                </summary>
                <div className="mt-2 space-y-2">
                  <p>
                    Reviewed version {message.version} · {message.namespace}
                  </p>
                  <p className="break-all">
                    {message.source_kind.toUpperCase()} · {message.template_key}{" "}
                    · {message.template_version}
                  </p>
                  {message.attachment_snapshot.length ? (
                    <>
                      <p>Exact signed attachments</p>
                      {message.attachment_snapshot.map((file) => (
                        <p key={file.artifact_id} className="break-all">
                          {file.file_name} · {file.mime_type} ·{" "}
                          {file.size_bytes} bytes · SHA-256{" "}
                          {file.content_sha256}
                        </p>
                      ))}
                    </>
                  ) : (
                    <p>No attachments</p>
                  )}
                  {message.source_kind === "freshness" ? (
                    <p>
                      {item.members_snapshot.length} frozen opportunity members;
                      current group and source gates are checked before
                      delivery.
                    </p>
                  ) : null}
                  <p>
                    Accepted means the provider returned an authoritative
                    receipt, not inbox delivery or reading. A claimed or
                    uncertain item is never automatically retried here.
                  </p>
                  <Link
                    className="underline"
                    href={`/emails/review/${encodeURIComponent(item.review_id)}`}
                  >
                    Open individual review and source history
                  </Link>
                </div>
              </details>
              {!batch.confirmed_at ? (
                <label className="mt-3 flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox
                    aria-label={`Acknowledge complete message ${item.ordinal}`}
                    checked={acknowledged}
                    disabled={busy || acknowledged}
                    onCheckedChange={(checked) => {
                      if (checked === true) acknowledge(item)
                    }}
                  />
                  <span>
                    I have reviewed this complete recipient, subject, message,
                    version and any attachments.
                  </span>
                </label>
              ) : null}
              {item.outcome_detail ? (
                <p role="status" className="mt-3 text-sm">
                  {item.outcome_detail}
                </p>
              ) : null}
              {item.state === "started" || item.state === "uncertain" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="mt-3"
                  onClick={() =>
                    run(async () => {
                      const result = await reconcileStaffEmailBulkItem(
                        batch.id,
                        item.ordinal,
                      )
                      setNotice(result.message)
                      await refresh()
                    })
                  }
                >
                  Check recorded receipt only
                </Button>
              ) : null}
            </details>
          )
        })}
        {!batch.confirmed_at ? (
          <>
            <p className="text-xs text-muted-foreground">
              {
                items.filter(
                  (item) => item.acknowledged_by === batch.prepared_by,
                ).length
              }{" "}
              of {batch.item_count} complete messages acknowledged.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={onBack}>
                Back
              </Button>
              <Button
                disabled={busy || !complete}
                onClick={confirmAndSend}
              >
                <Send className="size-3.5" />
                {busy
                  ? "Working…"
                  : batch.item_count > 1
                    ? `Send ${batch.item_count} emails`
                    : "Send"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p role="status" className="text-xs text-muted-foreground">
              {finished.length} of {batch.item_count} messages have a recorded
              individual result.
            </p>
            {started ? (
              <p className="text-xs text-muted-foreground">
                Check the claimed message's receipt before continuing.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={onBack}>
                Back
              </Button>
              {next ? (
                <Button
                  disabled={
                    busy ||
                    Boolean(started) ||
                    items.length !== batch.item_count
                  }
                  onClick={() => run(processRemaining)}
                >
                  Continue remaining{" "}
                  {
                    items.filter((item) => item.state === "not_attempted")
                      .length
                  }
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    )

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="wave-micro-label">Email operations · bounded send</p>
        <h1 className="text-2xl font-semibold">Review every message</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">This saved batch contains {batch.item_count} exact reviewed message{batch.item_count === 1 ? "" : "s"}. Each needs its own acknowledgment. One final confirmation then processes messages serially.</p>
      </div>
      <Button asChild variant="outline" size="sm"><Link href="/emails">Back to review queue</Link></Button>
    </div>
    {error ? <Alert variant="destructive" role="alert"><AlertTitle>Action not completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    {items.length !== batch.item_count ? <Alert variant="destructive" role="alert"><AlertTitle>Batch record incomplete</AlertTitle><AlertDescription>A selected message is no longer present. Stop this batch and inspect the individual source history.</AlertDescription></Alert> : null}
    {notice ? <Alert role="status"><AlertTitle>Batch paused safely</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert> : null}
    <Alert><AlertTitle>Delivery boundary</AlertTitle><AlertDescription>Accepted means the provider returned an authoritative receipt. It does not mean inbox delivery or reading. A claimed or uncertain item is never automatically retried here; use its individual review and receipt evidence.</AlertDescription></Alert>

    <div className="grid gap-4">
      {items.map((item) => {
        const message = item.review_snapshot
        const acknowledged = item.acknowledged_by === batch.prepared_by
        return <Card key={item.ordinal}>
          <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Message {item.ordinal} of {batch.item_count}</CardTitle>
            <Badge variant={item.state === "uncertain" ? "destructive" : item.state === "accepted" ? "secondary" : "outline"}>{outcomeText[item.state]}</Badge>
          </div></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Exact recipient</dt><dd className="break-all font-medium">{message.recipient_email}</dd></div>
              <div><dt className="text-muted-foreground">Reviewed version</dt><dd>{message.version}</dd></div>
              <div><dt className="text-muted-foreground">Source and template</dt><dd className="break-all">{message.source_kind.toUpperCase()} · {message.template_key} · {message.template_version}</dd></div>
              <div><dt className="text-muted-foreground">Frozen attachments</dt><dd>{message.attachment_snapshot.length === 0 ? "None" : `${message.attachment_snapshot.length} exact signed PDF${message.attachment_snapshot.length === 1 ? "" : "s"}`}</dd></div>
            </dl>
            <div className="space-y-1"><p className="font-medium">Complete subject</p><p className="whitespace-pre-wrap break-words rounded-md border p-3">{message.subject}</p></div>
            <div className="space-y-1"><p className="font-medium">Complete message</p><pre className="max-h-[38rem] overflow-auto whitespace-pre-wrap break-words rounded-md border p-3 font-sans">{message.body_text}</pre></div>
            {message.attachment_snapshot.length ? <div className="space-y-1"><p className="font-medium">Exact attachment metadata</p>
              {message.attachment_snapshot.map((file) => <p key={file.artifact_id} className="break-all rounded-md border p-2 text-xs">{file.file_name} · {file.mime_type} · {file.size_bytes} bytes · SHA-256 {file.content_sha256}</p>)}
            </div> : null}
            {message.source_kind === "freshness" ? <p className="rounded-md border p-3 text-muted-foreground">Frozen grouped membership: {item.members_snapshot.length} exact opportunity member{item.members_snapshot.length === 1 ? "" : "s"}. Current group membership and source eligibility are checked again immediately before delivery.</p> : null}
            {!batch.confirmed_at ? <label className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox aria-label={`Acknowledge complete message ${item.ordinal}`} checked={acknowledged} disabled={busy || acknowledged}
                onCheckedChange={(checked) => { if (checked === true) acknowledge(item) }} />
              <span>I have reviewed this complete recipient, subject, message, version and any attachments.</span>
            </label> : null}
            {item.outcome_detail ? <Alert><AlertTitle>Recorded result</AlertTitle><AlertDescription>{item.outcome_detail}</AlertDescription></Alert> : null}
            {item.state === "started" || item.state === "uncertain" ? <Button type="button" variant="outline" disabled={busy}
              onClick={() => run(async () => { const result = await reconcileStaffEmailBulkItem(batch.id, item.ordinal); setNotice(result.message); await refresh() })}>
              Check recorded receipt only
            </Button> : null}
            <Button asChild variant="link" className="h-auto p-0"><Link href={`/emails/review/${encodeURIComponent(item.review_id)}`}>Open individual review and source history</Link></Button>
          </CardContent>
        </Card>
      })}
    </div>
    {!batch.confirmed_at ? <Card><CardContent className="space-y-3 pt-6">
      <p className="text-sm text-muted-foreground">{items.filter((item) => item.acknowledged_by === batch.prepared_by).length} of {batch.item_count} complete messages acknowledged. Final confirmation is available only while every exact draft remains current.</p>
      <Button disabled={busy || !complete} onClick={confirmAndSend}>Confirm all and start serial delivery</Button>
    </CardContent></Card> : <Card><CardContent className="space-y-3 pt-6">
      <p className="font-medium">{finished.length} of {batch.item_count} messages have a recorded individual result.</p>
      {started ? <p className="text-sm text-muted-foreground">A claimed message remains in progress or unknown. Check its receipt before continuing.</p> : null}
      {next ? <Button disabled={busy || Boolean(started) || items.length !== batch.item_count} onClick={() => run(processRemaining)}>Continue remaining {items.filter((item) => item.state === "not_attempted").length} message{items.filter((item) => item.state === "not_attempted").length === 1 ? "" : "s"}</Button>
        : <p className="text-sm text-muted-foreground">No messages remain unattempted. Review each result above; this batch is not one atomic success.</p>}
    </CardContent></Card>}
  </div>
}
