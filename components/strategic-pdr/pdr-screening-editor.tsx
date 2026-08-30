"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { generateStrategicPdrScreening, saveStrategicPdrScreening } from "@/lib/actions/strategic-pdr"
import type { PdrScreeningContext, PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function PdrScreeningEditor({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [preview, setPreview] = useState<{ draft: PdrScreeningDraft; context: PdrScreeningContext; previewToken: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const generate = () => startTransition(async () => {
    setError(null); setPreview(null); setSaved(false)
    const form = new FormData(); form.set("request_id", requestId)
    const completed = preview?.draft.clarificationQuestions.map((question) => ({ question, answer: answers[question]?.trim() ?? "" })).filter((item) => item.answer) ?? []
    if (completed.length && preview) { form.set("clarification_answers", JSON.stringify(completed)); form.set("prior_preview_token", preview.previewToken); form.set("prior_draft", JSON.stringify(preview.draft)) }
    try { setPreview(await generateStrategicPdrScreening(form)) } catch (cause) { setError(cause instanceof Error ? cause.message : "Preview unavailable.") }
  })
  const save = () => startTransition(async () => {
    if (!preview) return
    setError(null)
    try { await saveStrategicPdrScreening({ requestId, previewToken: preview.previewToken, draft: preview.draft }); setPreview(null); setSaved(true); router.refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : "Screening could not be saved.") }
  })
  return <Card><CardHeader><CardTitle>AI screening preview</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
    <p className="text-muted-foreground">Advisory only. It cannot approve the request, change delivery, or create GitHub work. A preview is saved only when you explicitly save it.</p>
    <Button type="button" onClick={generate} disabled={pending}>{pending ? "Preparing preview…" : "Generate screening preview"}</Button>
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}{saved ? <p role="status">Screening saved. The history has refreshed.</p> : null}
    {preview ? <div className="space-y-3 border p-4"><p><strong>Context:</strong> {preview.context.registryRevision} · {preview.context.freshness} · snapshot {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(preview.context.snapshotAt))} UTC</p>
      <p><strong>Problem framing:</strong> {preview.draft.problemFraming}</p>
      <p><strong>Classification:</strong> {preview.draft.classification.replaceAll("_", " ")}</p><p><strong>Affected users:</strong> {preview.draft.affectedUsers}</p><p><strong>Desired outcome:</strong> {preview.draft.desiredOutcome}</p><p><strong>Success signal:</strong> {preview.draft.successSignal}</p>
      <p><strong>Clarifications:</strong></p>{preview.draft.clarificationQuestions.map((question, index) => <label key={question} className="block space-y-1"><span>{index + 1}. {question}</span><textarea aria-label={`Answer to clarification ${index + 1}`} className="w-full border p-2" maxLength={600} value={answers[question] ?? ""} onChange={(event) => setAnswers((previous) => ({ ...previous, [question]: event.target.value }))} /></label>)}
      <Button type="button" variant="outline" onClick={generate} disabled={pending || !preview.draft.clarificationQuestions.some((question) => answers[question]?.trim())}>{pending ? "Refining…" : "Refine with answers"}</Button>
      <p><strong>Success criteria:</strong></p><ul className="list-disc pl-5">{preview.draft.successCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
      <p><strong>Constraints and non-goals:</strong> {preview.draft.constraintsAndNonGoals.join("; ") || "none"}</p><p><strong>Unknowns:</strong> {preview.draft.unknowns.join("; ") || "none"}</p>
      <p><strong>Confidence:</strong> {preview.draft.confidence}</p><p><strong>Goal / Milestone:</strong> {preview.draft.suggestedGoalId ?? "none"} / {preview.draft.suggestedMilestoneId ?? "none"}</p><p><strong>Possible overlap:</strong> {preview.draft.overlappingProductChangeNumbers.join(", ") || "none"}</p><p><strong>Cautious technical impact:</strong> {preview.draft.technicalImpact ?? "none"}</p>
      <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save screening"}</Button>
    </div> : null}
  </CardContent></Card>
}
