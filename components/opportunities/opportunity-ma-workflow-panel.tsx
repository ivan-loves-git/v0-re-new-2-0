"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Mail, Send, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { MaOpportunityWorkflow } from "@/lib/actions/ma-workflows"

interface OpportunityMaWorkflowPanelProps {
  workflow: MaOpportunityWorkflow
  sendAction: (formData: FormData) => Promise<{ success: boolean; message: string }>
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function OpportunityMaWorkflowPanel({ workflow, sendAction }: OpportunityMaWorkflowPanelProps) {
  const router = useRouter()
  const firstDraft = workflow.drafts[0]
  const [templateKey, setTemplateKey] = useState(firstDraft?.templateKey ?? "")
  const selectedDraft = useMemo(
    () => workflow.drafts.find((draft) => draft.templateKey === templateKey) ?? firstDraft,
    [firstDraft, templateKey, workflow.drafts],
  )
  const [subject, setSubject] = useState(selectedDraft?.subject ?? "")
  const [body, setBody] = useState(selectedDraft?.body ?? "")
  const [isSending, setIsSending] = useState(false)
  const canSend = Boolean(workflow.recipientEmail && templateKey && subject.trim() && body.trim())

  useEffect(() => {
    if (!selectedDraft) return
    setSubject(selectedDraft.subject)
    setBody(selectedDraft.body)
  }, [selectedDraft])

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSend || isSending) return

    setIsSending(true)
    try {
      const formData = new FormData(event.currentTarget)
      const result = await sendAction(formData)
      if (!result.success) {
        toast.error("M&A email not sent", { description: result.message })
        return
      }
      toast.success("M&A email sent", { description: result.message })
      router.refresh()
    } catch (error) {
      toast.error("M&A email not sent", {
        description: error instanceof Error ? error.message : "Unexpected error while sending the intermediary email.",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Intermediary follow-up
          </CardTitle>
          <CardDescription>
            Send a contextual M&A template to the linked source without leaving this opportunity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            <input type="hidden" name="template_key" value={templateKey} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Source</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium">{workflow.sourceName}</p>
                  <p className="text-muted-foreground">{workflow.recipientEmail ?? "No source email"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ma_template">Template</Label>
                <Select value={templateKey} onValueChange={setTemplateKey}>
                  <SelectTrigger id="ma_template">
                    <SelectValue placeholder="Choose template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {workflow.drafts.map((draft) => (
                        <SelectItem key={draft.templateKey} value={draft.templateKey}>
                          {draft.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {selectedDraft?.description ? (
                  <p className="text-xs text-muted-foreground">{selectedDraft.description}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ma_subject">Subject</Label>
              <Input
                id="ma_subject"
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Example: Opportunity still active?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ma_body">Message</Label>
              <Textarea
                id="ma_body"
                name="body_markdown"
                rows={12}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write the intermediary follow-up..."
              />
            </div>

            {!workflow.recipientEmail ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Add an email address to the linked M&A source before sending.
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={!canSend || isSending}>
                <Send data-icon="inline-start" />
                {isSending ? "Sending..." : "Send to source"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interaction history</CardTitle>
          <CardDescription>Recent source follow-ups logged for this opportunity.</CardDescription>
        </CardHeader>
        <CardContent>
          {workflow.interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No M&A follow-up logged yet.</p>
          ) : (
            <div className="space-y-3">
              {workflow.interactions.map((interaction) => (
                <div key={interaction.id} className="rounded-lg border p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant={interaction.status === "sent" ? "default" : "destructive"}>
                      {interaction.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(interaction.sent_at ?? interaction.created_at)}</span>
                  </div>
                  <p className="font-medium">{interaction.subject}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="size-3" />
                    {interaction.recipient_email}
                  </div>
                  {interaction.error_message ? (
                    <p className="mt-2 text-xs text-destructive">{interaction.error_message}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
