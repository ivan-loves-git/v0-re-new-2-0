"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { Repreneur } from "@/lib/types/repreneur"
import { SOURCE_OPTIONS, PERSONA_OPTIONS } from "@/lib/types/repreneur"
import {
  FieldError,
  FormFieldLabel,
  ValidationSummary,
  fieldErrorProps,
  focusValidationSummary,
  type FieldErrors,
} from "@/components/forms/validation-feedback"

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
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submissionError, setSubmissionError] = useState<string>()
  const summaryRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(formData: FormData) {
    const nextErrors: FieldErrors = {}
    const firstName = String(formData.get("first_name") ?? "").trim()
    const lastName = String(formData.get("last_name") ?? "").trim()
    const email = String(formData.get("email") ?? "").trim()

    if (!firstName) nextErrors.first_name = "Enter a first name."
    if (!lastName) nextErrors.last_name = "Enter a last name."
    if (!email) nextErrors.email = "Enter an email address."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Enter a valid email address."

    setErrors(nextErrors)
    setSubmissionError(undefined)
    if (Object.keys(nextErrors).length > 0) {
      focusValidationSummary(summaryRef)
      return
    }

    setIsSubmitting(true)
    try {
      await action(formData)
    } catch (error) {
      console.error("Repreneur form submission failed")
      setSubmissionError(error instanceof Error ? error.message : "We could not save this profile. Please try again.")
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
          <p className="text-sm text-muted-foreground">Fields marked Required must be completed. All other fields are optional.</p>
          <ValidationSummary
            ref={summaryRef}
            errors={errors}
            labels={{ first_name: "First name", last_name: "Last name", email: "Email" }}
          />
          {submissionError ? <p role="alert" className="text-sm text-destructive">{submissionError}</p> : null}
          <section className="grid gap-5 rounded-lg border bg-muted/20 p-5 md:grid-cols-2">
            <div className="space-y-2">
              <FormFieldLabel htmlFor="first_name" requirement="required">First name</FormFieldLabel>
              <Input id="first_name" name="first_name" defaultValue={repreneur?.first_name} required {...fieldErrorProps("first_name", errors.first_name)} onChange={() => setErrors(current => ({ ...current, first_name: "" }))} />
              <FieldError id="first_name" message={errors.first_name} />
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="last_name" requirement="required">Last name</FormFieldLabel>
              <Input id="last_name" name="last_name" defaultValue={repreneur?.last_name} required {...fieldErrorProps("last_name", errors.last_name)} onChange={() => setErrors(current => ({ ...current, last_name: "" }))} />
              <FieldError id="last_name" message={errors.last_name} />
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="email" requirement="required">Email</FormFieldLabel>
              <Input id="email" name="email" type="email" defaultValue={repreneur?.email} required {...fieldErrorProps("email", errors.email)} onChange={() => setErrors(current => ({ ...current, email: "" }))} />
              <FieldError id="email" message={errors.email} />
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="phone" requirement="optional">Phone</FormFieldLabel>
              <Input id="phone" name="phone" type="tel" defaultValue={repreneur?.phone} />
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="linkedin_url" requirement="optional">LinkedIn URL</FormFieldLabel>
              <Input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                placeholder="https://linkedin.com/in/..."
                defaultValue={repreneur?.linkedin_url}
              />
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="lifecycle_status" requirement="optional">Status</FormFieldLabel>
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
              <FormFieldLabel htmlFor="source" requirement="optional">Source</FormFieldLabel>
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
              <FormFieldLabel htmlFor="persona" requirement="optional">Persona</FormFieldLabel>
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
            <FormFieldLabel htmlFor="company_background" requirement="optional">Company Background</FormFieldLabel>
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
                <FormFieldLabel htmlFor="marketing_consent" requirement="optional" className="text-sm font-normal">
                  Marketing consent given
                </FormFieldLabel>
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
