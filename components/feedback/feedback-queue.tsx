"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  deleteRepreneurFeedback,
  redactRepreneurFeedback,
  setRepreneurFeedbackStatus,
  type StaffFeedbackResult,
} from "@/lib/actions/repreneur-feedback"
import type { StaffFeedbackItem } from "@/lib/repreneur-feedback/data"
import { type FeedbackStatus } from "@/lib/repreneur-feedback/validation"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

const categoryLabels = {
  improvement: "Improvement",
  difficulty: "Difficulty",
  other: "Other",
} as const

const contextLabels = {
  portal_deals: "Deals",
  portal_profile: "Profile",
  portal_other: "Other portal area",
} as const

function FeedbackCard({ item }: { item: StaffFeedbackItem }) {
  const router = useRouter()
  const [nextStatus, setNextStatus] = useState<FeedbackStatus>(item.status)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)

  async function run(operation: () => Promise<StaffFeedbackResult>) {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError("")
    try {
      const result = await operation()
      if (result.ok) router.refresh()
      else setError(result.message)
    } catch {
      setError("This feedback action could not be saved. Refresh and try again.")
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{item.repreneurName}</span>
          <span className="text-xs font-normal text-muted-foreground">{categoryLabels[item.category]} · {item.context ? contextLabels[item.context] : "No area selected"}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Received {new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {item.message === null
          ? <p className="rounded-md bg-muted p-3 text-sm italic text-muted-foreground">Message redacted by staff.</p>
          : <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">{item.message}</p>}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 space-y-1.5">
            <Label htmlFor={`feedback-status-${item.id}`}>Triage state</Label>
            <select id={`feedback-status-${item.id}`} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as FeedbackStatus)} disabled={pending} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="new">New</option>
              <option value="routed">Routed</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <Button size="sm" disabled={pending || nextStatus === item.status} onClick={() => run(() => setRepreneurFeedbackStatus({ id: item.id, expectedVersion: item.version, status: nextStatus }))}>Save state</Button>
          {item.message !== null ? (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={pending}>Redact message</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Redact this message?</AlertDialogTitle><AlertDialogDescription>The message text is removed now. The remaining feedback record still expires 90 days after it was created.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => run(() => redactRepreneurFeedback({ id: item.id, expectedVersion: item.version }))}>Redact</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={pending}>Delete</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete this feedback?</AlertDialogTitle><AlertDialogDescription>This permanently removes this submission before its 90-day expiry.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => run(() => deleteRepreneurFeedback({ id: item.id, expectedVersion: item.version }))}>Delete feedback</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

export function FeedbackQueue({ items }: { items: StaffFeedbackItem[] }) {
  if (!items.length) {
    return <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No feedback in this state right now.</p>
  }
  return <div className="grid gap-4">{items.map((item) => <FeedbackCard key={`${item.id}-${item.version}`} item={item} />)}</div>
}
