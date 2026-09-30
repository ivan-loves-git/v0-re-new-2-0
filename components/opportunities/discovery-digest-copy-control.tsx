"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { approveDiscoveryDigestCopy, type DiscoveryDigestCopyState } from "@/lib/actions/discovery-digest"

export function DiscoveryDigestCopyControl({ opportunityId, publicTitle, teaserSummary, initial }: {
  opportunityId: string
  publicTitle: string | null | undefined
  teaserSummary: string | null | undefined
  initial: DiscoveryDigestCopyState
}) {
  const ready = initial.currentCopyReady
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Discovery email copy</span>
        <Badge variant={ready ? "secondary" : "outline"}>{ready ? "Exact public copy approved" : "Not approved"}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {initial.futureOrdinaryOrigin
          ? "Only this exact public title and approved public description can enter a future three-day digest. Approval does not send email."
          : "This opportunity has no post-release ordinary staff creation origin and cannot enter the future digest."}
      </p>
      {initial.futureOrdinaryOrigin ? (
        <dl className="grid w-full gap-2 rounded-md bg-background p-3 text-xs sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Exact public title</dt>
            <dd className="mt-1 whitespace-pre-wrap font-medium">{publicTitle || "Missing"}</dd></div>
          <div><dt className="text-muted-foreground">Exact public teaser</dt>
            <dd className="mt-1 whitespace-pre-wrap">{teaserSummary || "Missing"}</dd></div>
        </dl>
      ) : null}
      {initial.futureOrdinaryOrigin && !ready ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => {
          setError(null)
          startTransition(async () => {
            try {
              await approveDiscoveryDigestCopy(opportunityId, publicTitle ?? "", teaserSummary ?? "")
              router.refresh()
            }
            catch { setError("Exact public title and currently approved description are required. No email was sent.") }
          })
        }}>{pending ? "Checking…" : "Approve this exact public copy"}</Button>
      ) : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
