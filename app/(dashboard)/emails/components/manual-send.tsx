"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { TEMPLATE_AUDIENCE_LABELS, TEMPLATE_METADATA } from "@/lib/email/templates"
import { getRepreneursForManualSend, sendManualEmail, sendTestEmail } from "@/lib/actions/emails"
import type { EmailTemplateKey } from "@/lib/types/email"
import { Send, CheckCircle, AlertCircle, Search, FlaskConical } from "lucide-react"

interface Repreneur {
  id: string
  first_name: string
  last_name: string
  email: string
  marketing_consent: boolean
}

export function ManualSend() {
  const [testMode, setTestMode] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [testFirstName, setTestFirstName] = useState("")
  const [search, setSearch] = useState("")
  const [repreneurs, setRepreneurs] = useState<Repreneur[]>([])
  const [selectedRepreneur, setSelectedRepreneur] = useState<Repreneur | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const availableTemplates = useMemo(
    () => Object.entries(TEMPLATE_METADATA).filter(([, meta]) => testMode || meta.audience === "rep"),
    [testMode],
  )

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

  useEffect(() => {
    if (selectedTemplate && !testMode && TEMPLATE_METADATA[selectedTemplate].audience !== "rep") {
      setSelectedTemplate(null)
    }
  }, [selectedTemplate, testMode])

  const handleSend = async () => {
    if (testMode) {
      if (!testEmail || !selectedTemplate) return
    } else {
      if (!selectedRepreneur || !selectedTemplate) return
    }

    setLoading(true)
    setResult(null)

    try {
      if (testMode) {
        const testResult = await sendTestEmail(testEmail, testFirstName || "Test", selectedTemplate!)
        if (!testResult.success) {
          setResult({
            success: false,
            message: `Error: ${testResult.message}`,
          })
          return
        }
        setResult({
          success: true,
          message: `[TEST] Email "${TEMPLATE_METADATA[selectedTemplate!].name}" sent to ${testEmail}`,
        })
      } else {
        const manualResult = await sendManualEmail(selectedRepreneur!.id, selectedTemplate!)
        if (!manualResult.success) {
          setResult({
            success: false,
            message: `Error: ${manualResult.message}`,
          })
          return
        }
        setResult({
          success: true,
          message: `Email "${TEMPLATE_METADATA[selectedTemplate!].name}" sent to ${selectedRepreneur!.email}`,
        })
        setSelectedRepreneur(null)
      }
      setSelectedTemplate(null)
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Failed to send"}`,
      })
    } finally {
      setLoading(false)
    }
  }

  const canSend = testMode
    ? testEmail && selectedTemplate
    : selectedRepreneur && selectedTemplate

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Manual Email Send</CardTitle>
            <CardDescription>
              {testMode
                ? "Send test emails to any address (no logging)"
                : "Select a repreneur and template to send an email"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <FlaskConical className={`size-4 ${testMode ? "text-purple-600" : "text-muted-foreground"}`} />
            <Switch
              checked={testMode}
              onCheckedChange={setTestMode}
              aria-label="Toggle test mode"
            />
            <span className={`text-sm font-medium ${testMode ? "text-purple-600" : "text-muted-foreground"}`}>
              Test Mode
            </span>
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

        {/* Test Mode: Custom Email Input */}
        {testMode ? (
          <div className="space-y-4 rounded-lg border border-dashed bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-purple-700 text-sm font-medium">
              <FlaskConical className="size-4" />
              Test Mode: Emails are sent directly without logging
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="your@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-name">First Name (for personalization)</Label>
              <Input
                id="test-name"
                placeholder="Ivan"
                value={testFirstName}
                onChange={(e) => setTestFirstName(e.target.value)}
              />
            </div>
          </div>
        ) : (
          /* Repreneur Search */
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

            {/* Repreneur List */}
            {repreneurs.length > 0 && !selectedRepreneur && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {repreneurs.map((r) => (
                  <button
                    key={r.id}
                    className="flex w-full items-center justify-between border-b px-4 py-2 text-left hover:bg-muted/50 last:border-b-0"
                    onClick={() => setSelectedRepreneur(r)}
                  >
                    <div>
                      <div className="font-medium">
                        {r.first_name} {r.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">{r.email}</div>
                    </div>
                    {!r.marketing_consent && (
                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                        No consent
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Selected Repreneur */}
            {selectedRepreneur && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div>
                  <div className="font-medium">
                    {selectedRepreneur.first_name} {selectedRepreneur.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{selectedRepreneur.email}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRepreneur(null)}>
                  Change
                </Button>
              </div>
            )}

            {searching && <p className="text-sm text-muted-foreground">Searching...</p>}
          </div>
        )}

        {/* Template Selection */}
        <div className="space-y-2">
          <Label>Template</Label>
          <Select
            value={selectedTemplate || ""}
            onValueChange={(v) => setSelectedTemplate(v as EmailTemplateKey)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableTemplates.map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span>{meta.name}</span>
                      <Badge variant={meta.audience === "opp" ? "outline" : "secondary"} className="text-[10px]">
                        {TEMPLATE_AUDIENCE_LABELS[meta.audience]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">({meta.category})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {selectedTemplate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={TEMPLATE_METADATA[selectedTemplate].audience === "opp" ? "outline" : "secondary"} className="text-[10px]">
                {TEMPLATE_AUDIENCE_LABELS[TEMPLATE_METADATA[selectedTemplate].audience]}
              </Badge>
              <span>{TEMPLATE_METADATA[selectedTemplate].description}</span>
            </div>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!canSend || loading}
          className="w-full"
        >
          <Send className="size-4 mr-2" />
          {loading ? "Sending..." : testMode ? "Send Test Email" : "Send Email"}
        </Button>
      </CardContent>
    </Card>
  )
}
