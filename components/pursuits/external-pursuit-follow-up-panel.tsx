"use client"

import { useId, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { CalendarClock, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { updateExternalPursuitFollowUp } from "@/lib/actions/external-pursuits"
import {
  EXTERNAL_PURSUIT_AVAILABILITY,
  type ExternalPursuitAvailability,
  type ExternalPursuitFollowUpSnapshot,
  type ExternalPursuitResponsibleParty,
} from "@/lib/types/external-pursuit"
import { externalPursuitFollowUpAttempt, externalPursuitFollowUpPatch } from "@/lib/external-pursuit-follow-up"
import { externalPursuitDueState, externalPursuitDueStateLabel } from "@/lib/utils/external-pursuit-due-state"

export type ExternalPursuitFollowUpPanelProps = {
  pursuitId: string
  role: "staff" | "repreneur"
  followUp: ExternalPursuitFollowUpSnapshot
  onSaved?: () => void
}

const availabilityLabels: Record<ExternalPursuitAvailability, string> = {
  available: "Available",
  limited: "Limited availability",
  unavailable: "Unavailable",
  unknown: "Availability unknown",
}

const stateTone = {
  no_date: "border-border bg-muted text-muted-foreground",
  due_today: "border-amber-300 bg-amber-50 text-amber-950",
  upcoming: "border-sky-200 bg-sky-50 text-sky-950",
  overdue: "border-destructive/25 bg-destructive/10 text-destructive",
} as const

/**
 * Self-contained W-107 panel. The board can mount it later; it owns no route,
 * title or stage control and makes every allowed follow-up state explicit.
 */
export function ExternalPursuitFollowUpPanel({
  pursuitId,
  role,
  followUp,
  onSaved,
}: ExternalPursuitFollowUpPanelProps) {
  const prefix = useId()
  const baselineRef = useRef<ExternalPursuitFollowUpSnapshot>(followUp)
  const attemptRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [nextAction, setNextAction] = useState(followUp.nextAction ?? "")
  const [responsibleParty, setResponsibleParty] = useState<ExternalPursuitResponsibleParty | "">(followUp.responsibleParty ?? "")
  const [availability, setAvailability] = useState<ExternalPursuitAvailability>(followUp.availability)
  const [dueAt, setDueAt] = useState(followUp.dueAt ?? "")
  const [sharedNotes, setSharedNotes] = useState(followUp.sharedNotes ?? "")
  const [staffInternalNotes, setStaffInternalNotes] = useState(followUp.staffInternalNotes ?? "")
  const [formError, setFormError] = useState<string | null>(null)
  const dueState = externalPursuitDueState(dueAt || null)

  function submit() {
    const trimmedAction = nextAction.trim()
    if (Boolean(trimmedAction) !== Boolean(responsibleParty)) {
      setFormError("Set a responsible party for a next action, or clear both fields.")
      return
    }
    const current: ExternalPursuitFollowUpSnapshot = {
      nextAction: trimmedAction || null,
      responsibleParty: responsibleParty || null,
      availability,
      dueAt: dueAt || null,
      sharedNotes,
      ...(role === "staff" ? { staffInternalNotes } : {}),
    }
    const patch = externalPursuitFollowUpPatch(baselineRef.current, current, role)
    if (!patch) {
      toast.message("Follow-up is already current")
      return
    }
    const attempt = externalPursuitFollowUpAttempt(
      attemptRef.current,
      patch,
      () => globalThis.crypto.randomUUID(),
    )
    attemptRef.current = attempt
    setFormError(null)
    startTransition(async () => {
      let result
      try {
        result = await updateExternalPursuitFollowUp(pursuitId, patch, attempt.idempotencyKey)
      } catch {
        const retryMessage = "The save result is unclear. Retry to safely confirm it."
        setFormError(retryMessage)
        toast.error("Follow-up not confirmed", { description: retryMessage })
        return
      }
      if (!result.success) {
        setFormError(result.message)
        toast.error("Follow-up not updated", { description: result.message })
        return
      }
      baselineRef.current = current
      attemptRef.current = null
      toast.success("Follow-up updated")
      onSaved?.()
    })
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4" /> Follow-up</CardTitle>
          <Badge variant="outline" className={stateTone[dueState]}>{externalPursuitDueStateLabel(dueState)}</Badge>
        </div>
        <CardDescription>Keep the next concrete step, availability and notes current. This does not send reminders or messages.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {formError ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${prefix}-next-action`}>Next action</Label>
            <Input id={`${prefix}-next-action`} value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="For example, request the information memorandum" disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-responsible-party`}>Responsible</Label>
            <div className="flex gap-2">
              <Select value={responsibleParty} onValueChange={(value) => setResponsibleParty(value as ExternalPursuitResponsibleParty)} disabled={isPending}>
                <SelectTrigger id={`${prefix}-responsible-party`} className="w-full"><SelectValue placeholder="Choose responsibility" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="staff">Re-New staff</SelectItem>
                </SelectContent>
              </Select>
              {responsibleParty ? <Button type="button" variant="outline" onClick={() => { setNextAction(""); setResponsibleParty("") }} disabled={isPending}>Clear</Button> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-due-at`}>Due date</Label>
            <Input id={`${prefix}-due-at`} type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${prefix}-availability`}>Availability</Label>
            <Select value={availability} onValueChange={(value) => setAvailability(value as ExternalPursuitAvailability)} disabled={isPending}>
              <SelectTrigger id={`${prefix}-availability`} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{EXTERNAL_PURSUIT_AVAILABILITY.map((value) => <SelectItem key={value} value={value}>{availabilityLabels[value]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-shared-notes`}>Shared notes</Label>
          <Textarea id={`${prefix}-shared-notes`} value={sharedNotes} onChange={(event) => setSharedNotes(event.target.value)} disabled={isPending} />
        </div>
        {role === "staff" ? <div className="space-y-2 rounded-md border bg-muted/30 p-4">
          <Label htmlFor={`${prefix}-staff-notes`}>Staff-only notes</Label>
          <p className="text-sm text-muted-foreground">Visible to Re-New staff only; never shown in the owner portal.</p>
          <Textarea id={`${prefix}-staff-notes`} value={staffInternalNotes} onChange={(event) => setStaffInternalNotes(event.target.value)} disabled={isPending} />
        </div> : null}
        <Button type="button" onClick={submit} disabled={isPending}>
          <Save className="size-4" /> {isPending ? "Saving…" : "Save follow-up"}
        </Button>
      </CardContent>
    </Card>
  )
}
