"use client"

import { useState, useTransition } from "react"
import { generateStrategicPdrScreening, saveStrategicPdrScreening } from "@/lib/actions/strategic-pdr"
import type { PdrScreeningContext, PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function PdrScreeningEditor({ requestId }: { requestId: string }) {
  const [preview, setPreview] = useState<{ draft: PdrScreeningDraft; context: PdrScreeningContext; previewToken: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const generate = () => startTransition(async () => {
    setError(null); setPreview(null); setSaved(false)
    const form = new FormData(); form.set("request_id", requestId)
    try { setPreview(await generateStrategicPdrScreening(form)) } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview unavailable.") }
  })
  const save = () => startTransition(async () => {
    if (!preview) return
    setError(null)
    try { await saveStrategicPdrScreening({ requestId, previewToken: preview.previewToken, draft: preview.draft }); setPreview(null); setSaved(true) } catch (cause) { setError(cause instanceof Error ? cause.message : "Screening could not be saved.") }
  })
  return <Card><CardHeader><CardTitle>AI screening preview</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
    <p className="text-muted-foreground">Advisory only. It cannot approve the request, change delivery, or create GitHub work. A preview is saved only when you explicitly save it.</p>
    <Button type="button" onClick={generate} disabled={pending}>{pending ? "Preparing preview…" : "Generate screening preview"}</Button>
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}{saved ? <p role="status">Screening saved. The history has refreshed.</p> : null}
    {preview ? <div className="space-y-3 border p-4"><p><strong>Context:</strong> {preview.context.registryRevision} · {preview.context.freshness} · snapshot {new Date(preview.context.snapshotAt).toLocaleString()}</p>
      <p><strong>Problem framing:</strong> {preview.draft.problemFraming}</p>
      <p><strong>Clarifications:</strong></p><ul className="list-disc pl-5">{preview.draft.clarificationQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
      <p><strong>Success criteria:</strong></p><ul className="list-disc pl-5">{preview.draft.successCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="text-muted-foreground">Confidence: {preview.draft.confidence}. Goal: {preview.draft.suggestedGoalId ?? "none"}; Milestone: {preview.draft.suggestedMilestoneId ?? "none"}; overlaps: {preview.draft.overlappingProductChangeNumbers.join(", ") || "none"}.</p>
      <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save screening"}</Button>
    </div> : null}
  </CardContent></Card>
}
