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
  getRenderedTemplate,
  updateTemplateSettings,
} from "@/lib/actions/emails"
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
  const [preview, setPreview] = useState<PreviewState | null>(null)

  const handleToggle = async (templateKey: string, enabled: boolean) => {
    setLoading(templateKey)
    try {
      await toggleTemplateEnabled(templateKey as keyof typeof TEMPLATE_METADATA, enabled)
      setLocalTemplates((prev) =>
        prev.map((t) => (t.template_key === templateKey ? { ...t, is_active: enabled } : t))
      )
    } catch {
      console.error("Failed to toggle email template")
    } finally {
      setLoading(null)
    }
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
        isEnabled: template?.is_active ?? true,
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
      }>
    >,
  )

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Object.entries(groupedTemplates).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{categoryLabels[category] || category}</CardTitle>
              <Badge variant="secondary">
                {items.length} templates
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col justify-between gap-4 rounded-md border p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{item.name}</h4>
                      <Badge variant={item.audience === "opp" ? "outline" : "secondary"}>
                        {TEMPLATE_AUDIENCE_LABELS[item.audience]}
                      </Badge>
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{item.key}</code>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(item.key, item.name)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Voir le contenu
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {item.isEnabled ? "Actif" : "Inactif"}
                    </span>
                    <Switch
                      checked={item.isEnabled}
                      onCheckedChange={(checked) => handleToggle(item.key, checked)}
                      disabled={loading === item.key}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

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
                  disabled={preview.loading || preview.saving}
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
