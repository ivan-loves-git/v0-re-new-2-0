"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Mail, Send, UserRound } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { MaOpportunityWorkflow } from "@/lib/actions/ma-workflows"

interface OpportunityMaWorkflowPanelProps {
  opportunityId: string
  workflow: MaOpportunityWorkflow
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

async function fingerprintClientSend(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function OpportunityMaWorkflowPanel({ opportunityId, workflow }: OpportunityMaWorkflowPanelProps) {
  const router = useRouter()
  const firstDraft = workflow.drafts[0]
  const [templateKey, setTemplateKey] = useState<string>(workflow.recommendedTemplateKey ?? firstDraft?.templateKey ?? "")
  const selectedDraft = useMemo(
    () => workflow.drafts.find((draft) => draft.templateKey === templateKey) ?? firstDraft,
    [firstDraft, templateKey, workflow.drafts],
  )
  const [subject, setSubject] = useState(selectedDraft?.subject ?? "")
  const [body, setBody] = useState(selectedDraft?.body ?? "")
  const [recipientContactId, setRecipientContactId] = useState(workflow.recipientContactId ?? "")
  const [isSending, setIsSending] = useState(false)
  const sendOperationRef = useRef<{ fingerprint: string; key: string } | null>(null)
  const selectedRecipient = workflow.contacts.find((contact) => contact.id === recipientContactId) ?? null
  const recipientEmail = selectedRecipient?.email ?? null
  const canSend = Boolean(recipientEmail && templateKey && subject.trim() && body.trim())
  const recipientName = selectedRecipient?.name || selectedRecipient?.email || selectedRecipient?.phone || workflow.sourceName

  const selectTemplate = (value: string) => {
    setTemplateKey(value)
    const draft = workflow.drafts.find((candidate) => candidate.templateKey === value)
    if (!draft) return
    setSubject(draft.subject)
    setBody(draft.body)
  }

  const handleSend = async () => {
    if (!canSend || isSending) return

    setIsSending(true)
    try {
      const formData = new FormData()
      formData.set("template_key", templateKey)
      formData.set("subject", subject)
      formData.set("body_markdown", body)
      formData.set("contact_id", recipientContactId)
      const operationFingerprint = await fingerprintClientSend(
        JSON.stringify({
          templateKey,
          subject,
          body,
          contactId: recipientContactId,
        }),
      )
      const storageKey = `renew:ma-email-operation:${opportunityId}`
      let storedOperation: { fingerprint: string; key: string } | null = null
      try {
        storedOperation = JSON.parse(sessionStorage.getItem(storageKey) ?? "null")
      } catch {
        storedOperation = null
      }
      const sendOperation =
        sendOperationRef.current?.fingerprint === operationFingerprint
          ? sendOperationRef.current
          : storedOperation?.fingerprint === operationFingerprint
            ? storedOperation
            : { fingerprint: operationFingerprint, key: crypto.randomUUID() }
      sendOperationRef.current = sendOperation
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(sendOperation))
      } catch {}

      const response = await fetch(`/api/opportunities/${opportunityId}/ma-workflow/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: formData.get("template_key"),
          subject: formData.get("subject"),
          body: formData.get("body_markdown"),
          contactId: formData.get("contact_id"),
          clientOperationKey: sendOperation.key,
        }),
      })
      const result = (await response.json()) as {
        success: boolean
        message: string
      }
      if (!result.success) {
        toast.error("M&A email not sent", { description: result.message })
        return
      }
      sendOperationRef.current = null
      try {
        sessionStorage.removeItem(storageKey)
      } catch {}
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
          <CardDescription>Send a contextual M&A template to the linked source without leaving this opportunity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflow.stalledReminder ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <AlertTriangle />
                <AlertTitle>{workflow.stalledReminder.title}</AlertTitle>
                <AlertDescription>{workflow.stalledReminder.message}</AlertDescription>
              </Alert>
            ) : null}

            {workflow.activePursuitName ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">Active pursuit: {workflow.activePursuitName}</p>
                <p className="text-muted-foreground">
                  Use the recommended M&A template to move the source process forward while following the firm's NDA process.
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Source</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium">{workflow.sourceName}</p>
                  <p className="text-muted-foreground">{workflow.contacts.length} linked contacts</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ma_template">Template</Label>
                <Select value={templateKey} onValueChange={selectTemplate}>
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
                {selectedDraft?.description ? <p className="text-xs text-muted-foreground">{selectedDraft.description}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ma_recipient">Recipient</Label>
              {workflow.contacts.length > 0 ? (
                <Select value={recipientContactId} onValueChange={setRecipientContactId}>
                  <SelectTrigger id="ma_recipient">
                    <SelectValue placeholder="Choose a linked contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {workflow.contacts.map((contact) => {
                        const label = contact.name || contact.email || contact.phone || "Unnamed contact"
                        return (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.isPrimary ? `${label} (default)` : label}
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  Link a contact to this opportunity before sending an intermediary follow-up.
                </div>
              )}
              {selectedRecipient ? (
                <p className="text-xs text-muted-foreground">
                  {selectedRecipient.email ?? "No email"}
                  {selectedRecipient.phone ? ` · ${selectedRecipient.phone}` : ""}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ma_subject">Subject</Label>
              <Input id="ma_subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Example: Opportunity still active?" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ma_body">Message</Label>
              <Textarea
                id="ma_body"
                rows={12}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write the intermediary follow-up..."
              />
            </div>

            {recipientEmail ? (
              <Alert>
                <Mail />
                <AlertTitle>Recipient for this follow-up</AlertTitle>
                <AlertDescription>
                  <p>
                    This email will be sent to <strong>{recipientName}</strong>
                    {selectedRecipient?.name ? ` from ${workflow.sourceName}` : ""} at <strong>{recipientEmail}</strong>.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <AlertTriangle />
                <AlertTitle>Recipient missing</AlertTitle>
                <AlertDescription className="text-amber-900">
                  <p>
                    {selectedRecipient ? (
                      <>
                        No email address is linked to <strong>{recipientName}</strong>. Add one from M&A before sending.
                      </>
                    ) : (
                      <>Choose a contact linked to this opportunity before sending.</>
                    )}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button type="button" onClick={handleSend} disabled={!canSend || isSending}>
                <Send data-icon="inline-start" />
                {isSending ? "Sending..." : "Send to contact"}
              </Button>
            </div>
          </div>
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
                    <div className="flex items-center gap-2">
                      <Badge variant={interaction.status === "sent" ? "default" : interaction.status === "failed" ? "destructive" : "outline"}>
                        {interaction.status}
                      </Badge>
                      {interaction.owner_verification_state === "provisional" ? <Badge variant="outline">Owner to verify</Badge> : null}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(interaction.sent_at ?? interaction.created_at)}</span>
                  </div>
                  <p className="font-medium">{interaction.subject}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="size-3" />
                    {interaction.recipient_email}
                  </div>
                  {interaction.error_message ? <p className="mt-2 text-xs text-destructive">{interaction.error_message}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
