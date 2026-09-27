"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { recordVisibleDetail } from "@/lib/utils/record-visible-detail"
import { Check, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { recordMyOpportunityViewed, setMyOpportunityReviewed } from "@/lib/actions/repreneur-opportunity-review"
import type { RepreneurPersonalReview } from "@/lib/types/opportunity"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"
import { publicDealOutcome } from "@/lib/i18n/deal-outcomes"
import type { UiCopyKey } from "@/lib/i18n/ui-copy"

export function PersonalReviewHint({ state }: { state: RepreneurPersonalReview | null | undefined }) {
  const copy = useUiCopy()
  if (state === undefined) return null
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    {state?.reviewed ? <Check className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
    {copy(state === null ? "Review status unavailable" : state.reviewed ? "Reviewed" : state.viewed ? "Viewed" : "Not yet viewed")}
  </span>
}

export function RepreneurPersonalReviewControl({
  opportunityId, initialState, detail = false, affectsOrder = false, onUndo,
}: {
  opportunityId: string
  initialState: RepreneurPersonalReview | null | undefined
  detail?: boolean
  affectsOrder?: boolean
  onUndo?: () => void
}) {
  const language = useUiLanguage()
  const copy = useUiCopy()
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState<UiCopyKey | null>(null)
  const [retry, setRetry] = useState(0)
  const [serverState, setServerState] = useState(initialState)
  if (serverState?.viewed !== initialState?.viewed || serverState?.reviewed !== initialState?.reviewed) {
    setServerState(initialState)
    setState(initialState)
  }

  useEffect(() => {
    if (!detail) return
    return recordVisibleDetail(document, () => recordMyOpportunityViewed(opportunityId), {
      start: () => { setPending(true); setError("") },
      result: (result) => {
        if (result.ok) setState(result.state)
        else setError(result.message)
      },
      error: () => setError("Your viewed status could not be saved. Please try again."),
      settled: () => setPending(false),
    })
  }, [detail, opportunityId, retry])

  async function update(reviewed: boolean) {
    if (!state?.viewed || pending) return
    setPending(true)
    setError("")
    setNotice(null)
    try {
      const result = await setMyOpportunityReviewed(opportunityId, reviewed, state.reviewed)
      if (!result.ok) { setError(result.message); return }
      setState(result.state)
      setNotice(reviewed
        ? affectsOrder ? "Marked as reviewed. It will appear below unreviewed deals in this section." : "Marked as reviewed. Your response is unchanged."
        : "Review mark removed. Your viewed status is kept.")
      if (!detail) {
        onUndo?.()
        toast.success(copy("Review mark removed. Your viewed status is kept."))
      }
      router.refresh()
    } catch {
      setError("Your review status could not be saved. Please try again.")
    } finally { setPending(false) }
  }

  if (!detail && !state?.reviewed) return null
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${detail ? "border-t pt-4" : "lg:items-end"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {detail ? <PersonalReviewHint state={state} /> : null}
        <Button type="button" size="sm" variant="ghost" disabled={pending || !state?.viewed}
          onClick={() => update(!state?.reviewed)}>
          {copy(pending ? "Saving…" : state?.reviewed ? "Undo reviewed" : "Mark as reviewed")}
        </Button>
      </div>
      {detail ? <p className="text-xs text-muted-foreground">
        {copy("Finished reviewing for now? Mark it here without expressing interest or declining.")}
        {" "}{copy(affectsOrder ? "Reviewed deals move below unreviewed deals in their section." : "This does not change its section or priority.")}
      </p> : null}
      {detail ? <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{notice ? copy(notice) : null}</p> : null}
      {error ? <div role="alert" className="text-xs text-destructive">
        <p>{publicDealOutcome(error, language, "Your review status could not be saved. Please try again.")}</p>
        {detail && !state?.viewed ? <Button size="sm" variant="outline" disabled={pending} onClick={() => setRetry((value) => value + 1)}>{copy("Retry saving viewed")}</Button> : null}
      </div> : null}
    </div>
  )
}
