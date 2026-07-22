"use client"

import { type FormEvent, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  MA_SOURCE_TYPE_OPTIONS,
  getOpportunityIncompleteDataFieldLabel,
  OPPORTUNITY_STATUS_OPTIONS,
  OPPORTUNITY_VISIBILITY_OPTIONS,
  type MaSourceContact,
  type MaSourceType,
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

const EDITABLE_OPPORTUNITY_STATUS_OPTIONS = OPPORTUNITY_STATUS_OPTIONS.filter(
  (option) => option.value !== "closed",
)
const NEW_SOURCE_OPTION_VALUE = "__new_source__"

export interface OpportunitySourceOption {
  id: string
  firm_name: string
  source_type: MaSourceType
  internal_notes?: string | null
  contacts: MaSourceContact[]
}

interface OpportunityFormProps {
  opportunity?: OpportunityWithSource
  action: (formData: FormData) => Promise<OpportunityActionResult | void>
  submitLabel?: string
  sourceOptions?: OpportunitySourceOption[]
}

export function OpportunityForm({
  opportunity,
  action,
  submitLabel = "Save opportunity",
  sourceOptions = [],
}: OpportunityFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const incompleteDataAcknowledgementRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [incompleteDataWarning, setIncompleteDataWarning] =
    useState<OpportunityIncompleteDataWarning | null>(null)
  const normalizedExistingSector = normalizeOpportunitySector(opportunity?.sector)
  const existingSectorIsCustom = Boolean(
    opportunity?.sector &&
    !isAmbiguousLegacySector(opportunity.sector) &&
    (!normalizedExistingSector || !isSector(normalizedExistingSector)),
  )
  const [sectorChoice, setSectorChoice] = useState(
    normalizedExistingSector && isSector(normalizedExistingSector)
      ? normalizedExistingSector
      : existingSectorIsCustom
        ? OTHER_SECTOR
        : "",
  )
  const isClosed = opportunity?.status === "closed"
  const [selectedSourceId, setSelectedSourceId] = useState(opportunity?.source_id ?? "")
  const [sourceFirmName, setSourceFirmName] = useState(
    opportunity?.source?.firm_name ?? opportunity?.source_label ?? "",
  )
  const [sourceType, setSourceType] = useState<MaSourceType>(
    opportunity?.source?.source_type ?? "ma_firm",
  )
  const [sourceInternalNotes, setSourceInternalNotes] = useState(
    opportunity?.source?.internal_notes ?? "",
  )
  const [sourceLabel, setSourceLabel] = useState(opportunity?.source_label ?? "")
  const selectedSource = selectedSourceId
    ? sourceOptions.find((source) => source.id === selectedSourceId) ??
      (opportunity?.source?.id === selectedSourceId ? opportunity.source : null)
    : null
  const sourceContacts = selectedSource?.contacts ?? []
  const [selectedSourceContactIds, setSelectedSourceContactIds] = useState<string[]>(() =>
    (opportunity?.source_contacts ?? []).map((relation) => relation.contact_id),
  )
  const [primarySourceContactId, setPrimarySourceContactId] = useState<string | null>(
    () => opportunity?.source_contacts?.find((relation) => relation.is_primary)?.contact_id ?? null,
  )

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

  function chooseExistingSource(value: string) {
    if (value === NEW_SOURCE_OPTION_VALUE) {
      setSelectedSourceId("")
      setSourceFirmName("")
      setSourceType("ma_firm")
      setSourceInternalNotes("")
    } else {
      const source = sourceOptions.find((option) => option.id === value)
      if (!source) return
      setSelectedSourceId(source.id)
      setSourceFirmName(source.firm_name)
      setSourceType(source.source_type)
      setSourceInternalNotes(source.internal_notes ?? "")
    }
    setSourceLabel("")
    setSelectedSourceContactIds([])
    setPrimarySourceContactId(null)
  }

  function changeSourceFirmName(value: string) {
    setSourceFirmName(value)
    if (selectedSourceId && value !== selectedSource?.firm_name) {
      setSelectedSourceId("")
      setSourceType("ma_firm")
      setSourceInternalNotes("")
      setSourceLabel("")
      setSelectedSourceContactIds([])
      setPrimarySourceContactId(null)
    }
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
          <CardDescription>
            Keep staff-only source data separate from repreneur-visible information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <input type="hidden" name="source_id" value={selectedSourceId} />
          <input type="hidden" name="source_label" value={sourceLabel} />
          <input type="hidden" name="source_contacts_submitted" value="true" />
          <input
            ref={incompleteDataAcknowledgementRef}
            type="hidden"
            name="acknowledge_incomplete_data"
          />

          {incompleteDataWarning ? (
            <Alert className="border-amber-300 bg-amber-50/70 text-amber-950 [&>svg]:text-amber-700">
              <AlertTriangle className="text-amber-700" />
              <AlertTitle>Incomplete data — this opportunity may not match correctly</AlertTitle>
              <AlertDescription className="gap-3 text-amber-900">
                <p>
                  Missing:{" "}
                  {incompleteDataWarning.missingFields
                    .map(getOpportunityIncompleteDataFieldLabel)
                    .join(", ")}
                  .
                </p>
                <p>You can keep editing, or save the opportunity with these values left unknown.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={acknowledgeIncompleteDataAndSave}
                    disabled={isSubmitting}
                  >
                    Save anyway
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIncompleteDataWarning(null)}
                    disabled={isSubmitting}
                  >
                    Keep editing
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-medium">Core fields</h3>
              <p className="text-sm text-muted-foreground">
                Operational data used by the Re-New team.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reference">Ref. Mandat *</Label>
                <Input
                  id="reference"
                  name="reference"
                  defaultValue={opportunity?.reference ?? ""}
                  required
                />
                {errorFor("reference")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                {isClosed ? (
                  <>
                    <Input id="status" value="Closed" disabled />
                    <input type="hidden" name="status" value="closed" />
                    <p className="text-xs text-muted-foreground">
                      Reopen this opportunity from Overview before changing its status.
                    </p>
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
                  {opportunity?.sector &&
                  isAmbiguousLegacySector(opportunity.sector) &&
                  !sectorChoice ? (
                    <p className="text-xs text-amber-700">
                      The existing “{opportunity.sector}” category now has two possible sectors.
                      Choose the precise sector before saving.
                    </p>
                  ) : null}
                  {sectorChoice === OTHER_SECTOR ? (
                    <div className="space-y-2 pt-1">
                      <Label htmlFor="sector_other">Précisez le secteur *</Label>
                      <Input
                        id="sector_other"
                        name="sector_other"
                        placeholder="Ex. Économie sociale"
                        defaultValue={existingSectorIsCustom ? (opportunity?.sector ?? "") : ""}
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
                <Input
                  id="location"
                  name="location"
                  defaultValue={opportunity?.location ?? ""}
                  required
                />
                {errorFor("location")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_added">Date ajout *</Label>
                <Input
                  id="date_added"
                  name="date_added"
                  type="date"
                  defaultValue={opportunity?.date_added ?? ""}
                  required
                />
                {errorFor("date_added")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue_meur">CA M€</Label>
                <Input
                  id="revenue_meur"
                  name="revenue_meur"
                  inputMode="decimal"
                  defaultValue={opportunity?.revenue_meur ?? ""}
                />
                {errorFor("revenue_meur")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ebitda_keur">EBE K€</Label>
                <Input
                  id="ebitda_keur"
                  name="ebitda_keur"
                  inputMode="decimal"
                  defaultValue={opportunity?.ebitda_keur ?? ""}
                />
                {errorFor("ebitda_keur")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount_range">Effectif</Label>
                <Input
                  id="headcount_range"
                  name="headcount_range"
                  defaultValue={opportunity?.headcount_range ?? opportunity?.headcount ?? ""}
                />
                {errorFor("headcount_range")}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={opportunity?.description ?? ""}
                required
              />
              {errorFor("description")}
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-medium">Repreneur-visible version</h3>
              <p className="text-sm text-muted-foreground">
                Use anonymized content until disclosure is explicitly approved.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repreneur_exposure">Repreneur exposure</Label>
                <Select
                  name="repreneur_exposure"
                  defaultValue={opportunity?.repreneur_exposure ?? "anonymized"}
                >
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
                <Input
                  id="public_title"
                  name="public_title"
                  defaultValue={opportunity?.public_title ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teaser_summary">Teaser summary</Label>
              <Textarea
                id="teaser_summary"
                name="teaser_summary"
                rows={3}
                defaultValue={opportunity?.teaser_summary ?? ""}
                required
              />
              {errorFor("teaser_summary")}
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div>
              <h3 className="text-sm font-medium">Staff-only M&A source</h3>
              <p className="text-sm text-muted-foreground">
                Link the firm once, then choose the people for this opportunity.
              </p>
            </div>
            {!opportunity && sourceOptions.length > 0 ? (
              <div className="space-y-2 rounded-md border bg-background p-4">
                <Label htmlFor="existing_source">Existing M&A firm</Label>
                <Select
                  value={selectedSourceId || NEW_SOURCE_OPTION_VALUE}
                  onValueChange={chooseExistingSource}
                >
                  <SelectTrigger id="existing_source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NEW_SOURCE_OPTION_VALUE}>Add a new firm</SelectItem>
                      {sourceOptions.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.firm_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose a known firm to select its existing contacts for this opportunity.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source_firm_name">Source</Label>
                <Input
                  id="source_firm_name"
                  name="source_firm_name"
                  value={sourceFirmName}
                  onChange={(event) => changeSourceFirmName(event.target.value)}
                />
                {errorFor("source_firm_name")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_type">Source type</Label>
                <Select
                  name="source_type"
                  value={sourceType}
                  onValueChange={(value) => setSourceType(value as MaSourceType)}
                  disabled={Boolean(selectedSourceId)}
                >
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
            </div>

            {selectedSource ? (
              <div className="space-y-3 rounded-md border bg-background p-4">
                <div>
                  <p className="text-sm font-medium">Contacts for this opportunity</p>
                  <p className="text-sm text-muted-foreground">
                    Select everyone who may be involved. Choose one default recipient for
                    intermediary follow-up.
                  </p>
                </div>
                {sourceContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This firm has no contacts yet. Add one below or from the M&A directory.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {sourceContacts.map((contact) => {
                      const label =
                        contact.name || contact.email || contact.phone || "Unnamed contact"
                      const isLinked = selectedSourceContactIds.includes(contact.id)
                      return (
                        <div
                          key={contact.id}
                          className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <label
                            htmlFor={`source_contact_${contact.id}`}
                            className="flex min-w-0 cursor-pointer items-start gap-3"
                          >
                            <Checkbox
                              id={`source_contact_${contact.id}`}
                              name="source_contact_ids"
                              value={contact.id}
                              checked={isLinked}
                              onCheckedChange={(checked) => {
                                const isChecked = checked === true
                                setSelectedSourceContactIds((current) => {
                                  const next = isChecked
                                    ? [...new Set([...current, contact.id])]
                                    : current.filter((id) => id !== contact.id)
                                  if (!isChecked && primarySourceContactId === contact.id) {
                                    setPrimarySourceContactId(next[0] ?? null)
                                  } else if (isChecked && !primarySourceContactId) {
                                    setPrimarySourceContactId(contact.id)
                                  }
                                  return next
                                })
                              }}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{label}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
                                  "No email or phone"}
                              </span>
                            </span>
                          </label>
                          <label className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="radio"
                              name="source_primary_contact_id"
                              value={contact.id}
                              checked={primarySourceContactId === contact.id}
                              disabled={!isLinked}
                              onChange={() => setPrimarySourceContactId(contact.id)}
                            />
                            Default recipient
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-3 rounded-md border bg-background p-4">
              <div>
                <p className="text-sm font-medium">Add a contact with this save</p>
                <p className="text-sm text-muted-foreground">
                  Use this for a new firm or a newly identified person. More contacts are managed
                  from M&A.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="new_source_contact_name">M&A contact name</Label>
                  <Input id="new_source_contact_name" name="new_source_contact_name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_source_contact_email">M&A contact email</Label>
                  <Input
                    id="new_source_contact_email"
                    name="new_source_contact_email"
                    type="email"
                  />
                  {errorFor("new_source_contact_email")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_source_contact_phone">Contact phone</Label>
                  <Input id="new_source_contact_phone" name="new_source_contact_phone" />
                </div>
              </div>
              {errorFor("source_contact")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="source_internal_notes">Source internal notes</Label>
              <Textarea
                id="source_internal_notes"
                name="source_internal_notes"
                rows={3}
                value={sourceInternalNotes}
                onChange={(event) => setSourceInternalNotes(event.target.value)}
                disabled={Boolean(selectedSourceId)}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Opportunity internal notes</Label>
              <Textarea
                id="internal_notes"
                name="internal_notes"
                rows={3}
                defaultValue={opportunity?.internal_notes ?? ""}
              />
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
