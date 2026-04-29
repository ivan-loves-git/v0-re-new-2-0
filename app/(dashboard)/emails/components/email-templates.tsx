"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Eye, Loader2 } from "lucide-react"
import { TEMPLATE_METADATA } from "@/lib/email/templates"
import {
  toggleTemplateEnabled,
  getRenderedTemplate,
  updateTemplateSettings,
} from "@/lib/actions/emails"
import type { EmailTemplate, EmailTemplateKey } from "@/lib/types/email"

interface EmailTemplatesProps {
  templates: EmailTemplate[]
}

const categoryColors: Record<string, string> = {
  intake: "bg-blue-100 text-blue-800",
  offer: "bg-green-100 text-green-800",
  status: "bg-purple-100 text-purple-800",
}

const categoryLabels: Record<string, string> = {
  intake: "Inscription",
  offer: "Offres",
  status: "Statut",
}

interface PreviewState {
  templateKey: EmailTemplateKey
  templateName: string
  subject: string
  initialSubject: string
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
    } catch (error) {
      console.error("Failed to toggle template:", error)
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
      html: null,
      loading: true,
      saving: false,
      error: null,
      saved: false,
    })
    try {
      const { subject, html } = await getRenderedTemplate(key as EmailTemplateKey)
      setPreview((prev) =>
        prev && prev.templateKey === key
          ? { ...prev, subject, initialSubject: subject, html, loading: false }
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

  const saveSubject = async () => {
    if (!preview) return
    setPreview({ ...preview, saving: true, saved: false, error: null })
    try {
      await updateTemplateSettings(preview.templateKey, { subject: preview.subject })
      setPreview((prev) => (prev ? { ...prev, saving: false, saved: true, initialSubject: prev.subject } : prev))
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
      Array<{ key: string; name: string; description: string; category: string; isEnabled: boolean }>
    >,
  )

  return (
    <div className="space-y-6">
      {Object.entries(groupedTemplates).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{categoryLabels[category] || category}</CardTitle>
              <Badge className={categoryColors[category] || "bg-gray-100 text-gray-800"}>
                {items.length} templates
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{item.name}</h4>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{item.key}</code>
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
              Aperçu avec données fictives. Vous pouvez modifier le sujet — le corps du message
              est défini dans le code et nécessite une intervention dev pour changer.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <>
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
                {preview.saved && (
                  <p className="text-xs text-green-600">Sujet enregistré.</p>
                )}
                {preview.error && (
                  <p className="text-xs text-red-600">{preview.error}</p>
                )}
              </div>

              <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                <Label>Aperçu</Label>
                <div className="border rounded-md overflow-auto flex-1 bg-white">
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

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Fermer
                </Button>
                <Button
                  onClick={saveSubject}
                  disabled={
                    preview.loading ||
                    preview.saving ||
                    preview.subject.trim() === "" ||
                    preview.subject === preview.initialSubject
                  }
                >
                  {preview.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enregistrer le sujet
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
