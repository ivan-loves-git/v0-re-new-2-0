"use client"

import * as React from "react"
import { Check, Copy, Loader2, Send, Sparkles, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { RepreneurSearch, type RepreneurOption } from "./repreneur-search"
import { ChannelSelector } from "./channel-selector"
import { TemplateSelector, type Template } from "./template-selector"

interface WavyToolProps {
  repreneurs?: RepreneurOption[] // Now optional - will fetch client-side if empty
  customTemplates: Template[]
  onAddTemplate: (template: { name: string; description: string; channel: "email" | "whatsapp" }) => Promise<void>
  onDeleteTemplate: (templateId: string) => Promise<void>
  preselectedRepreneurId?: string
}

export function WavyTool({
  repreneurs: initialRepreneurs = [],
  customTemplates,
  onAddTemplate,
  onDeleteTemplate,
  preselectedRepreneurId,
}: WavyToolProps) {
  // Repreneurs state - fetch client-side if not provided
  const [repreneurs, setRepreneurs] = React.useState<RepreneurOption[]>(initialRepreneurs)
  const [isLoadingRepreneurs, setIsLoadingRepreneurs] = React.useState(initialRepreneurs.length === 0)

  // Form state
  const [channel, setChannel] = React.useState<"email" | "whatsapp">("email")
  const [selectedRepreneur, setSelectedRepreneur] = React.useState<RepreneurOption | null>(null)
  const [templateId, setTemplateId] = React.useState<string | null>(null)
  const [customInstructions, setCustomInstructions] = React.useState("")

  // Generation state
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  // Send state
  const [isSending, setIsSending] = React.useState(false)
  const [showSendConfirm, setShowSendConfirm] = React.useState(false)

  // Fetch repreneurs client-side if not provided by server
  React.useEffect(() => {
    if (initialRepreneurs.length === 0) {
      fetch("/api/wavy/repreneurs")
        .then(res => res.json())
        .then(data => {
          if (data.repreneurs) {
            setRepreneurs(data.repreneurs)
          }
        })
        .catch(err => console.error("Failed to fetch repreneurs:", err))
        .finally(() => setIsLoadingRepreneurs(false))
    }
  }, [initialRepreneurs.length])

  // Preselect repreneur if ID provided
  React.useEffect(() => {
    if (preselectedRepreneurId && repreneurs.length > 0) {
      const repreneur = repreneurs.find(r => r.id === preselectedRepreneurId)
      if (repreneur) {
        setSelectedRepreneur(repreneur)
      }
    }
  }, [preselectedRepreneurId, repreneurs])

  // Reset template when channel changes (if current template doesn't match)
  React.useEffect(() => {
    if (templateId) {
      const builtInMatch = ["welcome", "offer-received", "milestone-completed", "high-score-alert", "rejection"].includes(templateId)
        ? channel === "email"
        : ["quick-checkin", "reminder"].includes(templateId)
        ? channel === "whatsapp"
        : true

      const customMatch = customTemplates.find(t => t.id === templateId)?.channel === channel

      if (!builtInMatch && !customMatch) {
        setTemplateId(null)
      }
    }
  }, [channel, templateId, customTemplates])

  const handleGenerate = async () => {
    if (!selectedRepreneur) {
      toast.error("Please select a repreneur")
      return
    }

    setIsGenerating(true)
    setBody("")
    setSubject("")

    try {
      const response = await fetch("/api/wavy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          templateId: templateId || "general",
          repreneurId: selectedRepreneur.id,
          customInstructions: customInstructions || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate")
      }

      const data = await response.json()
      setSubject(data.subject || "")
      setBody(data.body || "")
      toast.success("Message generated!")
    } catch (error) {
      console.error("Generation error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate message")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    const textToCopy = channel === "email"
      ? `Subject: ${subject}\n\n${body}`
      : body

    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSend = async () => {
    if (!selectedRepreneur?.email || !subject || !body) {
      toast.error("Missing required fields")
      return
    }

    setIsSending(true)

    try {
      const response = await fetch("/api/wavy/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedRepreneur.email,
          subject,
          body,
          repreneurId: selectedRepreneur.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send")
      }

      toast.success(`Email sent to ${selectedRepreneur.firstName}!`)
      setShowSendConfirm(false)

      // Clear the form
      setBody("")
      setSubject("")
    } catch (error) {
      console.error("Send error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to send email")
    } finally {
      setIsSending(false)
    }
  }

  const canGenerate = selectedRepreneur !== null
  const canSend = channel === "email" && selectedRepreneur?.email && subject && body

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="size-5 text-blue-500" />
            Configure Message
          </CardTitle>
          <CardDescription>
            Choose who to write to and what kind of message
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Channel Selection */}
          <div className="space-y-2">
            <Label>Channel</Label>
            <ChannelSelector value={channel} onChange={setChannel} />
          </div>

          {/* Repreneur Selection */}
          <div className="space-y-2">
            <Label>Repreneur</Label>
            <RepreneurSearch
              repreneurs={repreneurs}
              value={selectedRepreneur}
              onSelect={setSelectedRepreneur}
            />
            {selectedRepreneur && (
              <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {selectedRepreneur.t1Score && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      T1: {selectedRepreneur.t1Score}
                    </span>
                  )}
                  {selectedRepreneur.whenScore && (
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      WHEN: {selectedRepreneur.whenScore}
                    </span>
                  )}
                  {selectedRepreneur.willScore && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      WILL: {selectedRepreneur.willScore}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedRepreneur.email}
                  {selectedRepreneur.phone && ` | ${selectedRepreneur.phone}`}
                </p>
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template (optional)</Label>
            <TemplateSelector
              channel={channel}
              value={templateId}
              onChange={setTemplateId}
              customTemplates={customTemplates}
              onAddTemplate={onAddTemplate}
              onDeleteTemplate={onDeleteTemplate}
            />
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Additional Instructions (optional)</Label>
            <Textarea
              id="instructions"
              placeholder="e.g., Mention the upcoming workshop on March 15th..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate with Wavy
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Right: Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            {body ? "Edit the generated message before sending" : "Your message will appear here"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="body">
              {channel === "email" ? "Email Body" : "Message"}
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                isGenerating
                  ? "Wavy is writing..."
                  : channel === "email"
                  ? "Your email content will appear here..."
                  : "Your WhatsApp message will appear here..."
              }
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={!body}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="size-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>

            {channel === "email" && (
              <Button
                onClick={() => setShowSendConfirm(true)}
                disabled={!canSend}
                className="flex-1"
              >
                <Send className="size-4" />
                Send Email
              </Button>
            )}
          </div>

          {channel === "whatsapp" && body && (
            <p className="text-xs text-muted-foreground text-center">
              Copy the message and paste it into WhatsApp
            </p>
          )}
        </CardContent>
      </Card>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send an email to{" "}
              <strong>{selectedRepreneur?.firstName} {selectedRepreneur?.lastName}</strong> at{" "}
              <strong>{selectedRepreneur?.email}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">Subject: {subject}</p>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
              {body}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
