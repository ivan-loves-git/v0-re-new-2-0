"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { recordMemoFeedback, type MemoFeedbackChannel } from "@/lib/actions/memo-feedback"
import type { StaffMemoFeedbackProjection } from "@/lib/data/current-pursuit"
import { parisInstantsForLocal, parisLocalInputNow } from "@/lib/utils/paris-local-date-time"
import { formatPursuitDateTime } from "@/lib/utils/pursuit-date-time"

const REMINDER_LABEL: Record<StaffMemoFeedbackProjection["reminderStatus"], string> = {
  pending: "Pending due-date and eligibility checks",
  failed: "Delivery not confirmed; bounded retry pending",
  sent: "Reminder sent",
  suppressed: "Reminder suppressed or cancelled",
  review_required: "Delivery review required; no blind resend",
  not_scheduled: "No new reminder scheduled for this historical grant",
}

export function StaffMemoFeedbackControl({
  matchId, feedback, canRecord,
}: {
  matchId: string
  feedback: StaffMemoFeedbackProjection
  canRecord: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [channel, setChannel] = useState<MemoFeedbackChannel | "">("")
  const [localReceivedAt, setLocalReceivedAt] = useState("")
  const [nowInstant, setNowInstant] = useState("")
  const [foldInstant, setFoldInstant] = useState("")
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const instants = parisInstantsForLocal(localReceivedAt)

  function submit() {
    setMessage(null)
    if (!channel || instants.length === 0 || (instants.length === 2 && !nowInstant && !instants.includes(foldInstant))) {
      setMessage({ error: true, text: instants.length === 0 && localReceivedAt
        ? "This clock time does not exist in Paris. Choose another received time."
        : "Choose the channel, Paris receipt time, and exact repeated-hour occurrence if shown." })
      return
    }
    const receivedAt = nowInstant || (instants.length === 1 ? instants[0] : foldInstant)
    startTransition(async () => {
      const result = await recordMemoFeedback({
        matchId, grantEvidenceId: feedback.grantEvidenceId,
        channel, receivedAt,
      })
      setMessage({ error: !result.success, text: result.message })
      if (result.success) router.refresh()
    })
  }

  return <section className="space-y-3 border-t pt-4" aria-label="Exact memo feedback receipt">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="font-medium">Memo feedback</h3>
      <Badge variant="outline">Grant {feedback.grantEvidenceId.slice(0, 8)}</Badge>
      <Badge variant={feedback.reminderStatus === "review_required" ? "destructive" : "secondary"}>
        {REMINDER_LABEL[feedback.reminderStatus]}
      </Badge>
    </div>
    <p className="text-sm text-muted-foreground">Access granted {formatPursuitDateTime(feedback.grantedAt)}.
      {feedback.reminderDueAt ? ` Reminder due no earlier than ${formatPursuitDateTime(feedback.reminderDueAt)} (Paris, five Monday–Friday days), only while access and email policy remain valid.` : ""}
    </p>
    {feedback.receipt ? <p className="text-sm" role="status">
      Substantive feedback received by {feedback.receipt.channel} at {formatPursuitDateTime(feedback.receipt.receivedAt)}.
      Recorded by {feedback.receipt.actor} at {formatPursuitDateTime(feedback.receipt.recordedAt)}.
    </p> : canRecord ? <div className="grid min-w-0 grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0 space-y-2">
        <Label htmlFor="memo-feedback-channel">Substantive feedback received by</Label>
        <select id="memo-feedback-channel" aria-label="Feedback channel" value={channel}
          onChange={(event) => setChannel(event.target.value as MemoFeedbackChannel | "")}
          className="border-input flex h-9 min-w-0 w-full rounded-md border bg-card px-3 text-sm">
          <option value="">Choose channel</option><option value="email">Email</option><option value="phone">Phone</option>
        </select>
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor="memo-feedback-received-at">Received at (Paris local time)</Label>
        <div className="flex min-w-0 gap-2"><Input id="memo-feedback-received-at" type="datetime-local" step="1"
          className="min-w-0 flex-1"
          value={localReceivedAt} onChange={(event) => { setLocalReceivedAt(event.target.value); setFoldInstant(""); setNowInstant("") }} />
          <Button type="button" variant="outline" className="shrink-0" onClick={() => { const now = new Date(); setLocalReceivedAt(parisLocalInputNow(now)); setNowInstant(now.toISOString()); setFoldInstant("") }}>Now</Button>
        </div>
      </div>
      <Button disabled={pending} onClick={submit} className="min-w-0 w-full sm:w-auto" data-wave-action="confirm" data-wave-workflow="portal_pursuit">
        {pending ? "Recording..." : "Record feedback received"}
      </Button>
      {instants.length === 2 && !nowInstant ? <div className="sm:col-span-3 space-y-1">
        <Label htmlFor="memo-feedback-fold">This Paris hour occurred twice. Select the actual occurrence.</Label>
        <select id="memo-feedback-fold" value={foldInstant} onChange={(event) => setFoldInstant(event.target.value)}
          className="border-input flex h-9 w-full rounded-md border bg-card px-3 text-sm">
          <option value="">Choose occurrence</option>
          <option value={instants[0]}>First occurrence (summer offset, UTC+02:00)</option>
          <option value={instants[1]}>Second occurrence (winter offset, UTC+01:00)</option>
        </select>
      </div> : null}
      <p className="text-xs text-muted-foreground sm:col-span-3">Record only feedback actually received for this exact memo grant. Viewing the memo or adding a staff note does not count. The internal receipt is not shown in the repreneur portal.</p>
    </div> : <p className="text-sm text-muted-foreground">Access is no longer current. Refresh or review the grant before recording new feedback.</p>}
    {message ? <p role={message.error ? "alert" : "status"}
      className={message.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{message.text}</p> : null}
  </section>
}
