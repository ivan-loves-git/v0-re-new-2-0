"use client"

import { useActionState, useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { renewOpportunityRecommendationAction, type RenewOpportunityRecommendationState } from "@/lib/actions/renew-opportunity-recommendation"
import { isRecommendationResponseExpired } from "@/lib/opportunity-recommendation-window"

const INITIAL_STATE: RenewOpportunityRecommendationState = { status: "idle", message: "" }

export function StaffRecommendationRenewAction({ matchId, status, expiresAt }: { matchId: string; status: string; expiresAt?: string | null }) {
  const [state, formAction, pending] = useActionState(renewOpportunityRecommendationAction, INITIAL_STATE)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  if (status !== "proposed") return null
  if (expiresAt && !isRecommendationResponseExpired(expiresAt, now.toISOString())) {
    return <p className="mt-1 text-xs text-muted-foreground">Respond by {new Date(expiresAt).toLocaleString("en-GB", { timeZone: "Europe/Paris", timeZoneName: "short" })}</p>
  }
  const unclocked = !expiresAt
  return (
    <div className="mt-2 flex max-w-xs flex-col gap-2">
      <p className="text-xs text-muted-foreground">{unclocked ? "Historical recommendation: no response deadline yet." : "Response window expired. The deal remains visible but new interest is blocked."}</p>
      <form action={formAction}>
        <input type="hidden" name="match_id" value={matchId} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Saving..." : unclocked ? "Start 72-hour window" : "Renew 72-hour window"}</Button>
      </form>
      {state.status !== "idle" ? <Alert variant={state.status === "error" ? "destructive" : "default"}><AlertTitle>{state.status === "success" ? "Recommendation renewed" : "Renewal unavailable"}</AlertTitle><AlertDescription>{state.message}</AlertDescription></Alert> : null}
    </div>
  )
}
