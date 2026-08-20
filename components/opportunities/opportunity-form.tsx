"use client"

import { type FormEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
  FieldError,
  FormFieldLabel,
  ValidationSummary,
  fieldErrorProps,
  focusValidationSummary,
} from "@/components/forms/validation-feedback"
import { OpportunitySourceContext } from "@/components/opportunities/opportunity-source-context"
import {
  OPPORTUNITY_STATUS_OPTIONS,
  type MaOfficeIntakeOffice,
  type OpportunityActionResult,
  type OpportunityGeographyOption,
  type OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  isAmbiguousLegacySector,
  isSector,
  NEW_OPPORTUNITY_SECTORS,
  normalizeOpportunitySector,
  OTHER_SECTOR,
  setOpportunitySectorChoiceForSubmission,
} from "@/lib/utils/opportunity-sector"
import { formatOpportunitySourceDate } from "@/lib/utils/opportunity-source-date"

const INTAKE_STATUS_OPTIONS = OPPORTUNITY_STATUS_OPTIONS.filter(
  (option) =>
    option.value === "draft" ||
    option.value === "active" ||
    option.value === "paused",
)
interface OpportunityFormProps {
  opportunity?: OpportunityWithSource
  action: (formData: FormData) => Promise<OpportunityActionResult | void>
  submitLabel?: string
  officeOptions: MaOfficeIntakeOffice[]
  geographyOptions: OpportunityGeographyOption[]
  geographyMandatesEnabled?: boolean
}



