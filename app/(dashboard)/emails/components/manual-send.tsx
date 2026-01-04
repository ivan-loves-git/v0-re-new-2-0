"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { TEMPLATE_METADATA } from "@/lib/email/templates"
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
        await sendManualEmail(selectedRepreneur!.id, selectedTemplate!)
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
            <FlaskConical className={`h-4 w-4 ${testMode ? "text-purple-600" : "text-muted-foreground"}`} />
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
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        {/* Test Mode: Custom Email Input */}
        {testMode ? (
          <div className="space-y-4 p-4 border-2 border-dashed border-purple-200 rounded-lg bg-purple-50/50">
            <div className="flex items-center gap-2 text-purple-700 text-sm font-medium">
              <FlaskConical className="h-4 w-4" />
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
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center"
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
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
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
              {Object.entries(TEMPLATE_METADATA).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span>{meta.name}</span>
                    <span className="text-xs text-muted-foreground">({meta.category})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTemplate && (
            <p className="text-sm text-muted-foreground">
              {TEMPLATE_METADATA[selectedTemplate].description}
            </p>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!canSend || loading}
          className={`w-full ${testMode ? "bg-purple-600 hover:bg-purple-700" : ""}`}
        >
          <Send className="h-4 w-4 mr-2" />
          {loading ? "Sending..." : testMode ? "Send Test Email" : "Send Email"}
        </Button>
      </CardContent>
    </Card>
  )
}
