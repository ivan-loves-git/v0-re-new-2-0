"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { Repreneur } from "@/lib/types/repreneur"
import { SOURCE_OPTIONS, PERSONA_OPTIONS } from "@/lib/types/repreneur"

interface RepreneurFormProps {
  repreneur?: Repreneur
  action: (formData: FormData) => Promise<void>
  submitLabel?: string
}

/**
 * Simplified admin form for creating/editing repreneurs.
 *
 * Field categories:
 * - Basic fields (this form): name, email, phone, linkedin, status, source, persona, company_background, consent
 * - Questionnaire fields (v2 intake form): q05-q16, who_score, when_score, etc.
 * - Legacy fields (preserved for existing data): investment_capacity, sector_preferences, target_location, target_acquisition_size
 *
 * The v2 questionnaire (q05-q16) is the source of truth for scoring data.
 * Admin should create minimal records here and send repreneurs the questionnaire link.
 */
export function RepreneurForm({ repreneur, action, submitLabel = "Save" }: RepreneurFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    try {
      await action(formData)
    } catch (error) {
      console.error("Failed to submit form:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>{repreneur ? "Edit core profile" : "Core profile"}</CardTitle>
          <CardDescription>
            {repreneur ? "Update repreneur information" : "Enter basic contact details. Send the questionnaire link to collect scoring data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="grid gap-5 rounded-lg border bg-muted/20 p-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" name="first_name" defaultValue={repreneur?.first_name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" name="last_name" defaultValue={repreneur?.last_name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" defaultValue={repreneur?.email} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={repreneur?.phone} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                placeholder="https://linkedin.com/in/..."
                defaultValue={repreneur?.linkedin_url}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lifecycle_status">Status</Label>
              <Select name="lifecycle_status" defaultValue={repreneur?.lifecycle_status || "lead"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
        <SelectItem value="lead">Lead</SelectItem>
        <SelectItem value="qualified">Qualified</SelectItem>
        <SelectItem value="client">Client</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select name="source" defaultValue={repreneur?.source || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
        {SOURCE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona">Persona</Label>
              <Select name="persona" defaultValue={repreneur?.persona || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select persona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
        {PERSONA_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </section>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-5">
            <Label htmlFor="company_background">Company Background</Label>
            <Textarea
              id="company_background"
              name="company_background"
              rows={3}
              defaultValue={repreneur?.company_background}
            />
          </div>

          {/* GDPR Consent Section */}
          <div className="rounded-lg border bg-muted/20 p-5">
            <h3 className="text-sm font-medium mb-4">GDPR Consent</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marketing_consent"
                  name="marketing_consent"
                  defaultChecked={repreneur?.marketing_consent}
                />
                <Label htmlFor="marketing_consent" className="text-sm font-normal">
                  Marketing consent given
                </Label>
              </div>
              {repreneur?.consent_timestamp && (
                <p className="text-xs text-muted-foreground">
                  Consent recorded: {new Date(repreneur.consent_timestamp).toLocaleDateString()}
                  {repreneur.consent_source && ` via ${repreneur.consent_source}`}
                </p>
              )}
              <input type="hidden" name="consent_source" value="manual" />
            </div>
          </div>

          <div className="flex justify-end border-t pt-5">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
