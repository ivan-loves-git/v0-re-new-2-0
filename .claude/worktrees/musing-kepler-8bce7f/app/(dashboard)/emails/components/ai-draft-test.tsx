"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { getRepreneursForManualSend } from "@/lib/actions/emails"
import { Sparkles, Send, Search, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

const TEST_EMAIL = "ivanpaudice@me.com"

const AI_TEMPLATES = [
  { id: "welcome", name: "Welcome", audience: "external" },
  { id: "offer-received", name: "Offer Received", audience: "external" },
  { id: "milestone-completed", name: "Milestone Completed", audience: "external" },
  { id: "rejection", name: "Polite Decline", audience: "external" },
  { id: "high-score-alert", name: "High Score Alert", audience: "internal" },
  { id: "team-update", name: "Team Update", audience: "internal" },
] as const

interface Repreneur {
  id: string
  first_name: string
  last_name: string
  email: string
  marketing_consent: boolean
}

interface GeneratedDraft {
  subject: string
  body: string
  warnings?: string[]
}

export function AiDraftTest() {
  const [search, setSearch] = useState("")
  const [repreneurs, setRepreneurs] = useState<Repreneur[]>([])
  const [selectedRepreneur, setSelectedRepreneur] = useState<Repreneur | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [customInstructions, setCustomInstructions] = useState("")
  const [searching, setSearching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<GeneratedDraft | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    const searchRepreneurs = async () => {
      setSearching(true)
      try {
        const data = await getRepreneursForManualSend(search || undefined)
        setRepreneurs(data)
      } catch (error) {
        console.error("Failed to search repreneurs:", error)
      } finally {
        setSearching(false)
      }
    }

    const debounce = setTimeout(searchRepreneurs, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const handleGenerate = async () => {
    if (!selectedRepreneur || !selectedTemplate) return

    setGenerating(true)
    setDraft(null)
    setResult(null)

    try {
      const res = await fetch("/api/wavy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          templateId: selectedTemplate,
          repreneurId: selectedRepreneur.id,
          customInstructions: customInstructions || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setResult({ success: false, message: `Generation failed: ${err.error}` })
        return
      }

      const data = await res.json()
      setDraft({
        subject: data.subject,
        body: data.body,
        warnings: data.warnings,
      })
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Failed to generate"}`,
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSendToTest = async () => {
    if (!draft || !selectedRepreneur) return

    setSending(true)
    setResult(null)

    try {
      const res = await fetch("/api/wavy/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedRepreneur.email,
          subject: draft.subject,
          body: draft.body,
          repreneurId: selectedRepreneur.id,
          testRecipient: TEST_EMAIL,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setResult({ success: false, message: `Send failed: ${err.error}` })
        return
      }

      setResult({
        success: true,
        message: `AI draft sent to ${TEST_EMAIL} (for ${selectedRepreneur.first_name} ${selectedRepreneur.last_name})`,
      })
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Failed to send"}`,
      })
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    setDraft(null)
    setResult(null)
    setCustomInstructions("")
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-amber-600" />
          <div>
            <CardTitle>AI Draft Test</CardTitle>
            <CardDescription>
              Generate AI emails and send drafts to {TEST_EMAIL}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Result Alert */}
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        {/* Repreneur Search */}
        <div className="space-y-2">
          <Label>Search for a repreneur</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {repreneurs.length > 0 && !selectedRepreneur && (
            <div className="border rounded-lg max-h-48 overflow-y-auto bg-white">
              {repreneurs.map((r) => (
                <button
                  key={r.id}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  onClick={() => setSelectedRepreneur(r)}
                >
                  <div className="font-medium">
                    {r.first_name} {r.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{r.email}</div>
                </button>
              ))}
            </div>
          )}

          {selectedRepreneur && (
            <div className="flex items-center justify-between bg-amber-100/50 p-3 rounded-lg">
              <div>
                <div className="font-medium">
                  {selectedRepreneur.first_name} {selectedRepreneur.last_name}
                </div>
                <div className="text-sm text-muted-foreground">{selectedRepreneur.email}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedRepreneur(null); handleReset() }}>
                Change
              </Button>
            </div>
          )}

          {searching && <p className="text-sm text-muted-foreground">Searching...</p>}
        </div>

        {/* AI Template Selection */}
        <div className="space-y-2">
          <Label>AI Template</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Select an AI template" />
            </SelectTrigger>
            <SelectContent>
              {AI_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <span>{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({t.audience})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-2">
          <Label>Custom instructions (optional)</Label>
          <Textarea
            placeholder="e.g., Mention their high WHO score, focus on deal flow..."
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={2}
          />
        </div>

        {/* Generate Button */}
        {!draft && (
          <Button
            onClick={handleGenerate}
            disabled={!selectedRepreneur || !selectedTemplate || generating}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Generate AI Draft
              </>
            )}
          </Button>
        )}

        {/* Draft Preview */}
        {draft && (
          <div className="space-y-4">
            {draft.warnings && draft.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  {draft.warnings.join(", ")}
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg p-4 bg-white space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-medium">{draft.subject}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <p className="text-sm whitespace-pre-wrap">{draft.body}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSendToTest}
                disabled={sending}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="size-4 mr-2" />
                    Send to {TEST_EMAIL}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
