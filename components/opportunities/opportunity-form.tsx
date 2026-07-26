"use client"

import { type FormEvent, useMemo, useState } from "react"
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
import { Label } from "@/components/ui/label"
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
  OPPORTUNITY_STATUS_OPTIONS,
  type MaCanonicalContactOption,
  type MaOfficeIntakeOffice,
  type OpportunityActionResult,
  type OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  createMaFirmOfficeContext,
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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
  const [isCreatingOffice, setIsCreatingOffice] = useState(false)
  const [officeContextFieldErrors, setOfficeContextFieldErrors] = useState<
    Record<string, string>
  >({})
  const [createContactDialogOpen, setCreateContactDialogOpen] = useState(false)
  const [isCreatingContact, setIsCreatingContact] = useState(false)
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
  const affiliateableCanonicalContacts = useMemo(() => {
    const selectedOfficeContactIds = new Set(
      selectedOffice?.contacts.map((contact) => contact.contact_id) ?? [],
    )
    return canonicalContactOptions.filter(
      (contact) => !selectedOfficeContactIds.has(contact.contact_id),
    )
  }, [canonicalContactOptions, selectedOffice])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isHistorical) return

    const formData = new FormData(event.currentTarget)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const result = await action(formData)
      if (result?.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        toast.error(result.message)
      } else if (result?.success) {
        toast.success(result.message)
      }
    } catch (error) {
      console.error("Failed to save opportunity:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Opportunity could not be saved.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function errorFor(...fields: string[]) {
    const message = fields.map((field) => fieldErrors[field]).find(Boolean)
    return message ? (
      <p className="text-xs text-destructive">{message}</p>
    ) : null
  }

  function chooseOffice(value: string) {
    const nextOfficeId = value === NO_OFFICE_OPTION_VALUE ? "" : value
    setSelectedOfficeId(nextOfficeId)
    setSelectedAffiliationIds([])
    setPrimaryAffiliationId(null)
  }

  function toggleAffiliation(affiliationId: string, checked: boolean) {
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
    const nextMode: OfficeContactMode = value === "existing" ? "existing" : "new"
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
      const result = await createMaFirmOfficeContext(
        new FormData(event.currentTarget),
      )
      if (!result.success || !result.office) {
        setOfficeContextFieldErrors(result.fieldErrors ?? {})
        toast.error("M&A source not created", { description: result.message })
        return
      }

      const office = result.office
      const firstContact = office.contacts[0]
      if (!firstContact) {
        toast.error("M&A source not created", {
          description:
            "The approved service did not return the first office contact.",
        })
        return
      }

      setCreatedOfficeOptions((current) => [
        ...current.filter((item) => item.office_id !== office.office_id),
        office,
      ])
      setSelectedOfficeId(office.office_id)
      setSelectedAffiliationIds([firstContact.affiliation_id])
      setPrimaryAffiliationId(firstContact.affiliation_id)
      setCreateOfficeDialogOpen(false)
      toast.success(result.message)
    } catch (error) {
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
      <form noValidate onSubmit={handleSubmit} className="mx-auto max-w-5xl">
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
                  <Label htmlFor="reference">Ref. Mandat *</Label>
                  <Input
                    id="reference"
                    name="reference"
                    defaultValue={opportunity?.reference ?? ""}
                    required
                    disabled={isHistorical}
                    aria-invalid={Boolean(fieldErrors.reference)}
                  />
                  {errorFor("reference")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
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
                      onValueChange={setStatus}
                    >
                      <SelectTrigger
                        id="status"
                        aria-invalid={Boolean(fieldErrors.status)}
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
                  {errorFor("status")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sector_choice">Secteur</Label>
                  <Select
                    name="sector_choice"
                    value={sectorChoice}
                    onValueChange={setSectorChoice}
                    disabled={isHistorical}
                  >
                    <SelectTrigger
                      id="sector_choice"
                      className="w-full"
                      aria-invalid={Boolean(fieldErrors.sector_choice)}
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
                  {errorFor("sector_choice")}
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
                      <Label htmlFor="sector_other">Specify sector</Label>
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
                        aria-invalid={Boolean(fieldErrors.sector_other)}
                      />
                      {errorFor("sector_other")}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Localisation</Label>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={opportunity?.location ?? ""}
                    disabled={isHistorical}
                  />
                  {errorFor("location")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_added">Date ajout</Label>
                  <Input
                    id="date_added"
                    name="date_added"
                    type="date"
                    defaultValue={opportunity?.date_added ?? ""}
                    disabled={isHistorical}
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
                    disabled={isHistorical}
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
                    disabled={isHistorical}
                  />
                  {errorFor("ebitda_keur")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headcount_range">Effectif</Label>
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
                  {errorFor("headcount_range")}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  defaultValue={opportunity?.description ?? ""}
                  disabled={isHistorical}
                  aria-invalid={Boolean(fieldErrors.description)}
                />
                {errorFor("description")}
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
                <Label htmlFor="source_office">Operating office</Label>
                <Select
                  value={selectedOfficeId || NO_OFFICE_OPTION_VALUE}
                  onValueChange={chooseOffice}
                  disabled={isHistorical}
                >
                  <SelectTrigger
                    id="source_office"
                    aria-invalid={Boolean(fieldErrors.source_office_id)}
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
                {errorFor("source_office_id")}
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
                  {errorFor("affiliation_ids", "primary_affiliation_id")}
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
                <Label htmlFor="public_title">Public title</Label>
                <Input
                  id="public_title"
                  name="public_title"
                  defaultValue={opportunity?.public_title ?? ""}
                  disabled={isHistorical}
                />
                {errorFor("public_title")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="teaser_summary">Teaser summary</Label>
                <Textarea
                  id="teaser_summary"
                  name="teaser_summary"
                  rows={3}
                  defaultValue={opportunity?.teaser_summary ?? ""}
                  disabled={isHistorical}
                />
                {errorFor("teaser_summary")}
              </div>
            </section>

            <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
              <div className="space-y-2">
                <Label htmlFor="internal_notes">
                  Opportunity internal notes
                </Label>
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
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add M&A firm context</DialogTitle>
            <DialogDescription>
              This creates one staff-only M&A advisory firm, an operating
              office, and its first named contact. It does not publish or
              activate an opportunity.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOfficeContext} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firm_name">M&A advisory firm *</Label>
              <Input
                id="firm_name"
                name="firm_name"
                required
                aria-invalid={Boolean(officeContextFieldErrors.firm_name)}
              />
              {officeContextFieldErrors.firm_name ? (
                <p className="text-xs text-destructive" role="alert">
                  {officeContextFieldErrors.firm_name}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="office_name">Operating office</Label>
              <Input
                id="office_name"
                name="office_name"
                placeholder="Leave empty when the actual office is not known yet"
              />
              <p className="text-xs text-muted-foreground">
                An empty office creates a temporary default office named after
                the firm.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_first_name">First name</Label>
                <Input id="contact_first_name" name="contact_first_name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_last_name">Last name</Label>
                <Input id="contact_last_name" name="contact_last_name" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input id="contact_email" name="contact_email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <Input id="contact_phone" name="contact_phone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_job_title">Job title</Label>
              <Input id="contact_job_title" name="contact_job_title" />
            </div>
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
          <form onSubmit={handleCreateOfficeContact} className="space-y-4">
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
                    Add a new office affiliation without creating another
                    person record.
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
                    Create a named canonical person and this office
                    affiliation.
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
                <Label htmlFor="existing_contact_id">Canonical contact</Label>
                <Select
                  value={
                    existingContactId || NO_CANONICAL_CONTACT_OPTION_VALUE
                  }
                  onValueChange={(value) =>
                    setExistingContactId(
                      value === NO_CANONICAL_CONTACT_OPTION_VALUE ? "" : value,
                    )
                  }
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
                    <Label htmlFor="office_contact_first_name">
                      First name
                    </Label>
                    <Input
                      id="office_contact_first_name"
                      name="contact_first_name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="office_contact_last_name">Last name</Label>
                    <Input
                      id="office_contact_last_name"
                      name="contact_last_name"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="office_contact_email">Email</Label>
                    <Input
                      id="office_contact_email"
                      name="contact_email"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="office_contact_phone">Phone</Label>
                    <Input id="office_contact_phone" name="contact_phone" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="office_contact_job_title">Job title</Label>
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
