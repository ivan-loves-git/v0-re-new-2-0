"use client"

import { type FormEvent, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  MA_SOURCE_TYPE_OPTIONS,
  getOpportunityIncompleteDataFieldLabel,
  OPPORTUNITY_STATUS_OPTIONS,
  OPPORTUNITY_VISIBILITY_OPTIONS,
  type OpportunityActionResult,
  type OpportunityIncompleteDataWarning,
  type OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  isAmbiguousLegacySector,
  isSector,
  NEW_OPPORTUNITY_SECTORS,
  normalizeOpportunitySector,
  OTHER_SECTOR,
} from "@/lib/utils/opportunity-sector"

const EDITABLE_OPPORTUNITY_STATUS_OPTIONS = OPPORTUNITY_STATUS_OPTIONS.filter((option) => option.value !== "closed")

interface OpportunityFormProps {
  opportunity?: OpportunityWithSource
  action: (formData: FormData) => Promise<OpportunityActionResult | void>
  submitLabel?: string
}

export function OpportunityForm({ opportunity, action, submitLabel = "Save opportunity" }: OpportunityFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const incompleteDataAcknowledgementRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [incompleteDataWarning, setIncompleteDataWarning] = useState<OpportunityIncompleteDataWarning | null>(null)
  const normalizedExistingSector = normalizeOpportunitySector(opportunity?.sector)
  const existingSectorIsCustom = Boolean(
    opportunity?.sector
    && !isAmbiguousLegacySector(opportunity.sector)
    && (!normalizedExistingSector || !isSector(normalizedExistingSector)),
  )
  const [sectorChoice, setSectorChoice] = useState(
    normalizedExistingSector && isSector(normalizedExistingSector)
      ? normalizedExistingSector
      : existingSectorIsCustom
        ? OTHER_SECTOR
        : "",
  )
  const isClosed = opportunity?.status === "closed"

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)
    setFieldErrors({})
    setIncompleteDataWarning(null)
    try {
      const result = await action(formData)
      if (result?.incompleteData) {
        setIncompleteDataWarning(result.incompleteData)
        toast.warning(result.message)
      } else if (result?.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        toast.error(result.message)
      } else if (result?.success) {
        toast.success(result.message)
      }
    } catch (error) {
      console.error("Failed to save opportunity:", error)
      toast.error(error instanceof Error ? error.message : "Opportunity could not be saved.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function errorFor(field: string) {
    const message = fieldErrors[field]
    return message ? <p className="text-xs text-destructive">{message}</p> : null
  }

  function clearIncompleteDataAcknowledgement() {
    if (incompleteDataAcknowledgementRef.current) {
      incompleteDataAcknowledgementRef.current.value = ""
    }
  }

  function acknowledgeIncompleteDataAndSave() {
    if (!formRef.current || !incompleteDataAcknowledgementRef.current) return
    incompleteDataAcknowledgementRef.current.value = "true"
    formRef.current.requestSubmit()
  }

  return (
    <form
      ref={formRef}
      noValidate
      onInput={clearIncompleteDataAcknowledgement}
      onSubmit={handleSubmit}
      className="mx-auto max-w-5xl"
    >
      <Card>
        <CardHeader>
          <CardTitle>{opportunity ? "Edit opportunity" : "Create opportunity"}</CardTitle>
          <CardDescription>Keep staff-only source data separate from repreneur-visible information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <input type="hidden" name="source_id" value={opportunity?.source_id ?? ""} />
          <input ref={incompleteDataAcknowledgementRef} type="hidden" name="acknowledge_incomplete_data" />

          {incompleteDataWarning ? (
            <Alert className="border-amber-300 bg-amber-50/70 text-amber-950 [&>svg]:text-amber-700">
              <AlertTriangle className="text-amber-700" />
              <AlertTitle>Incomplete data — this opportunity may not match correctly</AlertTitle>
              <AlertDescription className="gap-3 text-amber-900">
                <p>Missing: {incompleteDataWarning.missingFields.map(getOpportunityIncompleteDataFieldLabel).join(", ")}.</p>
                <p>You can keep editing, or save the opportunity with these values left unknown.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" onClick={acknowledgeIncompleteDataAndSave} disabled={isSubmitting}>
                    Save anyway
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setIncompleteDataWarning(null)} disabled={isSubmitting}>
                    Keep editing
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-medium">Core fields</h3>
              <p className="text-sm text-muted-foreground">Operational data used by the Re-New team.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reference">Ref. Mandat *</Label>
                <Input id="reference" name="reference" defaultValue={opportunity?.reference ?? ""} required />
                {errorFor("reference")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                {isClosed ? (
                  <>
                    <Input id="status" value="Closed" disabled />
                    <input type="hidden" name="status" value="closed" />
                    <p className="text-xs text-muted-foreground">Reopen this opportunity from Overview before changing its status.</p>
                  </>
                ) : (
                  <Select name="status" defaultValue={opportunity?.status ?? "draft"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {EDITABLE_OPPORTUNITY_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
                {errorFor("status")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector_choice">Secteur *</Label>
                <>
                    <Select
                      name="sector_choice"
                      value={sectorChoice}
                      onValueChange={setSectorChoice}
                      required
                    >
                      <SelectTrigger
                        id="sector_choice"
                        className="w-full"
                        aria-invalid={Boolean(fieldErrors.sector_choice)}
                      >
                        <SelectValue placeholder="Sélectionner un secteur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {NEW_OPPORTUNITY_SECTORS.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                              {sector}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {errorFor("sector_choice")}
                    {opportunity?.sector && isAmbiguousLegacySector(opportunity.sector) && !sectorChoice ? (
                      <p className="text-xs text-amber-700">
                        The existing “{opportunity.sector}” category now has two possible sectors. Choose the precise sector before saving.
                      </p>
                    ) : null}
                    {sectorChoice === OTHER_SECTOR ? (
                      <div className="space-y-2 pt-1">
                        <Label htmlFor="sector_other">Précisez le secteur *</Label>
                        <Input
                          id="sector_other"
                          name="sector_other"
                          placeholder="Ex. Économie sociale"
                          defaultValue={existingSectorIsCustom ? opportunity?.sector ?? "" : ""}
                          maxLength={120}
                          aria-invalid={Boolean(fieldErrors.sector_other)}
                          required
                        />
                        {errorFor("sector_other")}
                      </div>
                    ) : null}
                </>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity">Activity</Label>
                <Input id="activity" name="activity" defaultValue={opportunity?.activity ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Localisation *</Label>
                <Input id="location" name="location" defaultValue={opportunity?.location ?? ""} required />
                {errorFor("location")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_added">Date ajout *</Label>
                <Input id="date_added" name="date_added" type="date" defaultValue={opportunity?.date_added ?? ""} required />
                {errorFor("date_added")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue_meur">CA M€</Label>
                <Input id="revenue_meur" name="revenue_meur" inputMode="decimal" defaultValue={opportunity?.revenue_meur ?? ""} />
                {errorFor("revenue_meur")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ebitda_keur">EBE K€</Label>
                <Input id="ebitda_keur" name="ebitda_keur" inputMode="decimal" defaultValue={opportunity?.ebitda_keur ?? ""} />
                {errorFor("ebitda_keur")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount_range">Effectif</Label>
                <Input id="headcount_range" name="headcount_range" defaultValue={opportunity?.headcount_range ?? opportunity?.headcount ?? ""} />
                {errorFor("headcount_range")}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={opportunity?.description ?? ""} required />
              {errorFor("description")}
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-medium">Repreneur-visible version</h3>
              <p className="text-sm text-muted-foreground">Use anonymized content until disclosure is explicitly approved.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repreneur_exposure">Repreneur exposure</Label>
                <Select name="repreneur_exposure" defaultValue={opportunity?.repreneur_exposure ?? "anonymized"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPPORTUNITY_VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="public_title">Public title</Label>
                <Input id="public_title" name="public_title" defaultValue={opportunity?.public_title ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teaser_summary">Teaser summary</Label>
              <Textarea id="teaser_summary" name="teaser_summary" rows={3} defaultValue={opportunity?.teaser_summary ?? ""} required />
              {errorFor("teaser_summary")}
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-medium">Staff-only M&A source</h3>
              <p className="text-sm text-muted-foreground">Minimal source/contact context. Not a CRM.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source_firm_name">Source</Label>
                <Input id="source_firm_name" name="source_firm_name" defaultValue={opportunity?.source?.firm_name ?? opportunity?.source_label ?? ""} />
                {errorFor("source_firm_name")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_type">Source type</Label>
                <Select name="source_type" defaultValue={opportunity?.source?.source_type ?? "ma_firm"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MA_SOURCE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_contact_name">M&A contact name</Label>
                <Input id="source_contact_name" name="source_contact_name" defaultValue={opportunity?.source?.contact_name ?? ""} />
                {errorFor("source_contact_name")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_contact_email">M&A contact email</Label>
                <Input id="source_contact_email" name="source_contact_email" type="email" defaultValue={opportunity?.source?.contact_email ?? ""} />
                {errorFor("source_contact_email")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_contact_phone">Contact phone</Label>
                <Input id="source_contact_phone" name="source_contact_phone" defaultValue={opportunity?.source?.contact_phone ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source_internal_notes">Source internal notes</Label>
              <Textarea id="source_internal_notes" name="source_internal_notes" rows={3} defaultValue={opportunity?.source?.internal_notes ?? ""} />
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Opportunity internal notes</Label>
              <Textarea id="internal_notes" name="internal_notes" rows={3} defaultValue={opportunity?.internal_notes ?? ""} />
            </div>
          </section>

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
