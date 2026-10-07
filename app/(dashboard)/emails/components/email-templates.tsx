"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Eye, Loader2 } from "lucide-react"
import { TEMPLATE_AUDIENCE_LABELS, TEMPLATE_METADATA } from "@/lib/email/templates"
import {
  toggleTemplateEnabled,
  toggleTemplateAutoSend,
  getRenderedTemplate,
  updateTemplateSettings,
} from "@/lib/actions/emails"
import { CODE_EMAIL_CATALOGUE } from "@/lib/email/business-mail-policy"
import type { EmailTemplate, EmailTemplateKey } from "@/lib/types/email"
import type { EmailTemplateAudience } from "@/lib/email/templates"

interface EmailTemplatesProps {
  templates: EmailTemplate[]
}

const categoryLabels: Record<string, string> = {
  intake: "Inscription",
  offer: "Offres",
  status: "Statut",
  ma: "M&A",
}

interface PreviewState {
  templateKey: EmailTemplateKey
  templateName: string
  subject: string
  initialSubject: string
  body: string
  initialBody: string
  bodyEditable: boolean
  html: string | null
  loading: boolean
  saving: boolean
  error: string | null
  saved: boolean
}

export function EmailTemplates({ templates }: EmailTemplatesProps) {
  const [localTemplates, setLocalTemplates] = useState(templates)
  const [loading, setLoading] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)

  const handleToggle = async (templateKey: string, enabled: boolean) => {
    setLoading(templateKey)
    setToggleError(null)
    try {
      await toggleTemplateEnabled(templateKey as keyof typeof TEMPLATE_METADATA, enabled)
      setLocalTemplates((prev) =>
        prev.map((t) => (t.template_key === templateKey ? { ...t, is_active: enabled } : t))
      )
    } catch {
      setToggleError(templateKey === "opportunity_discovery_digest"
        ? "Discovery digest was not changed. Release cutover and current staff authorization are required before activation."
        : "Email template was not changed. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  const handleAutoToggle = async (templateKey: string, enabled: boolean) => {
    setLoading(templateKey); setToggleError(null)
    try { await toggleTemplateAutoSend(templateKey, enabled)
      setLocalTemplates(previous => previous.map(template => template.template_key === templateKey ? { ...template, auto_send: enabled } : template))
    } catch (error) { setToggleError(error instanceof Error ? error.message : "Auto-send was not saved.") }
    finally { setLoading(null) }
  }

  const openPreview = async (key: string, name: string) => {
    setPreview({
      templateKey: key as EmailTemplateKey,
      templateName: name,
      subject: "",
      initialSubject: "",
      body: "",
      initialBody: "",
      bodyEditable: false,
      html: null,
      loading: true,
      saving: false,
      error: null,
      saved: false,
    })
    try {
      const { subject, html, bodyMarkdown, bodyEditable } = await getRenderedTemplate(key as EmailTemplateKey)
      setPreview((prev) =>
        prev && prev.templateKey === key
          ? {
              ...prev,
              subject,
              initialSubject: subject,
              body: bodyMarkdown ?? "",
              initialBody: bodyMarkdown ?? "",
              bodyEditable,
              html,
              loading: false,
            }
          : prev,
      )
    } catch (err) {
      setPreview((prev) =>
        prev && prev.templateKey === key
          ? { ...prev, loading: false, error: err instanceof Error ? err.message : "Render failed" }
          : prev,
      )
    }
  }

  const saveTemplate = async () => {
    if (!preview) return
    setPreview({ ...preview, saving: true, saved: false, error: null })
    try {
      const updates: { subject?: string; body_markdown?: string } = {}
      if (preview.subject !== preview.initialSubject) updates.subject = preview.subject
      if (preview.bodyEditable && preview.body !== preview.initialBody) updates.body_markdown = preview.body
      if (Object.keys(updates).length > 0) {
        await updateTemplateSettings(preview.templateKey, updates)
      }
      // Re-render the preview with the new body so the iframe matches what was saved
      const { html } = await getRenderedTemplate(preview.templateKey)
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              saved: true,
              initialSubject: prev.subject,
              initialBody: prev.body,
              html,
            }
          : prev,
      )
    } catch (err) {
      setPreview((prev) =>
        prev ? { ...prev, saving: false, error: err instanceof Error ? err.message : "Save failed" } : prev,
      )
    }
  }

  // Group templates by category
  const groupedTemplates = Object.entries(TEMPLATE_METADATA).reduce(
    (acc, [key, meta]) => {
      const template = localTemplates.find((t) => t.template_key === key)
      const item = {
        key,
        ...meta,
        isEnabled: template?.is_active === true,
        autoSend: template?.auto_send === true,
      }
      if (!acc[meta.category]) {
        acc[meta.category] = []
      }
      acc[meta.category].push(item)
      return acc
    },
    {} as Record<
      string,
      Array<{
        key: string
        name: string
        description: string
        category: string
        audience: EmailTemplateAudience
        isEnabled: boolean
        autoSend: boolean
      }>
    >,
  )

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      {toggleError ? <p role="alert" className="text-sm text-destructive xl:col-span-2">{toggleError}</p> : null}
      {Object.entries(groupedTemplates).map(([category, items]) => (
        <Card key={category} className="min-w-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{categoryLabels[category] || category}</CardTitle>
              <Badge variant="secondary">
                {items.length} templates
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.key}
                  id={`template-${item.key}`}
                  className={`flex min-w-0 flex-col justify-between gap-4 rounded-md border p-4 sm:flex-row sm:items-center ${item.autoSend ? "border-info/60 bg-info/5" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h4 className="min-w-0 font-medium break-words">{item.name}</h4>
                      <Badge variant={item.audience === "opp" ? "outline" : "secondary"}>
                        {TEMPLATE_AUDIENCE_LABELS[item.audience]}
                      </Badge>
                      <code className="max-w-full min-w-0 rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground break-all">{item.key}</code>
                    </div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.key !== "code:e6_nda_ready" && item.key !== "opportunity_memo_available" && item.key !== "locked_opportunity_interest" ? <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(item.key, item.name)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Voir le contenu
                    </Button> : <Badge variant="outline">Code-governed copy</Badge>}
                    <span className="text-sm text-muted-foreground">
                      Active
                    </span>
                    <Switch
                      aria-label={`Active: ${item.name}`}
                      checked={item.isEnabled}
                      onCheckedChange={(checked) => handleToggle(item.key, checked)}
                      disabled={loading === item.key}
                    />
                    <span className="text-sm text-muted-foreground">Auto-send</span>
                    <Switch aria-label={`Auto-send: ${item.name}`} checked={item.autoSend}
                      onCheckedChange={checked => handleAutoToggle(item.key, checked)} disabled={loading === item.key} />
                    {item.autoSend ? <Badge variant="outline" className="border-info/60 text-info">Auto-send · future mail</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="xl:col-span-2"><CardHeader><CardTitle>Variants and system exceptions</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        {CODE_EMAIL_CATALOGUE.filter(item => !(item.key in TEMPLATE_METADATA)).map(item => <div key={item.key} className="rounded-md border p-4 space-y-2">
          <div className="flex flex-wrap gap-2 items-center"><h4 className="font-medium">{item.name}</h4><Badge variant="outline">Code-governed</Badge></div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
          {item.key==="code:critical_operation_alert" ? <p className="text-sm">Technical delivery follows its environment configuration.</p> : "locked" in item ? <div className="flex gap-3 items-center"><Switch checked disabled aria-label={`Active locked: ${item.name}`} /><span>Active · automatic · locked</span></div>
            : <p className="text-sm">Policy: {"policyKey" in item ? TEMPLATE_METADATA[item.policyKey]?.name ?? item.policyKey : item.key}. Individual draft words can be edited before sending.</p>}
        </div>)}
        <p className="text-sm text-muted-foreground sm:col-span-2">Auto-send affects future eligible messages. Existing review drafts retain their mode and words. Business mail copies Bertrand and Colin; personal access links are excluded.</p>
      </CardContent></Card>
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{preview?.templateName ?? ""}</DialogTitle>
            <DialogDescription>
              {preview?.bodyEditable
                ? "Sujet et corps du message modifiables. L'aperçu utilise des données fictives. Variables utiles : {firstName}, {opportunityTitle}, {repreneurName}, {nextStep}."
                : "Aperçu avec données fictives. Sujet modifiable. Le corps de ce template est défini dans le code (variables dynamiques)."}
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="flex-1 overflow-auto space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Sujet</Label>
                <Input
                  id="subject"
                  value={preview.subject}
                  onChange={(e) =>
                    setPreview({ ...preview, subject: e.target.value, saved: false, error: null })
                  }
                  disabled={preview.loading || preview.saving || (TEMPLATE_METADATA[preview.templateKey]?.manualSend === false && TEMPLATE_METADATA[preview.templateKey]?.copyEditable !== true)}
                />
              </div>

              {preview.bodyEditable && (
                <div className="space-y-2">
                  <Label htmlFor="body">Corps du message</Label>
                  <Textarea
                    id="body"
                    rows={10}
                    value={preview.body}
                    onChange={(e) =>
                      setPreview({ ...preview, body: e.target.value, saved: false, error: null })
                    }
                    disabled={preview.loading || preview.saving}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Une ligne vide sépare les paragraphes. Les variables disponibles sont indiquées dans le texte du template.
                  </p>
                </div>
              )}

              {preview.saved && (
                <p className="text-xs text-green-600">Modifications enregistrées.</p>
              )}
              {preview.error && (
                <p className="text-xs text-red-600">{preview.error}</p>
              )}

              <div className="space-y-2">
                <Label>Aperçu</Label>
                <div className="border rounded-md overflow-auto bg-white">
                  {preview.loading ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
                    </div>
                  ) : preview.html ? (
                    <iframe
                      title="Email preview"
                      srcDoc={preview.html}
                      className="w-full h-[500px] border-0"
                      sandbox=""
                    />
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">Aperçu indisponible.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {preview && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Fermer
              </Button>
              <Button
                onClick={saveTemplate}
                disabled={
                  preview.loading ||
                  preview.saving ||
                  (TEMPLATE_METADATA[preview.templateKey]?.manualSend === false && TEMPLATE_METADATA[preview.templateKey]?.copyEditable !== true) ||
                  preview.subject.trim() === "" ||
                  (preview.subject === preview.initialSubject &&
                    (!preview.bodyEditable || preview.body === preview.initialBody))
                }
              >
                {preview.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