export function OpportunityForm({
  opportunity,
  action,
  submitLabel = "Save opportunity",
  officeOptions,
  geographyOptions,
  geographyMandatesEnabled = false,
}: OpportunityFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateAddedConfirmedDay, setDateAddedConfirmedDay] = useState(false)
  const [clearMonthOnlyDate, setClearMonthOnlyDate] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const validationSummaryRef = useRef<HTMLDivElement>(null)
  const normalizedExistingSector = normalizeOpportunitySector(
    opportunity?.sector,
  )
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
  const isHistorical =
    opportunity?.status === "closed" || opportunity?.status === "archived"
  const hasMonthOnlyDate =
    opportunity?.date_added_precision === "month" && Boolean(opportunity.date_added)
  const [status, setStatus] = useState(
    opportunity?.status === "active" || opportunity?.status === "paused"
      ? opportunity.status
      : "draft",
  )
  const [selectedGeographyNodeId, setSelectedGeographyNodeId] = useState(
    opportunity?.geography_node_id ?? "",
  )

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) focusValidationSummary(validationSummaryRef)
  }, [fieldErrors])

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isHistorical) return

    const formData = new FormData(event.currentTarget)
    setOpportunitySectorChoiceForSubmission(formData, sectorChoice)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const result = await action(formData)
      if (!result?.success) {
        setFieldErrors(result?.fieldErrors ?? { form: result?.message ?? "The opportunity could not be saved." })
        toast.error(result?.message ?? "Opportunity could not be saved.")
      } else {
        toast.success(result.message)
        if (!opportunity && result.opportunityId) {
          router.push(`/opportunities/${result.opportunityId}`)
          router.refresh()
        }
      }
    } catch (error) {
      console.error("Opportunity save failed")
      setFieldErrors({ form: "The opportunity could not be saved. Check the details and try again." })
      toast.error(
        error instanceof Error
          ? error.message
          : "Opportunity could not be saved.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }



  return (
    <>
      <form id="opportunity-form" noValidate onSubmit={handleSubmit} className="mx-auto max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>
              {opportunity ? "Edit opportunity" : "Create opportunity"}
            </CardTitle>
            <CardDescription>
              Drafts can start with a reference only. Activating or pausing a
              deal requires a verified operating office and one named primary
              contact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <ValidationSummary
              ref={validationSummaryRef}
              errors={fieldErrors}
              labels={{
                form: "Opportunity details",
                reference: "Ref. Mandat",
                geography_node_id: "Canonical geography",
                public_title: "Public title",
                status: "Status",
                source_office_id: "Operating office",
                affiliation_ids: "Office contacts",
                primary_affiliation_id: "Primary recipient",
                sector_choice: "Sector",
                sector_other: "Sector",
                revenue_meur: "CA M€",
                ebitda_keur: "EBE K€",
                date_added: "Date added",
              }}
              targets={{
                source_office_id: "source_office",
                affiliation_ids: "office-contacts",
                primary_affiliation_id: "office-contacts",
              }}
            />
            {geographyMandatesEnabled ? (
              <input type="hidden" name="geography_node_id" value={selectedGeographyNodeId} />
            ) : null}

            {isHistorical ? (
              <Alert>
                <AlertTitle>Historical opportunity</AlertTitle>
                <AlertDescription>
                  Closed and archived opportunity source context is retained as
                  history and cannot be changed through Opportunity Intake.
                </AlertDescription>
              </Alert>
            ) : null}

            <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
              <div>
                <h3 className="text-sm font-medium">Core fields</h3>
                <p className="text-sm text-muted-foreground">
                  {geographyMandatesEnabled
                    ? "New records receive an immutable Re-New reference after you select geography. Financial data may remain unknown."
                    : "A reference is sufficient for a staff-only draft. Financial data may remain unknown."}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {opportunity ? (
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="reference" requirement="required">Ref. Mandat</FormFieldLabel>
                    <Input id="reference" name="reference" value={opportunity.reference} readOnly aria-readonly="true" />
                    <p className="text-xs text-muted-foreground">References are permanent and cannot change when geography is corrected.</p>
                  </div>
                ) : geographyMandatesEnabled ? (
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="generated-reference" requirement="optional" requirementText="Generated by WAVE">Ref. Mandat</FormFieldLabel>
                    <Input id="generated-reference" value="Generated after creation" disabled />
                    <p className="text-xs text-muted-foreground">WAVE allocates the next reference atomically after geography is selected.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="reference" requirement="required">Ref. Mandat</FormFieldLabel>
                    <Input
                      id="reference"
                      name="reference"
                      required
                      onChange={() => clearFieldError("reference")}
                      {...fieldErrorProps("reference", fieldErrors.reference)}
                    />
                    <FieldError id="reference" message={fieldErrors.reference} />
                  </div>
                )}
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="status" requirement="required">Status</FormFieldLabel>
                  {isHistorical ? (
                    <Input
                      id="status"
                      value={
                        opportunity?.status === "closed" ? "Closed" : "Archived"
                      }
                      disabled
                    />
                  ) : (
                    <Select
                      name="status"
                      value={status}
                      onValueChange={(value) => { setStatus(value); clearFieldError("status") }}
                    >
                      <SelectTrigger
                        id="status"
                        {...fieldErrorProps("status", fieldErrors.status)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {INTAKE_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                  <FieldError id="status" message={fieldErrors.status} />
                </div>
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="sector_choice" requirement="conditional" requirementText="Required before proposal">Secteur</FormFieldLabel>
                  <Select
                    value={sectorChoice}
                    onValueChange={(value) => { setSectorChoice(value); clearFieldError("sector_choice") }}
                    disabled={isHistorical}
                  >
                    <SelectTrigger
                      id="sector_choice"
                      className="w-full"
                      {...fieldErrorProps("sector_choice", fieldErrors.sector_choice)}
                    >
                      <SelectValue placeholder="Optional sector" />
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
                  <FieldError id="sector_choice" message={fieldErrors.sector_choice} />
                  {opportunity?.sector &&
                  isAmbiguousLegacySector(opportunity.sector) &&
                  !sectorChoice ? (
                    <p className="text-xs text-amber-700">
                      The existing “{opportunity.sector}” category can be
                      refined when this opportunity is next updated.
                    </p>
                  ) : null}
                  {sectorChoice === OTHER_SECTOR ? (
                    <div className="space-y-2 pt-1">
                      <FormFieldLabel htmlFor="sector_other" requirement="required">Specify sector</FormFieldLabel>
                      <Input
                        id="sector_other"
                        name="sector_other"
                        placeholder="Example: Social economy"
                        defaultValue={
                          existingSectorIsCustom
                            ? (opportunity?.sector ?? "")
                            : ""
                        }
                        maxLength={120}
                        disabled={isHistorical}
                        onChange={() => clearFieldError("sector_other")}
                        {...fieldErrorProps("sector_other", fieldErrors.sector_other)}
                      />
                      <FieldError id="sector_other" message={fieldErrors.sector_other} />
                    </div>
                  ) : null}
                </div>
                {geographyMandatesEnabled ? (
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="geography_node_id" requirement={opportunity ? "optional" : "required"}>Canonical geography</FormFieldLabel>
                  <Select
                    value={selectedGeographyNodeId}
                    onValueChange={(value) => { setSelectedGeographyNodeId(value); clearFieldError("geography_node_id") }}
                    disabled={isHistorical}
                  >
                    <SelectTrigger id="geography_node_id" {...fieldErrorProps("geography_node_id", fieldErrors.geography_node_id)}>
                      <SelectValue placeholder="Choose France, a zone, or a region" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["country", "macro_zone", "region"] as const).map((level) => {
                        const options = geographyOptions.filter((option) => option.node_level === level)
                        if (options.length === 0) return null
                        const label = level === "country" ? "France" : level === "macro_zone" ? "Macro-zones" : "Regions"
                        return <SelectGroup key={level}><span className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{label}</span>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label} · {option.code}</SelectItem>)}</SelectGroup>
                      })}
                    </SelectContent>
                  </Select>
                  <FieldError id="geography_node_id" message={fieldErrors.geography_node_id} />
                </div>
                ) : null}
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="location" requirement="conditional" requirementText="Required before proposal">Localisation</FormFieldLabel>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={opportunity?.location ?? ""}
                    disabled={isHistorical}
                  />
                </div>
                <div className="space-y-2" id="date_added-field">
                  <FormFieldLabel
                    htmlFor={hasMonthOnlyDate ? "date_added_confirm_day" : "date_added"}
                    requirement="optional"
                  >
                    Date ajout
                  </FormFieldLabel>
                  {hasMonthOnlyDate ? (
                    <>
                      <input type="hidden" name="date_added_preserve_month" value="true" />
                      <p className="text-sm text-muted-foreground">
                        Source recorded: {formatOpportunitySourceDate(opportunity?.date_added, "month")} (month only)
                      </p>
                      <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          id="date_added_confirm_day"
                          name="date_added_confirm_day"
                          checked={dateAddedConfirmedDay}
                          disabled={isHistorical || clearMonthOnlyDate}
                          onCheckedChange={(checked) => {
                            const next = checked === true
                            setDateAddedConfirmedDay(next)
                            if (next) setClearMonthOnlyDate(false)
                          }}
                        />
                        <span>I have verified the exact calendar day.</span>
                      </label>
                      {dateAddedConfirmedDay ? (
                        <Input
                          id="date_added"
                          name="date_added"
                          type="date"
                          required
                          disabled={isHistorical}
                          aria-describedby="date-added-confirmation-help"
                        />
                      ) : null}
                      <p id="date-added-confirmation-help" className="text-xs text-muted-foreground">
                        Confirming replaces the month-only source with the exact day you enter.
                      </p>
                      <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          name="date_added_clear"
                          checked={clearMonthOnlyDate}
                          disabled={isHistorical || dateAddedConfirmedDay}
                          onCheckedChange={(checked) => {
                            const next = checked === true
                            setClearMonthOnlyDate(next)
                            if (next) setDateAddedConfirmedDay(false)
                          }}
                        />
                        <span>Remove this source date.</span>
                      </label>
                    </>
                  ) : (
                    <Input
                      id="date_added"
                      name="date_added"
                      type="date"
                      defaultValue={opportunity?.date_added ?? ""}
                      disabled={isHistorical}
                    />
                  )}
                  <FieldError id="date_added" message={fieldErrors.date_added} />
                </div>
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="revenue_meur" requirement="optional">CA M€</FormFieldLabel>
                  <Input
                    id="revenue_meur"
                    name="revenue_meur"
                    inputMode="decimal"
                    defaultValue={opportunity?.revenue_meur ?? ""}
                    disabled={isHistorical}
                  />
                  <FieldError id="revenue_meur" message={fieldErrors.revenue_meur} />
                </div>
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="ebitda_keur" requirement="optional">EBE K€</FormFieldLabel>
                  <Input
                    id="ebitda_keur"
                    name="ebitda_keur"
                    inputMode="decimal"
                    defaultValue={opportunity?.ebitda_keur ?? ""}
                    disabled={isHistorical}
                  />
                  <FieldError id="ebitda_keur" message={fieldErrors.ebitda_keur} />
                </div>
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="headcount_range" requirement="optional">Effectif</FormFieldLabel>
                  <Input
                    id="headcount_range"
                    name="headcount_range"
                    defaultValue={
                      opportunity?.headcount_range ??
                      opportunity?.headcount ??
                      ""
                    }
                    disabled={isHistorical}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FormFieldLabel htmlFor="description" requirement="conditional" requirementText="Required to activate or pause">Description</FormFieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  defaultValue={opportunity?.description ?? ""}
                  disabled={isHistorical}
                  onChange={() => clearFieldError("description")}
                  {...fieldErrorProps("description", fieldErrors.description)}
                />
                <FieldError id="description" message={fieldErrors.description} />
              </div>
            </section>

            <OpportunitySourceContext
              opportunity={opportunity}
              officeOptions={officeOptions}
              disabled={isHistorical}
              fieldErrors={fieldErrors}
              clearFieldError={clearFieldError}
            />

            <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
              <div>
                <h3 className="text-sm font-medium">
                  Potential repreneur-facing content
                </h3>
                <p className="text-sm text-muted-foreground">
                  These details can be prepared early. Activation never
                  publishes a deal; disclosure is a separate, controlled
                  workflow.
                </p>
              </div>
              <div className="space-y-2">
                <FormFieldLabel htmlFor="public_title" requirement="required">Public title</FormFieldLabel>
                <Input
                  id="public_title"
                  name="public_title"
                  defaultValue={opportunity?.public_title ?? ""}
                  required={!opportunity}
                  disabled={isHistorical}
                  onChange={() => clearFieldError("public_title")}
                  {...fieldErrorProps("public_title", fieldErrors.public_title)}
                />
                <FieldError id="public_title" message={fieldErrors.public_title} />
              </div>
              <div className="space-y-2">
                <FormFieldLabel htmlFor="teaser_summary" requirement="conditional" requirementText="Required before proposal">Teaser summary</FormFieldLabel>
                <Textarea
                  id="teaser_summary"
                  name="teaser_summary"
                  rows={3}
                  defaultValue={opportunity?.teaser_summary ?? ""}
                  disabled={isHistorical}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
              <div className="space-y-2">
                <FormFieldLabel htmlFor="internal_notes" requirement="optional">
                  Opportunity internal notes
                </FormFieldLabel>
                <Textarea
                  id="internal_notes"
                  name="internal_notes"
                  rows={3}
                  defaultValue={opportunity?.internal_notes ?? ""}
                  disabled={isHistorical}
                />
              </div>
            </section>

            <div className="flex justify-end border-t pt-5">
              <Button type="submit" disabled={isSubmitting || isHistorical}>
                {isSubmitting ? "Saving..." : submitLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </>
  )
}
