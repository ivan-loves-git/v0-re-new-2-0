"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { rejectOpportunityInterest } from "@/lib/actions/opportunity-matches"

export function StaffInterestRejectionControl({
  matchId, opportunityId, interestAt, updatedAt, rejection,
}: {
  matchId: string
  opportunityId: string
  interestAt: string | null
  updatedAt: string
  rejection?: { reason: string; decided_at: string; decided_by: string; delivery_status: string } | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  if (rejection) {
    return (
      <div className="flex max-w-sm flex-col gap-1 text-xs">
        <Badge variant="outline" className="w-fit">Interest not selected</Badge>
        <span className="text-muted-foreground">Staff-only reason: {rejection.reason}</span>
        <span className="text-muted-foreground">Recorded {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(rejection.decided_at))}</span>
        <span className={rejection.delivery_status === "review_required" ? "text-amber-700" : "text-muted-foreground"}>
          Client notice: {rejection.delivery_status === "sent" ? "sent"
            : rejection.delivery_status === "suppressed" ? "not dispatched (notification inactive or ineligible)"
            : rejection.delivery_status === "review_required" ? "delivery uncertain — staff review required"
            : "not confirmed — queued or retrying"}.
        </span>
      </div>
    )
  }
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); if (!next) setReason("") } }}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm"><XCircle data-icon="inline-start" />Reject this interest</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this exact interest?</AlertDialogTitle>
          <AlertDialogDescription>
            Add a short internal reason. The repreneur receives only a neutral outcome notice when that email is enabled. Their account, other opportunities and waiting lists do not change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor={`interest-reason-${matchId}`} className="text-sm font-medium">Internal reason (required)</label>
          <Textarea
            id={`interest-reason-${matchId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Briefly explain the staff decision"
          />
          <p className="text-xs text-muted-foreground">Visible to Re-New staff only. Maximum 500 characters.</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !reason.trim()}
            onClick={(event) => {
              event.preventDefault()
              setPending(true)
              void rejectOpportunityInterest(matchId, opportunityId, interestAt, updatedAt, reason).then((result) => {
                if (result.ok) {
                  toast.success("Interest decision recorded", { description: result.message })
                  setOpen(false)
                  setReason("")
                  router.refresh()
                } else {
                  toast.error("Interest not rejected", { description: result.message })
                }
              }).catch(() => toast.error("Interest not rejected", { description: "Refresh and try again." }))
                .finally(() => setPending(false))
            }}
          >{pending ? "Recording..." : "Record rejection"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
