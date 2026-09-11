"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { retryRecommendationAssignmentEmail } from "@/lib/actions/recommendation-assignment-notifications"
import type { OpportunityMatch } from "@/lib/types/opportunity"

export function StaffAssignmentEmailStatus({ matchId, status }: {
  matchId: string; status: OpportunityMatch["assignment_email_status"]
}) {
  const [message, setMessage] = useState<string>()
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  if (!status) return null
  const label = {
    sent: "Assignment email sent", unavailable: "Email status unavailable", pending: "Assignment email not confirmed",
    failed: "Assignment email not confirmed", blocked: "Assignment email blocked — staff review needed",
    review_required: "Earlier email attempt uncertain — provider review needed",
    delivery_issue: "Assignment email delivery problem — do not resend",
  }[status]
  return (
    <div className="mt-2 flex max-w-sm flex-col items-start gap-2">
      <Badge variant="outline" className="max-w-full whitespace-normal">{label}</Badge>
      {status === "pending" || status === "failed" ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => {
          try {
            const result = await retryRecommendationAssignmentEmail(matchId)
            setMessage(result.message)
            router.refresh()
          } catch {
            setMessage("Email status could not be checked. Refresh and try again.")
          }
        })}>{pending ? "Checking email..." : "Retry assignment email"}</Button>
      ) : null}
      {message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
