"use client"

import * as React from "react"
import { Check, Clipboard, Loader2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { WAVE_AI_EMAIL_TEMPLATES } from "@/lib/ai/email-templates"
import { WAVE_AI_PROMPT_VERSION } from "@/lib/ai/config"
import type { WaveAiEmailDraftResponse } from "@/lib/ai/email-contract"
import type { WaveAiCustomTemplate } from "@/lib/actions/wave-ai"
import { captureWaveEvent } from "@/lib/telemetry/runtime"
import { WaveAiRepreneurSearch, type WaveAiRepreneurOption } from "./repreneur-search"

type FeedbackReason = "wrong_fact" | "not_relevant" | "poor_wording" | "missing_context" | "other_without_text"

async function recordEvent(
  generationId: string,
  eventType: string,
  reasonCode?: FeedbackReason,
) {
  await fetch("/api/wave-ai/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ generationId, eventType, reasonCode }),
  }).catch(() => undefined)
}

export function WaveAiTool({
  customTemplates,
  preselectedRepreneurId,
}: {
  customTemplates: WaveAiCustomTemplate[]
  preselectedRepreneurId?: string
}) {
  const [repreneurs, setRepreneurs] = React.useState<WaveAiRepreneurOption[]>([])
  const [loadingRepreneurs, setLoadingRepreneurs] = React.useState(true)
  const [selectedRepreneur, setSelectedRepreneur] = React.useState<WaveAiRepreneurOption | null>(null)
  const [templateId, setTemplateId] = React.useState("follow-up")
  const [language, setLanguage] = React.useState<"fr" | "en">("fr")
  const [customInstructions, setCustomInstructions] = React.useState("")
  const [draft, setDraft] = React.useState<WaveAiEmailDraftResponse | null>(null)
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [generating, setGenerating] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [editRecorded, setEditRecorded] = React.useState(false)
  const [feedback, setFeedback] = React.useState<"helpful" | "not_helpful" | null>(null)
  const [feedbackReason, setFeedbackReason] = React.useState<FeedbackReason | "">("")
  const [feedbackRecorded, setFeedbackRecorded] = React.useState(false)

  React.useEffect(() => {
    let active = true
    fetch("/api/wave-ai/repreneurs", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("recipient_projection_failed")
        return response.json()
      })
      .then((data) => {
        if (!active) return
        const options = Array.isArray(data.repreneurs) ? data.repreneurs : []
        setRepreneurs(options)
        if (preselectedRepreneurId) {
          setSelectedRepreneur(options.find((option: WaveAiRepreneurOption) => option.id === preselectedRepreneurId) ?? null)
        }
      })
      .catch(() => toast.error("Recipients could not be loaded."))
      .finally(() => active && setLoadingRepreneurs(false))
    return () => { active = false }
  }, [preselectedRepreneurId])

  const allTemplates = [
    ...WAVE_AI_EMAIL_TEMPLATES.map((template) => ({ id: template.id, name: template.name })),
    ...customTemplates.map((template) => ({ id: template.id, name: template.name })),
  ]
  const canGenerate = Boolean(selectedRepreneur && templateId && (templateId !== "general" || customInstructions.trim()))

  const generate = async () => {
    if (!selectedRepreneur || !canGenerate) return
    captureWaveEvent("wave_ai_generation_requested", {
      route_template: "/tools/wave-ai",
      surface: "staff",
      role: "staff",
      workflow: "wave_ai",
      action: "generate",
      feature: "email_draft",
      prompt_version: WAVE_AI_PROMPT_VERSION,
      model_key: "gpt-5.6-luna",
    })
    setGenerating(true)
    setDraft(null)
    setSubject("")
    setBody("")
    setFeedback(null)
    setFeedbackReason("")
    setFeedbackRecorded(false)
    setEditRecorded(false)
    try {
      const response = await fetch("/api/wave-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repreneurId: selectedRepreneur.id,
          templateId,
          language,
          customInstructions: customInstructions.trim() || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Draft generation failed.")
      const nextDraft = data as WaveAiEmailDraftResponse
      setDraft(nextDraft)
      setSubject(nextDraft.subject)
      setBody(nextDraft.body)
      void recordEvent(nextDraft.generationId, "rendered")
      captureWaveEvent("wave_ai_generation_rendered", {
        route_template: "/tools/wave-ai",
        surface: "staff",
        role: "staff",
        workflow: "wave_ai",
        action: "render",
        outcome: "success",
        feature: "email_draft",
        generation_id: nextDraft.generationId,
        trace_id: nextDraft.traceId,
        prompt_version: WAVE_AI_PROMPT_VERSION,
        model_key: nextDraft.model,
      })
      toast.success("Draft ready for review.")
    } catch (error) {
      captureWaveEvent("wave_action_failed", {
        route_template: "/tools/wave-ai",
        surface: "staff",
        role: "staff",
        workflow: "wave_ai",
        action: "generate",
        outcome: "failure",
        feature: "email_draft",
        prompt_version: WAVE_AI_PROMPT_VERSION,
        model_key: "gpt-5.6-luna",
      })
      toast.error(error instanceof Error ? error.message : "Draft generation failed.")
    } finally {
      setGenerating(false)
    }
  }

  const recordEdit = () => {
    if (!draft || editRecorded) return
    setEditRecorded(true)
    void recordEvent(draft.generationId, "edit_started")
  }

  const copyDraft = async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
      setCopied(true)
      void recordEvent(draft.generationId, "copied")
      captureWaveEvent("wave_ai_outcome_recorded", {
        route_template: "/tools/wave-ai",
        surface: "staff",
        role: "staff",
        workflow: "wave_ai",
        action: "copy",
        outcome: "copied",
        feature: "email_draft",
        generation_id: draft.generationId,
        trace_id: draft.traceId,
        prompt_version: WAVE_AI_PROMPT_VERSION,
        model_key: draft.model,
      })
      toast.success("Reviewed draft copied.")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("The draft could not be copied.")
    }
  }

  const submitFeedback = (value: "helpful" | "not_helpful", reason?: FeedbackReason) => {
    if (!draft || feedbackRecorded) return
    if (value === "not_helpful" && !reason) {
      setFeedback("not_helpful")
      return
    }
    setFeedback(value)
    setFeedbackRecorded(true)
    captureWaveEvent("wave_ai_feedback_submitted", {
      route_template: "/tools/wave-ai",
      surface: "staff",
      role: "staff",
      workflow: "wave_ai",
      action: "feedback",
      outcome: value === "helpful" ? "useful" : "not_useful",
      feature: "email_draft",
      generation_id: draft.generationId,
      trace_id: draft.traceId,
      prompt_version: WAVE_AI_PROMPT_VERSION,
      model_key: draft.model,
    })
    void recordEvent(
      draft.generationId,
      value === "helpful" ? "feedback_helpful" : "feedback_not_helpful",
      reason,
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Draft settings</CardTitle>
          <CardDescription>Choose the recipient and purpose. WAVE AI reads a bounded staff projection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Recipient</Label>
            <WaveAiRepreneurSearch
              repreneurs={repreneurs}
              value={selectedRepreneur}
              onSelect={setSelectedRepreneur}
              disabled={loadingRepreneurs}
            />
            {loadingRepreneurs && <p className="text-xs text-muted-foreground">Loading staff-visible recipients…</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wave-ai-template">Purpose</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="wave-ai-template"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wave-ai-language">Language</Label>
            <Select value={language} onValueChange={(value) => setLanguage(value as "fr" | "en")}>
              <SelectTrigger id="wave-ai-language"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wave-ai-instructions">Staff goal {templateId === "general" ? "(required)" : "(optional)"}</Label>
            <Textarea
              id="wave-ai-instructions"
              value={customInstructions}
              onChange={(event) => setCustomInstructions(event.target.value.slice(0, 1200))}
              placeholder="What should this email achieve?"
              rows={5}
            />
            <p className="text-right text-xs text-muted-foreground">{customInstructions.length}/1200</p>
          </div>

          <Button className="w-full" onClick={generate} disabled={!canGenerate || generating} data-wave-action="generate" data-wave-workflow="wave_ai">
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {generating ? "Drafting with Luna…" : "Create editable draft"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">Luna · max reasoning · draft only. Nothing is sent or saved to a business record.</p>
        </CardContent>
      </Card>

      <Card className="min-h-[560px]">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Review draft</CardTitle>
              <CardDescription>Edit every claim before using it.</CardDescription>
            </div>
            {draft && <Badge variant="outline">Human review required</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!draft ? (
            <div className="grid min-h-[390px] place-items-center rounded-lg border border-dashed p-8 text-center">
              <div className="max-w-sm space-y-2">
                <Sparkles className="mx-auto size-6 text-muted-foreground" />
                <p className="font-medium">No draft yet</p>
                <p className="text-sm text-muted-foreground">Select a recipient and purpose, then create an editable draft.</p>
              </div>
            </div>
          ) : (
            <>
              {(draft.warnings.length > 0 || draft.assumptions.length > 0) && (
                <Alert>
                  <AlertTitle>Review notes</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {[...draft.warnings, ...draft.assumptions].map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="wave-ai-subject">Subject</Label>
                <Input
                  id="wave-ai-subject"
                  value={subject}
                  onChange={(event) => { setSubject(event.target.value); recordEdit() }}
                  maxLength={180}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wave-ai-body">Body</Label>
                <Textarea
                  id="wave-ai-body"
                  value={body}
                  onChange={(event) => { setBody(event.target.value); recordEdit() }}
                  className="min-h-[300px] resize-y"
                  maxLength={6000}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Helpful?</span>
                  <Button variant={feedback === "helpful" ? "secondary" : "ghost"} size="sm" onClick={() => submitFeedback("helpful")} disabled={feedbackRecorded} data-wave-action="feedback" data-wave-workflow="wave_ai">
                    <ThumbsUp /> Yes
                  </Button>
                  <Button variant={feedback === "not_helpful" ? "secondary" : "ghost"} size="sm" onClick={() => submitFeedback("not_helpful")} disabled={feedbackRecorded} data-wave-action="feedback" data-wave-workflow="wave_ai">
                    <ThumbsDown /> No
                  </Button>
                  {feedback === "not_helpful" && (
                    <Select
                      value={feedbackReason || undefined}
                      onValueChange={(value) => {
                        const reason = value as FeedbackReason
                        setFeedbackReason(reason)
                        submitFeedback("not_helpful", reason)
                      }}
                    >
                      <SelectTrigger className="h-8 w-[170px]" aria-label="Why was this not helpful?" disabled={feedbackRecorded}><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_relevant">Not relevant</SelectItem>
                        <SelectItem value="wrong_fact">Wrong fact</SelectItem>
                        <SelectItem value="poor_wording">Poor wording</SelectItem>
                        <SelectItem value="missing_context">Missing context</SelectItem>
                        <SelectItem value="other_without_text">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Button onClick={copyDraft} disabled={!subject.trim() || !body.trim()} data-wave-action="copy" data-wave-workflow="wave_ai">
                  {copied ? <Check /> : <Clipboard />}
                  {copied ? "Copied" : "Copy reviewed draft"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
