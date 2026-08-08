"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Mail, Send, UserRound } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { MaOpportunityWorkflow } from "@/lib/actions/ma-workflows"
import { suppressionBlocksMaTemplate } from "@/lib/ma-contact-email-policy"
import {
  FieldError,
  type FieldErrors,
  fieldErrorProps,
  focusValidationSummary,
  FormFieldLabel,
  ValidationSummary,
} from "@/components/forms/validation-feedback"

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const validationSummaryRef = useRef<HTMLDivElement>(null)
  const sendOperationRef = useRef<{ fingerprint: string; key: string } | null>(null)
  const selectedRecipient = workflow.contacts.find((contact) => contact.id === recipientContactId) ?? null
  const recipientEmail = selectedRecipient?.email ?? null
  const suppressionBlocksSend = selectedRecipient
    ? suppressionBlocksMaTemplate(
        selectedRecipient.campaignEmailSuppressed,
        templateKey,
      )
    : false
  const recipientName = selectedRecipient?.name || selectedRecipient?.email || selectedRecipient?.phone || workflow.sourceName

  const selectTemplate = (value: string) => {
    setTemplateKey(value)
    const draft = workflow.drafts.find((candidate) => candidate.templateKey === value)
    if (!draft) return
    setSubject(draft.subject)
    setBody(draft.body)
  }

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    if (!templateKey) errors.ma_template = "Choose a template."
    if (!recipientContactId) errors.ma_recipient = "Choose a linked contact."
    else if (!recipientEmail) errors.ma_recipient = "Choose a contact with an email address."
    else if (suppressionBlocksSend) errors.ma_recipient = "This contact cannot receive this template."
    if (!subject.trim()) errors.ma_subject = "Enter an email subject."
    if (!body.trim()) errors.ma_body = "Enter an email message."
    return errors
  }

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSending) return
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusValidationSummary(validationSummaryRef)
      return
    }

    setIsSending(true)
    setFieldErrors({})
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
        operationState?: "pending" | "failed" | "sent"
      }
      if (!result.success) {
        setFieldErrors({ form: result.message })
        focusValidationSummary(validationSummaryRef)
        if (result.operationState !== "pending") {
          sendOperationRef.current = null
          try {
            sessionStorage.removeItem(storageKey)
          } catch {}
        }
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
      const message = error instanceof Error ? error.message : "Unexpected error while sending the intermediary email."
      setFieldErrors({ form: message })
      focusValidationSummary(validationSummaryRef)
      toast.error("M&A email not sent", {
        description: message,
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Intermediary follow-up
          </CardTitle>
          <CardDescription>Send a contextual M&A template to the linked source without leaving this opportunity.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSend} className="space-y-4">
            <ValidationSummary
              ref={validationSummaryRef}
              errors={fieldErrors}
              labels={{ ma_template: "Template", ma_recipient: "Recipient", ma_subject: "Subject", ma_body: "Message", form: "Email" }}
            />
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
              <div className="min-w-0 space-y-2">
                <FormFieldLabel>Source</FormFieldLabel>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium">{workflow.sourceName}</p>
                  <p className="text-muted-foreground">{workflow.contacts.length} linked contacts</p>
                </div>
              </div>

              <div className="min-w-0 space-y-2">
                <FormFieldLabel htmlFor="ma_template" requirement="required">Template</FormFieldLabel>
                <Select value={templateKey} onValueChange={(value) => {
                  setFieldErrors((current) => ({ ...current, ma_template: "", form: "" }))
                  selectTemplate(value)
                }}>
                  <SelectTrigger id="ma_template" className="w-full min-w-0" {...fieldErrorProps("ma_template", fieldErrors.ma_template)}>
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
                <FieldError id="ma_template" message={fieldErrors.ma_template} />
              </div>
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="ma_recipient" requirement="required">Recipient</FormFieldLabel>
              {workflow.contacts.length > 0 ? (
                <Select value={recipientContactId} onValueChange={(value) => {
                  setRecipientContactId(value)
                  setFieldErrors((current) => ({ ...current, ma_recipient: "", form: "" }))
                }}>
                  <SelectTrigger id="ma_recipient" className="w-full min-w-0" {...fieldErrorProps("ma_recipient", fieldErrors.ma_recipient)}>
                    <SelectValue placeholder="Choose a linked contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {workflow.contacts.map((contact) => {
                        const label = contact.name || contact.email || contact.phone || "Unnamed contact"
                        return (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.isPrimary ? `${label} (default)` : label}
                            {contact.campaignEmailSuppressed
                              ? " · campaign email blocked"
                              : ""}
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
              <FieldError id="ma_recipient" message={fieldErrors.ma_recipient} />
              {selectedRecipient ? (
                <p className="break-all text-xs text-muted-foreground">
                  {selectedRecipient.email ?? "No email"}
                  {selectedRecipient.phone ? ` · ${selectedRecipient.phone}` : ""}
                </p>
              ) : null}
            </div>

            {selectedRecipient?.campaignEmailSuppressed ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <AlertTriangle />
                <AlertTitle>Campaign email blocked for this contact</AlertTitle>
                <AlertDescription className="text-amber-900">
                  {suppressionBlocksSend ? (
                    <p>
                      This message cannot be sent. The only current exception is
                      an NDA request from an opportunity to which this contact is
                      actively linked.
                    </p>
                  ) : (
                    <p>
                      This NDA request is the only allowlisted operational
                      exception. WAVE will verify the active opportunity link
                      again and record the exception before delivery.
                    </p>
                  )}
                  {selectedRecipient.campaignEmailSuppressionReason ? (
                    <p className="mt-1">
                      Reason:{" "}
                      {selectedRecipient.campaignEmailSuppressionReason}
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <FormFieldLabel htmlFor="ma_subject" requirement="required">Subject</FormFieldLabel>
              <Input
                id="ma_subject"
                value={subject}
                {...fieldErrorProps("ma_subject", fieldErrors.ma_subject)}
                onChange={(event) => {
                  setSubject(event.target.value)
                  setFieldErrors((current) => ({ ...current, ma_subject: "", form: "" }))
                }}
                placeholder="Example: Opportunity still active?"
              />
              <FieldError id="ma_subject" message={fieldErrors.ma_subject} />
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="ma_body" requirement="required">Message</FormFieldLabel>
              <Textarea
                id="ma_body"
                rows={12}
                value={body}
                {...fieldErrorProps("ma_body", fieldErrors.ma_body)}
                onChange={(event) => {
                  setBody(event.target.value)
                  setFieldErrors((current) => ({ ...current, ma_body: "", form: "" }))
                }}
                placeholder="Write the intermediary follow-up..."
              />
              <FieldError id="ma_body" message={fieldErrors.ma_body} />
            </div>

            {recipientEmail ? (
              <Alert>
                <Mail />
                <AlertTitle>Recipient for this follow-up</AlertTitle>
                <AlertDescription>
                  <p className="break-words">
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
              <Button type="submit" disabled={isSending}>
                <Send data-icon="inline-start" />
                {isSending ? "Sending..." : "Send to contact"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="min-w-0">
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
                      <Badge variant="outline">{interaction.channel}</Badge>
                      <Badge variant={interaction.status === "sent" ? "default" : interaction.status === "failed" ? "destructive" : "outline"}>
                        {interaction.status}
                      </Badge>
                      {interaction.owner_verification_state === "provisional" ? <Badge variant="outline">Owner to verify</Badge> : null}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(interaction.sent_at ?? interaction.occurred_at ?? interaction.created_at)}</span>
                  </div>
                  <p className="font-medium">{interaction.subject}</p>
                  {interaction.body_markdown ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{interaction.body_markdown}</p> : null}
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
