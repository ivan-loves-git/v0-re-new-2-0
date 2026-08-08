"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  OPPORTUNITY_STATUS_OPTIONS,
  type MaCanonicalContactOption,
  type MaOfficeIntakeOffice,
  type OpportunityActionResult,
  type OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  createMaFirmOfficeContext,
  createMaOfficeForExistingFirm,
  createMaOfficeContact,
  listMaCanonicalContactOptions,
} from "@/lib/actions/opportunity-intake"
import {
  isAmbiguousLegacySector,
  isSector,
  NEW_OPPORTUNITY_SECTORS,
  normalizeOpportunitySector,
  OTHER_SECTOR,
} from "@/lib/utils/opportunity-sector"

const INTAKE_STATUS_OPTIONS = OPPORTUNITY_STATUS_OPTIONS.filter(
  (option) =>
    option.value === "draft" ||
    option.value === "active" ||
    option.value === "paused",
)
const NO_OFFICE_OPTION_VALUE = "__no_office__"
const NO_CANONICAL_CONTACT_OPTION_VALUE = "__no_canonical_contact__"

type OfficeContactMode = "existing" | "new"
type OfficeContextMode = "new_firm" | "existing_firm"

interface OpportunityFormProps {
  opportunity?: OpportunityWithSource
  action: (formData: FormData) => Promise<OpportunityActionResult | void>
  submitLabel?: string
  officeOptions: MaOfficeIntakeOffice[]
}

function currentAffiliationIds(opportunity?: OpportunityWithSource) {
  return (opportunity?.office_contacts ?? [])
    .filter((link) => link.is_active)
    .map((link) => link.affiliation_id)
}

