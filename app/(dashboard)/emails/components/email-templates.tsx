"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { TEMPLATE_METADATA } from "@/lib/email/templates"
import { toggleTemplateEnabled } from "@/lib/actions/emails"
import type { EmailTemplate } from "@/lib/types/email"

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

export function EmailTemplates({ templates }: EmailTemplatesProps) {
  const [localTemplates, setLocalTemplates] = useState(templates)
  const [loading, setLoading] = useState<string | null>(null)

  const handleToggle = async (templateKey: string, enabled: boolean) => {
    setLoading(templateKey)
    try {
      await toggleTemplateEnabled(templateKey as keyof typeof TEMPLATE_METADATA, enabled)
      setLocalTemplates((prev) =>
        prev.map((t) => (t.template_key === templateKey ? { ...t, is_enabled: enabled } : t))
      )
    } catch (error) {
      console.error("Failed to toggle template:", error)
    } finally {
      setLoading(null)
    }
  }

  // Group templates by category
  const groupedTemplates = Object.entries(TEMPLATE_METADATA).reduce(
    (acc, [key, meta]) => {
      const template = localTemplates.find((t) => t.template_key === key)
      const item = {
        key,
        ...meta,
        isEnabled: template?.is_enabled ?? true,
        subjectOverride: template?.subject_override,
      }
      if (!acc[meta.category]) {
        acc[meta.category] = []
      }
      acc[meta.category].push(item)
      return acc
    },
    {} as Record<string, Array<{ key: string; name: string; description: string; category: string; isEnabled: boolean; subjectOverride?: string | null }>>
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
                    {item.subjectOverride && (
                      <p className="text-xs text-blue-600 mt-1">
                        Sujet personnalisé: {item.subjectOverride}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
    </div>
  )
}