export function OpportunityForm({
  opportunity,
  action,
  submitLabel = "Save opportunity",
  officeOptions,
}: OpportunityFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
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
  const [status, setStatus] = useState(
    opportunity?.status === "active" || opportunity?.status === "paused"
      ? opportunity.status
      : "draft",
  )
  const [selectedOfficeId, setSelectedOfficeId] = useState(
    opportunity?.source_office_id ?? "",
  )
  const [createdOfficeOptions, setCreatedOfficeOptions] = useState<
    MaOfficeIntakeOffice[]
  >([])
  const [createOfficeDialogOpen, setCreateOfficeDialogOpen] = useState(false)
  const [officeContextMode, setOfficeContextMode] =
    useState<OfficeContextMode>("new_firm")
  const [existingFirmId, setExistingFirmId] = useState("")
  const [isCreatingOffice, setIsCreatingOffice] = useState(false)
  const [officeContextFieldErrors, setOfficeContextFieldErrors] = useState<
    Record<string, string>
  >({})
  const officeContextSummaryRef = useRef<HTMLDivElement>(null)
  const [createContactDialogOpen, setCreateContactDialogOpen] = useState(false)
  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [officeContactFieldErrors, setOfficeContactFieldErrors] = useState<
    Record<string, string>
  >({})
  const officeContactSummaryRef = useRef<HTMLDivElement>(null)
  const [contactMode, setContactMode] = useState<OfficeContactMode>("new")
  const [existingContactId, setExistingContactId] = useState("")
  const [canonicalContactOptions, setCanonicalContactOptions] = useState<
    MaCanonicalContactOption[]
  >([])
  const [isLoadingCanonicalContacts, setIsLoadingCanonicalContacts] =
    useState(false)
  const [canonicalContactLookupFailed, setCanonicalContactLookupFailed] =
    useState(false)
  const [selectedAffiliationIds, setSelectedAffiliationIds] = useState(() =>
    currentAffiliationIds(opportunity),
  )
  const [primaryAffiliationId, setPrimaryAffiliationId] = useState<
    string | null
  >(
    () =>
      opportunity?.office_contacts?.find(
        (link) => link.is_active && link.is_primary,
      )?.affiliation_id ?? null,
  )
  const availableOfficeOptions = useMemo(() => {
    const offices = new Map(
      officeOptions.map((office) => [office.office_id, office]),
    )
    for (const office of createdOfficeOptions) {
      offices.set(office.office_id, office)
    }
    return [...offices.values()]
  }, [createdOfficeOptions, officeOptions])
  const selectedOffice = useMemo(
    () =>
      availableOfficeOptions.find(
        (office) => office.office_id === selectedOfficeId,
      ) ?? null,
    [availableOfficeOptions, selectedOfficeId],
  )
  const availableFirms = useMemo(() => {
    const firms = new Map<string, { id: string; name: string }>()
    for (const office of availableOfficeOptions) {
      if (office.firm_status === "active") {
        firms.set(office.firm_id, {
          id: office.firm_id,
          name: office.firm_name,
        })
      }
    }
    return [...firms.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    )
  }, [availableOfficeOptions])
  const affiliateableCanonicalContacts = useMemo(() => {
    const selectedOfficeContactIds = new Set(
      selectedOffice?.contacts.map((contact) => contact.contact_id) ?? [],
    )
    return canonicalContactOptions.filter(
      (contact) => !selectedOfficeContactIds.has(contact.contact_id),
    )
  }, [canonicalContactOptions, selectedOffice])

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) focusValidationSummary(validationSummaryRef)
  }, [fieldErrors])

  useEffect(() => {
    if (Object.keys(officeContextFieldErrors).length > 0) {
      focusValidationSummary(officeContextSummaryRef)
    }
  }, [officeContextFieldErrors])

  useEffect(() => {
    if (Object.keys(officeContactFieldErrors).length > 0) {
      focusValidationSummary(officeContactSummaryRef)
    }
  }, [officeContactFieldErrors])

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function clearOfficeContextFieldError(field: string) {
    setOfficeContextFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function clearOfficeContactFieldError(field: string) {
    setOfficeContactFieldErrors((current) => {
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

  function chooseOffice(value: string) {
    const nextOfficeId = value === NO_OFFICE_OPTION_VALUE ? "" : value
    setSelectedOfficeId(nextOfficeId)
    clearFieldError("source_office_id")
    setSelectedAffiliationIds([])
    setPrimaryAffiliationId(null)
  }

  function toggleAffiliation(affiliationId: string, checked: boolean) {
    clearFieldError("affiliation_ids")
    clearFieldError("primary_affiliation_id")
    setSelectedAffiliationIds((current) => {
      const next = checked
        ? [...new Set([...current, affiliationId])]
        : current.filter((id) => id !== affiliationId)

      if (!checked && primaryAffiliationId === affiliationId) {
        setPrimaryAffiliationId(next[0] ?? null)
      } else if (checked && !primaryAffiliationId) {
        setPrimaryAffiliationId(affiliationId)
      }

      return next
    })
  }

  async function loadCanonicalContactOptions() {
    if (isLoadingCanonicalContacts) return

    setCanonicalContactOptions([])
    setExistingContactId("")
    setCanonicalContactLookupFailed(false)
    setIsLoadingCanonicalContacts(true)
    try {
      setCanonicalContactOptions(await listMaCanonicalContactOptions())
    } catch (error) {
      setCanonicalContactOptions([])
      setCanonicalContactLookupFailed(true)
      toast.error(
        error instanceof Error
          ? error.message
          : "Canonical contacts could not be loaded.",
      )
    } finally {
      setIsLoadingCanonicalContacts(false)
    }
  }

  function chooseContactMode(value: string) {
    const nextMode: OfficeContactMode =
      value === "existing" ? "existing" : "new"
    setContactMode(nextMode)
    setExistingContactId("")
    if (nextMode === "existing") {
      void loadCanonicalContactOptions()
    } else {
      setCanonicalContactOptions([])
      setCanonicalContactLookupFailed(false)
    }
  }

  function openCreateContactDialog() {
    setContactMode("new")
    setExistingContactId("")
    setCanonicalContactOptions([])
    setCanonicalContactLookupFailed(false)
    setCreateContactDialogOpen(true)
  }

  async function handleCreateOfficeContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOfficeContextFieldErrors({})
    setIsCreatingOffice(true)
    try {
      const formData = new FormData(event.currentTarget)
      const result =
        officeContextMode === "existing_firm"
          ? await createMaOfficeForExistingFirm(formData)
          : await createMaFirmOfficeContext(formData)
      if (!result.success || !result.office) {
        setOfficeContextFieldErrors(result.fieldErrors ?? { form: result.message })
        toast.error("M&A source not created", { description: result.message })
        return
      }

      const office = result.office

      setCreatedOfficeOptions((current) => [
        ...current.filter((item) => item.office_id !== office.office_id),
        office,
      ])
      setSelectedOfficeId(office.office_id)
      const firstContact = office.contacts[0]
      setSelectedAffiliationIds(
        firstContact ? [firstContact.affiliation_id] : [],
      )
      setPrimaryAffiliationId(firstContact?.affiliation_id ?? null)
      setCreateOfficeDialogOpen(false)
      setExistingFirmId("")
      toast.success(result.message)
    } catch (error) {
      setOfficeContextFieldErrors({ form: "The M&A source could not be created. Try again." })
      toast.error(
        error instanceof Error
          ? error.message
          : "M&A source could not be created.",
      )
    } finally {
      setIsCreatingOffice(false)
    }
  }

  async function handleCreateOfficeContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedOffice) return

    setOfficeContactFieldErrors({})

    const selectedCanonicalContact =
      contactMode === "existing"
        ? canonicalContactOptions.find(
            (contact) => contact.contact_id === existingContactId,
          )
        : null
    setIsCreatingContact(true)
    try {
      const result = await createMaOfficeContact(
        selectedOffice.office_id,
        new FormData(event.currentTarget),
      )
      if (!result.success || !result.contact) {
        setOfficeContactFieldErrors({ form: result.message })
        toast.error("Office contact not added", {
          description: result.message,
        })
        return
      }

      const contact = selectedCanonicalContact
        ? {
            ...result.contact,
            contact_name: selectedCanonicalContact.contact_name,
            contact_email: selectedCanonicalContact.contact_email,
          }
        : result.contact
      setCreatedOfficeOptions((current) => {
        const currentOffice =
          current.find(
            (office) => office.office_id === selectedOffice.office_id,
          ) ?? selectedOffice
        const nextOffice: MaOfficeIntakeOffice = {
          ...currentOffice,
          contacts: [
            ...currentOffice.contacts.filter(
              (item) => item.affiliation_id !== contact.affiliation_id,
            ),
            contact,
          ],
        }
        return [
          ...current.filter(
            (office) => office.office_id !== selectedOffice.office_id,
          ),
          nextOffice,
        ]
      })
      setSelectedAffiliationIds((current) =>
        current.length > 0 ? current : [contact.affiliation_id],
      )
      setPrimaryAffiliationId((current) => current ?? contact.affiliation_id)
      setCreateContactDialogOpen(false)
      setContactMode("new")
      setExistingContactId("")
      setCanonicalContactOptions([])
      setCanonicalContactLookupFailed(false)
      toast.success(result.message)
    } catch (error) {
      setOfficeContactFieldErrors({ form: "The office contact could not be added. Try again." })
      toast.error(
        error instanceof Error
          ? error.message
          : "Office contact could not be added.",
      )
    } finally {
      setIsCreatingContact(false)
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
            />
            <input
              type="hidden"
              name="source_office_id"
              value={selectedOfficeId}
            />

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
                  A reference is sufficient for a staff-only draft. Financial
                  data may remain unknown.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="reference" requirement="required">Ref. Mandat</FormFieldLabel>
                  <Input
                    id="reference"
                    name="reference"
                    defaultValue={opportunity?.reference ?? ""}
                    required
                    disabled={isHistorical}
                    onChange={() => clearFieldError("reference")}
                    {...fieldErrorProps("reference", fieldErrors.reference)}
                  />
                  <FieldError id="reference" message={fieldErrors.reference} />
                </div>
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
                    name="sector_choice"
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
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="location" requirement="conditional" requirementText="Required before proposal">Localisation</FormFieldLabel>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={opportunity?.location ?? ""}
                    disabled={isHistorical}
                  />
                </div>
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="date_added" requirement="optional">Date ajout</FormFieldLabel>
                  <Input
                    id="date_added"
                    name="date_added"
                    type="date"
                    defaultValue={opportunity?.date_added ?? ""}
                    disabled={isHistorical}
                  />
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

            <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">
                      Staff-only M&A source
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      The operating office is the source anchor. Contacts are
                      selectable only when they have an active affiliation with
                      that office.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateOfficeDialogOpen(true)}
                    disabled={isHistorical}
                  >
                    Add firm context
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <FormFieldLabel htmlFor="source_office" requirement="conditional" requirementText="Required to activate or pause">Operating office</FormFieldLabel>
                <Select
                  value={selectedOfficeId || NO_OFFICE_OPTION_VALUE}
                  onValueChange={chooseOffice}
                  disabled={isHistorical}
                >
                  <SelectTrigger
                    id="source_office"
                    {...fieldErrorProps("source_office", fieldErrors.source_office_id)}
                  >
                    <SelectValue placeholder="Choose an operating office" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_OFFICE_OPTION_VALUE}>
                        No office yet (draft only)
                      </SelectItem>
                      {availableOfficeOptions.map((office) => (
                        <SelectItem
                          key={office.office_id}
                          value={office.office_id}
                        >
                          {office.office_label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError id="source_office" message={fieldErrors.source_office_id} />
                {selectedOffice ? (
                  <p className="text-xs text-muted-foreground">
                    Firm: {selectedOffice.firm_name} · Office:{" "}
                    {selectedOffice.office_name}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    A staff-only draft may be created before the office is
                    known.
                  </p>
                )}
              </div>

              {selectedOffice ? (
                <div className="space-y-3 rounded-md border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Contacts for this opportunity
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Select the office-affiliated people involved, then
                        choose one primary recipient. Active and paused
                        opportunities require both.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openCreateContactDialog}
                      disabled={isHistorical}
                    >
                      Add office contact
                    </Button>
                  </div>
                  {selectedOffice.contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This office has no active affiliated contacts yet. Keep
                      the opportunity as a draft until the source record is
                      completed.
                    </p>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {selectedOffice.contacts.map((contact) => {
                        const isLinked = selectedAffiliationIds.includes(
                          contact.affiliation_id,
                        )
                        return (
                          <div
                            key={contact.affiliation_id}
                            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <label
                              htmlFor={`office_affiliation_${contact.affiliation_id}`}
                              className="flex min-w-0 cursor-pointer items-start gap-3"
                            >
                              <Checkbox
                                id={`office_affiliation_${contact.affiliation_id}`}
                                name="affiliation_ids"
                                value={contact.affiliation_id}
                                checked={isLinked}
                                disabled={isHistorical}
                                onCheckedChange={(checked) =>
                                  toggleAffiliation(
                                    contact.affiliation_id,
                                    checked === true,
                                  )
                                }
                                className="mt-0.5"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {contact.contact_name || "Unnamed contact"}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {[contact.job_title, contact.contact_email]
                                    .filter(Boolean)
                                    .join(" · ") || "No usable email"}
                                </span>
                              </span>
                            </label>
                            <label className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="radio"
                                name="primary_affiliation_id"
                                value={contact.affiliation_id}
                                checked={
                                  primaryAffiliationId ===
                                  contact.affiliation_id
                                }
                                disabled={!isLinked || isHistorical}
                                onChange={() =>
                                  setPrimaryAffiliationId(
                                    contact.affiliation_id,
                                  )
                                }
                              />
                              Primary recipient
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div id="office-contacts" className="space-y-2">
                    <FieldError id="office-contacts" message={fieldErrors.affiliation_ids} />
                    <FieldError id="office-contacts-primary" message={fieldErrors.primary_affiliation_id} />
                  </div>
                </div>
              ) : null}
            </section>

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

      <Dialog
        open={createOfficeDialogOpen}
        onOpenChange={(open) => {
          if (!isCreatingOffice) {
            setCreateOfficeDialogOpen(open)
            if (!open) setOfficeContextFieldErrors({})
            if (!open) {
              setOfficeContextMode("new_firm")
              setExistingFirmId("")
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add M&A firm context</DialogTitle>
            <DialogDescription>
              Create a new firm context, or add a real operating office to an
              existing active firm. Neither action publishes an opportunity.
            </DialogDescription>
          </DialogHeader>
          <form id="office-context-form" noValidate onSubmit={handleCreateOfficeContext} className="space-y-4">
            <ValidationSummary
              ref={officeContextSummaryRef}
              errors={officeContextFieldErrors}
              labels={{ form: "M&A source", existing_firm_id: "M&A advisory firm", firm_name: "M&A advisory firm", office_name: "Operating office" }}
            />
            <input
              type="hidden"
              name="existing_firm_id"
              value={existingFirmId}
            />
            <p id="office_context_mode_label" className="text-sm font-medium">
              Context type
            </p>
            <RadioGroup
              aria-labelledby="office_context_mode_label"
              value={officeContextMode}
              onValueChange={(value) =>
                setOfficeContextMode(
                  value === "existing_firm" ? "existing_firm" : "new_firm",
                )
              }
              disabled={isCreatingOffice}
              className="gap-2"
            >
              <label
                htmlFor="new_firm_context"
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <RadioGroupItem
                  id="new_firm_context"
                  value="new_firm"
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">
                    New firm context
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Create a firm, its first office and its first contact.
                  </span>
                </span>
              </label>
              <label
                htmlFor="existing_firm_context"
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <RadioGroupItem
                  id="existing_firm_context"
                  value="existing_firm"
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Existing firm
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Add one real operating office; add contacts separately if
                    needed.
                  </span>
                </span>
              </label>
            </RadioGroup>
            {officeContextMode === "existing_firm" ? (
              <div className="space-y-2">
                <FormFieldLabel htmlFor="existing_firm_id" requirement="required">M&A advisory firm</FormFieldLabel>
                <Select
                  value={existingFirmId || "__no_existing_firm__"}
                  onValueChange={(value) => {
                    setExistingFirmId(
                      value === "__no_existing_firm__" ? "" : value,
                    ); clearOfficeContextFieldError("existing_firm_id")
                  }}
                >
                  <SelectTrigger
                    id="existing_firm_id"
                    {...fieldErrorProps("existing_firm_id", officeContextFieldErrors.existing_firm_id)}
                  >
                    <SelectValue placeholder="Choose an active firm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__no_existing_firm__" disabled>
                        Choose an active firm
                      </SelectItem>
                      {availableFirms.map((firm) => (
                        <SelectItem key={firm.id} value={firm.id}>
                          {firm.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError id="existing_firm_id" message={officeContextFieldErrors.existing_firm_id} />
              </div>
            ) : null}
            {officeContextMode === "new_firm" ? (
              <div className="space-y-2">
                <FormFieldLabel htmlFor="firm_name" requirement="required">M&A advisory firm</FormFieldLabel>
                <Input
                  id="firm_name"
                  name="firm_name"
                  required
                  onChange={() => clearOfficeContextFieldError("firm_name")}
                  {...fieldErrorProps("firm_name", officeContextFieldErrors.firm_name)}
                />
                <FieldError id="firm_name" message={officeContextFieldErrors.firm_name} />
              </div>
            ) : null}
            <div className="space-y-2">
              <FormFieldLabel htmlFor="office_name" requirement={officeContextMode === "existing_firm" ? "required" : "optional"}>
                Operating office
              </FormFieldLabel>
              <Input
                id="office_name"
                name="office_name"
                required={officeContextMode === "existing_firm"}
                onChange={() => clearOfficeContextFieldError("office_name")}
                {...fieldErrorProps("office_name", officeContextFieldErrors.office_name)}
                placeholder={
                  officeContextMode === "existing_firm"
                    ? "Example: Paris"
                    : "Leave empty when the actual office is not known yet"
                }
              />
              {officeContextMode === "new_firm" ? (
                <p className="text-xs text-muted-foreground">
                  An empty office creates a temporary default office named after
                  the firm.
                </p>
              ) : null}
              <FieldError id="office_name" message={officeContextFieldErrors.office_name} />
            </div>
            {officeContextMode === "new_firm" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="contact_first_name" requirement="conditional" requirementText="One name is required">First name</FormFieldLabel>
                    <Input id="contact_first_name" name="contact_first_name" />
                  </div>
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="contact_last_name" requirement="conditional" requirementText="One name is required">Last name</FormFieldLabel>
                    <Input id="contact_last_name" name="contact_last_name" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="contact_email" requirement="optional">Email</FormFieldLabel>
                    <Input
                      id="contact_email"
                      name="contact_email"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="contact_phone" requirement="optional">Phone</FormFieldLabel>
                    <Input id="contact_phone" name="contact_phone" />
                  </div>
                </div>
                <div className="space-y-2">
                  <FormFieldLabel htmlFor="contact_job_title" requirement="optional">Job title</FormFieldLabel>
                  <Input id="contact_job_title" name="contact_job_title" />
                </div>
              </>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOfficeDialogOpen(false)}
                disabled={isCreatingOffice}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingOffice}>
                {isCreatingOffice ? "Creating..." : "Create staff-only context"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createContactDialogOpen}
        onOpenChange={(open) => {
          if (!isCreatingContact) {
            setCreateContactDialogOpen(open)
            if (!open) {
              setContactMode("new")
              setExistingContactId("")
              setCanonicalContactOptions([])
              setCanonicalContactLookupFailed(false)
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add office contact</DialogTitle>
            <DialogDescription>
              Link an existing canonical person to{" "}
              {selectedOffice?.office_label ?? "this operating office"}, or
              create another named person. This relationship remains staff-only
              until explicitly used in an opportunity.
            </DialogDescription>
          </DialogHeader>
          <form id="office-contact-form" noValidate onSubmit={handleCreateOfficeContact} className="space-y-4">
            <ValidationSummary
              ref={officeContactSummaryRef}
              errors={officeContactFieldErrors}
              labels={{ form: "Office contact", existing_contact_id: "Canonical contact", contact_first_name: "Contact name", contact_email: "Email" }}
            />
            <input type="hidden" name="contact_mode" value={contactMode} />
            <p id="office_contact_mode_label" className="text-sm font-medium">
              Contact type
            </p>
            <RadioGroup
              aria-labelledby="office_contact_mode_label"
              value={contactMode}
              onValueChange={chooseContactMode}
              disabled={isCreatingContact}
              className="gap-2"
            >
              <label
                htmlFor="office_contact_existing_mode"
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <RadioGroupItem
                  id="office_contact_existing_mode"
                  value="existing"
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Use an existing canonical contact
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Add a new office affiliation without creating another person
                    record.
                  </span>
                </span>
              </label>
              <label
                htmlFor="office_contact_new_mode"
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <RadioGroupItem
                  id="office_contact_new_mode"
                  value="new"
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Create a new contact
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Create a named canonical person and this office affiliation.
                  </span>
                </span>
              </label>
            </RadioGroup>

            {contactMode === "existing" ? (
              <div className="space-y-2">
                <input
                  type="hidden"
                  name="existing_contact_id"
                  value={existingContactId}
                />
                <FormFieldLabel htmlFor="existing_contact_id" requirement="required">Canonical contact</FormFieldLabel>
                <Select
                  value={existingContactId || NO_CANONICAL_CONTACT_OPTION_VALUE}
                  onValueChange={(value) => {
                    setExistingContactId(
                      value === NO_CANONICAL_CONTACT_OPTION_VALUE ? "" : value,
                    ); clearOfficeContactFieldError("existing_contact_id")
                  }}
                  disabled={
                    isCreatingContact ||
                    isLoadingCanonicalContacts ||
                    canonicalContactLookupFailed
                  }
                >
                  <SelectTrigger id="existing_contact_id" className="w-full">
                    <SelectValue placeholder="Choose a canonical contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        value={NO_CANONICAL_CONTACT_OPTION_VALUE}
                        disabled
                      >
                        Choose a canonical contact
                      </SelectItem>
                      {affiliateableCanonicalContacts.map((contact) => (
                        <SelectItem
                          key={contact.contact_id}
                          value={contact.contact_id}
                        >
                          {contact.contact_name}
                          {contact.contact_email
                            ? ` · ${contact.contact_email}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {isLoadingCanonicalContacts ? (
                  <p className="text-xs text-muted-foreground">
                    Loading canonical contacts…
                  </p>
                ) : canonicalContactLookupFailed ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-destructive">
                      Canonical contacts could not be loaded.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadCanonicalContactOptions()}
                    >
                      Retry loading contacts
                    </Button>
                  </div>
                ) : affiliateableCanonicalContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No other active canonical contacts are available for this
                    office.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Contacts already affiliated with this office are excluded.
                  </p>
                )}
              </div>
            ) : (
              <>
                  <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="office_contact_first_name" requirement="conditional" requirementText="One name is required">
                      First name
                    </FormFieldLabel>
                    <Input
                      id="office_contact_first_name"
                      name="contact_first_name"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="office_contact_last_name" requirement="conditional" requirementText="One name is required">Last name</FormFieldLabel>
                    <Input
                      id="office_contact_last_name"
                      name="contact_last_name"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="office_contact_email" requirement="optional">Email</FormFieldLabel>
                    <Input
                      id="office_contact_email"
                      name="contact_email"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormFieldLabel htmlFor="office_contact_phone" requirement="optional">Phone</FormFieldLabel>
                    <Input id="office_contact_phone" name="contact_phone" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <FormFieldLabel htmlFor="office_contact_job_title" requirement="optional">Job title</FormFieldLabel>
              <Input id="office_contact_job_title" name="contact_job_title" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateContactDialogOpen(false)}
                disabled={isCreatingContact}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isCreatingContact ||
                  !selectedOffice ||
                  (contactMode === "existing" &&
                    (!existingContactId || isLoadingCanonicalContacts))
                }
              >
                {isCreatingContact ? "Adding..." : "Add office contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
