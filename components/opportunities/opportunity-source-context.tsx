"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FieldError,
  FormFieldLabel,
  ValidationSummary,
  fieldErrorProps,
  focusValidationSummary,
} from "@/components/forms/validation-feedback"
import {
  createMaFirmOfficeContext,
  createMaOfficeForExistingFirm,
  createMaOfficeContact,
  listMaCanonicalContactOptions,
} from "@/lib/actions/opportunity-intake"
import {
  type MaCanonicalContactOption,
  type MaOfficeIntakeOffice,
  type OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  resolveOpportunityOfficeChoice,
  selectCreatedOfficeContext,
} from "@/lib/utils/opportunity-created-office-selection"
import {
  existingFirmEligibleOfficeOptions,
  isExistingFirmOfficeSelection,
} from "@/lib/utils/existing-firm-office-selection"

const NO_OFFICE_OPTION_VALUE = "__no_office__"
const NO_CANONICAL_CONTACT_OPTION_VALUE = "__no_canonical_contact__"
const CONTACT_NAME_REQUIREMENT_TEXT = "First or last name required"
type OfficeContactMode = "existing" | "new"
type OfficeContextMode = "new_firm" | "existing_firm"
type ExistingFirmOfficePath = "existing_office" | "new_real_office"

interface OpportunitySourceContextProps {
  opportunity?: OpportunityWithSource
  officeOptions: MaOfficeIntakeOffice[]
  disabled: boolean
  fieldErrors: Record<string, string>
  clearFieldError: (field: string) => void
}

function currentAffiliationIds(opportunity?: OpportunityWithSource) {
  return (opportunity?.office_contacts ?? [])
    .filter((link) => link.is_active)
    .map((link) => link.affiliation_id)
}

export function OpportunitySourceContext({
  opportunity,
  officeOptions,
  disabled,
  fieldErrors,
  clearFieldError,
}: OpportunitySourceContextProps) {
  const [selectedOfficeId, setSelectedOfficeId] = useState(
    opportunity?.source_office_id ?? "",
  )
  const [createdOfficeOptions, setCreatedOfficeOptions] = useState<
    MaOfficeIntakeOffice[]
  >([])
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
  const [createOfficeDialogOpen, setCreateOfficeDialogOpen] = useState(false)
  const [officeContextMode, setOfficeContextMode] =
    useState<OfficeContextMode>("new_firm")
  const [existingFirmId, setExistingFirmId] = useState("")
  const [existingFirmOfficePath, setExistingFirmOfficePath] =
    useState<ExistingFirmOfficePath>("existing_office")
  const [existingFirmOfficeId, setExistingFirmOfficeId] = useState("")
  const [isCreatingOffice, setIsCreatingOffice] = useState(false)
  const [officeContextFieldErrors, setOfficeContextFieldErrors] = useState<
    Record<string, string>
  >({})
  const officeContextSummaryRef = useRef<HTMLDivElement>(null)
  const [createContactDialogOpen, setCreateContactDialogOpen] = useState(false)
  const [contactMode, setContactMode] = useState<OfficeContactMode>("new")
  const [existingContactId, setExistingContactId] = useState("")
  const [canonicalContactOptions, setCanonicalContactOptions] = useState<
    MaCanonicalContactOption[]
  >([])
  const [isLoadingCanonicalContacts, setIsLoadingCanonicalContacts] =
    useState(false)
  const [canonicalContactLookupFailed, setCanonicalContactLookupFailed] =
    useState(false)
  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [officeContactFieldErrors, setOfficeContactFieldErrors] = useState<
    Record<string, string>
  >({})
  const officeContactSummaryRef = useRef<HTMLDivElement>(null)
  const availableOfficeOptions = useMemo(() => {
    const offices = new Map(
      officeOptions.map((office) => [office.office_id, office]),
    )
    for (const office of createdOfficeOptions)
      offices.set(office.office_id, office)
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
    for (const office of availableOfficeOptions)
      if (office.firm_status === "active")
        firms.set(office.firm_id, {
          id: office.firm_id,
          name: office.firm_name,
        })
    return [...firms.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "fr"),
    )
  }, [availableOfficeOptions])
  const existingFirmOfficeOptions = useMemo(
    () =>
      existingFirmEligibleOfficeOptions(
        existingFirmId,
        availableOfficeOptions,
      ),
    [availableOfficeOptions, existingFirmId],
  )
  const affiliateableCanonicalContacts = useMemo(() => {
    const selectedOfficeContactIds = new Set(
      selectedOffice?.contacts.map((contact) => contact.contact_id) ?? [],
    )
    return canonicalContactOptions.filter(
      (contact) => !selectedOfficeContactIds.has(contact.contact_id),
    )
  }, [canonicalContactOptions, selectedOffice])
  useEffect(() => {
    if (Object.keys(officeContextFieldErrors).length > 0)
      focusValidationSummary(officeContextSummaryRef)
  }, [officeContextFieldErrors])
  useEffect(() => {
    if (Object.keys(officeContactFieldErrors).length > 0)
      focusValidationSummary(officeContactSummaryRef)
  }, [officeContactFieldErrors])
  const clearOfficeContextFieldError = (field: string) =>
    setOfficeContextFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  const clearOfficeContactFieldError = (field: string) =>
    setOfficeContactFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  function chooseOffice(value: string) {
    const nextOfficeId = resolveOpportunityOfficeChoice(
      value,
      NO_OFFICE_OPTION_VALUE,
    )
    if (nextOfficeId === null) return
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
      if (!checked && primaryAffiliationId === affiliationId)
        setPrimaryAffiliationId(next[0] ?? null)
      else if (checked && !primaryAffiliationId)
        setPrimaryAffiliationId(affiliationId)
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
    if (nextMode === "existing") void loadCanonicalContactOptions()
    else {
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

    if (
      officeContextMode === "existing_firm" &&
      existingFirmOfficePath === "existing_office"
    ) {
      if (
        !isExistingFirmOfficeSelection(
          existingFirmOfficeId,
          existingFirmId,
          availableOfficeOptions,
        )
      ) {
        setOfficeContextFieldErrors({
          existing_office_id:
            "Choose an available operating office for this firm.",
        })
        return
      }
      const existingOffice = existingFirmOfficeOptions.find(
        (office) => office.office_id === existingFirmOfficeId,
      )
      if (!existingOffice) {
        setOfficeContextFieldErrors({
          existing_office_id:
            "Choose an available operating office for this firm.",
        })
        return
      }
      setSelectedOfficeId(existingOffice.office_id)
      setSelectedAffiliationIds([])
      setPrimaryAffiliationId(null)
      clearFieldError("source_office_id")
      setCreateOfficeDialogOpen(false)
      setExistingFirmId("")
      setExistingFirmOfficeId("")
      toast.success("Operating office selected.")
      return
    }

    setIsCreatingOffice(true)
    try {
      const result =
        officeContextMode === "existing_firm"
          ? await createMaOfficeForExistingFirm(
              new FormData(event.currentTarget),
            )
          : await createMaFirmOfficeContext(new FormData(event.currentTarget))
      if (!result.success || !result.office) {
        setOfficeContextFieldErrors(
          result.fieldErrors ?? { form: result.message },
        )
        toast.error("M&A source not created", { description: result.message })
        return
      }
      const office = result.office
      const selection = selectCreatedOfficeContext(office, officeContextMode)
      setCreatedOfficeOptions((current) => [
        ...current.filter((item) => item.office_id !== office.office_id),
        office,
      ])
      setSelectedOfficeId(selection.selectedOfficeId)
      setSelectedAffiliationIds(selection.affiliationIds)
      setPrimaryAffiliationId(selection.primaryAffiliationId)
      setCreateOfficeDialogOpen(false)
      setExistingFirmId("")
      setExistingFirmOfficeId("")
      toast.success(result.message)
    } catch (error) {
      setOfficeContextFieldErrors({
        form: "The M&A source could not be created. Try again.",
      })
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
        const resultErrors = result.fieldErrors
        setOfficeContactFieldErrors(
          resultErrors
            ? {
                form: resultErrors.form,
                existing_contact_id: resultErrors.existing_contact_id,
                office_contact_first_name: resultErrors.contact_first_name,
                office_contact_last_name: resultErrors.contact_last_name,
                office_contact_email: resultErrors.contact_email,
              }
            : { form: result.message },
        )
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
      setOfficeContactFieldErrors({
        form: "The office contact could not be added. Try again.",
      })
      toast.error(
        error instanceof Error
          ? error.message
          : "The office contact could not be added.",
      )
    } finally {
      setIsCreatingContact(false)
    }
  }
  return (
    <>
      <input type="hidden" name="source_office_id" value={selectedOfficeId} />
      <section className="space-y-4 rounded-lg border bg-muted/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Staff-only M&A source</h3>
            <p className="text-sm text-muted-foreground">
              The operating office is the source anchor. Contacts are selectable
              only when they have an active affiliation with that office.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateOfficeDialogOpen(true)}
            disabled={disabled}
          >
            Add firm context
          </Button>
        </div>
        <div className="space-y-2">
          <FormFieldLabel
            htmlFor="source_office"
            requirement="conditional"
            requirementText="Required to activate or pause"
          >
            Operating office
          </FormFieldLabel>
          <Select
            value={selectedOfficeId || NO_OFFICE_OPTION_VALUE}
            onValueChange={chooseOffice}
            disabled={disabled}
          >
            <SelectTrigger
              id="source_office"
              {...fieldErrorProps(
                "source_office",
                fieldErrors.source_office_id,
              )}
            >
              <SelectValue placeholder="Choose an operating office" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_OFFICE_OPTION_VALUE}>
                  No office yet (draft only)
                </SelectItem>
                {availableOfficeOptions.map((office) => (
                  <SelectItem key={office.office_id} value={office.office_id}>
                    {office.office_label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError
            id="source_office"
            message={fieldErrors.source_office_id}
          />
          {selectedOffice ? (
            <p className="text-xs text-muted-foreground">
              Firm: {selectedOffice.firm_name} · Office:{" "}
              {selectedOffice.office_name}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              A staff-only draft may be created before the office is known.
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
                  Select the office-affiliated people involved, then choose one
                  primary recipient. Active and paused opportunities require
                  both.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openCreateContactDialog}
                disabled={disabled}
              >
                Add office contact
              </Button>
            </div>
            {selectedOffice.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This office has no active affiliated contacts yet. Keep the
                opportunity as a draft until the source record is completed.
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
                          disabled={disabled}
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
                            primaryAffiliationId === contact.affiliation_id
                          }
                          disabled={!isLinked || disabled}
                          onChange={() =>
                            setPrimaryAffiliationId(contact.affiliation_id)
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
              <FieldError
                id="office-contacts"
                message={fieldErrors.affiliation_ids}
              />
              <FieldError
                id="office-contacts-primary"
                message={fieldErrors.primary_affiliation_id}
              />
            </div>
          </div>
        ) : null}
      </section>
      <Dialog
        open={createOfficeDialogOpen}
        onOpenChange={(open) => {
          if (!isCreatingOffice) {
            setCreateOfficeDialogOpen(open)
            if (!open) {
              setOfficeContextFieldErrors({})
              setOfficeContextMode("new_firm")
              setExistingFirmId("")
              setExistingFirmOfficePath("existing_office")
              setExistingFirmOfficeId("")
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
          <form
            id="office-context-form"
            noValidate
            onSubmit={handleCreateOfficeContext}
            className="space-y-4"
          >
            <ValidationSummary
              ref={officeContextSummaryRef}
              errors={officeContextFieldErrors}
              labels={{
                form: "M&A source",
                existing_firm_id: "M&A advisory firm",
                existing_office_id: "Operating office",
                firm_name: "M&A advisory firm",
                office_name: "Operating office",
                contact_first_name: "Contact first name",
                contact_last_name: "Contact last name",
                contact_email: "Contact email",
              }}
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
                {
                  setOfficeContextMode(
                    value === "existing_firm" ? "existing_firm" : "new_firm",
                  )
                  setExistingFirmOfficePath("existing_office")
                  setExistingFirmOfficeId("")
                }
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
                    Use a known office, or add one real operating office.
                  </span>
                </span>
              </label>
            </RadioGroup>
            {officeContextMode === "existing_firm" ? (
              <div className="space-y-2">
                <FormFieldLabel
                  htmlFor="existing_firm_id"
                  requirement="required"
                >
                  M&A advisory firm
                </FormFieldLabel>
                <Select
                  value={existingFirmId || "__no_existing_firm__"}
                  onValueChange={(value) => {
                    setExistingFirmId(
                      value === "__no_existing_firm__" ? "" : value,
                    )
                    setExistingFirmOfficeId("")
                    clearOfficeContextFieldError("existing_firm_id")
                    clearOfficeContextFieldError("existing_office_id")
                  }}
                >
                  <SelectTrigger
                    id="existing_firm_id"
                    {...fieldErrorProps(
                      "existing_firm_id",
                      officeContextFieldErrors.existing_firm_id,
                    )}
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
                <FieldError
                  id="existing_firm_id"
                  message={officeContextFieldErrors.existing_firm_id}
                />
                {existingFirmId ? (
                  <>
                    <p
                      id="existing_firm_office_path_label"
                      className="pt-2 text-sm font-medium"
                    >
                      Operating office path
                    </p>
                    <RadioGroup
                      aria-labelledby="existing_firm_office_path_label"
                      value={existingFirmOfficePath}
                      onValueChange={(value) => {
                        setExistingFirmOfficePath(
                          value === "new_real_office"
                            ? "new_real_office"
                            : "existing_office",
                        )
                        setExistingFirmOfficeId("")
                        clearOfficeContextFieldError("existing_office_id")
                        clearOfficeContextFieldError("office_name")
                      }}
                      disabled={isCreatingOffice}
                      className="gap-2"
                    >
                      <label
                        htmlFor="use_existing_firm_office"
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="use_existing_firm_office"
                          value="existing_office"
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            Use an existing operating office
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Select one canonical office. This creates no firm,
                            office or contact.
                          </span>
                        </span>
                      </label>
                      <label
                        htmlFor="add_existing_firm_office"
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                      >
                        <RadioGroupItem
                          id="add_existing_firm_office"
                          value="new_real_office"
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            Add a new real operating office
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Uses the audited office-creation service and its
                            duplicate guard.
                          </span>
                        </span>
                      </label>
                    </RadioGroup>
                    {existingFirmOfficePath === "existing_office" ? (
                      <div className="space-y-2">
                        <FormFieldLabel
                          htmlFor="existing_office_id"
                          requirement="required"
                        >
                          Existing operating office
                        </FormFieldLabel>
                        <Select
                          value={
                            existingFirmOfficeId || "__no_existing_office__"
                          }
                          onValueChange={(value) => {
                            setExistingFirmOfficeId(
                              value === "__no_existing_office__" ? "" : value,
                            )
                            clearOfficeContextFieldError("existing_office_id")
                          }}
                          disabled={isCreatingOffice}
                        >
                          <SelectTrigger
                            id="existing_office_id"
                            {...fieldErrorProps(
                              "existing_office_id",
                              officeContextFieldErrors.existing_office_id,
                            )}
                          >
                            <SelectValue placeholder="Choose this firm's operating office" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem
                                value="__no_existing_office__"
                                disabled
                              >
                                Choose this firm's operating office
                              </SelectItem>
                              {existingFirmOfficeOptions.map((office) => (
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
                        <FieldError
                          id="existing_office_id"
                          message={officeContextFieldErrors.existing_office_id}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <FormFieldLabel htmlFor="firm_name" requirement="required">
                  M&A advisory firm
                </FormFieldLabel>
                <Input
                  id="firm_name"
                  name="firm_name"
                  required
                  onChange={() => clearOfficeContextFieldError("firm_name")}
                  {...fieldErrorProps(
                    "firm_name",
                    officeContextFieldErrors.firm_name,
                  )}
                />
                <FieldError
                  id="firm_name"
                  message={officeContextFieldErrors.firm_name}
                />
              </div>
            )}
            {officeContextMode !== "existing_firm" ||
            existingFirmOfficePath === "new_real_office" ? (
            <div className="space-y-2">
              <FormFieldLabel
                htmlFor="office_name"
                requirement={
                  officeContextMode === "existing_firm"
                    ? "required"
                    : "optional"
                }
              >
                Operating office
              </FormFieldLabel>
              <Input
                id="office_name"
                name="office_name"
                required={officeContextMode === "existing_firm"}
                onChange={() => clearOfficeContextFieldError("office_name")}
                {...fieldErrorProps(
                  "office_name",
                  officeContextFieldErrors.office_name,
                )}
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
              <FieldError
                id="office_name"
                message={officeContextFieldErrors.office_name}
              />
            </div>
            ) : null}
            {officeContextMode === "new_firm" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabeledInput
                    id="contact_first_name"
                    name="contact_first_name"
                    label="First name"
                    requirement="conditional"
                    requirementText={CONTACT_NAME_REQUIREMENT_TEXT}
                    errors={officeContextFieldErrors}
                    onChange={() => {
                      clearOfficeContextFieldError("contact_first_name")
                      clearOfficeContextFieldError("contact_last_name")
                    }}
                  />
                  <LabeledInput
                    id="contact_last_name"
                    name="contact_last_name"
                    label="Last name"
                    requirement="conditional"
                    requirementText={CONTACT_NAME_REQUIREMENT_TEXT}
                    errors={officeContextFieldErrors}
                    onChange={() => {
                      clearOfficeContextFieldError("contact_first_name")
                      clearOfficeContextFieldError("contact_last_name")
                    }}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabeledInput
                    id="contact_email"
                    name="contact_email"
                    label="Email"
                    type="email"
                    errors={officeContextFieldErrors}
                    onChange={() =>
                      clearOfficeContextFieldError("contact_email")
                    }
                  />
                  <LabeledInput
                    id="contact_phone"
                    name="contact_phone"
                    label="Phone"
                    errors={officeContextFieldErrors}
                  />
                </div>
                <LabeledInput
                  id="contact_job_title"
                  name="contact_job_title"
                  label="Job title"
                  errors={officeContextFieldErrors}
                />
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
                {isCreatingOffice
                  ? "Creating..."
                  : officeContextMode === "existing_firm" &&
                      existingFirmOfficePath === "existing_office"
                    ? "Use operating office"
                    : "Create staff-only context"}
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
          <form
            id="office-contact-form"
            noValidate
            onSubmit={handleCreateOfficeContact}
            className="space-y-4"
          >
            <ValidationSummary
              ref={officeContactSummaryRef}
              errors={officeContactFieldErrors}
              labels={{
                form: "Office contact",
                existing_contact_id: "Canonical contact",
                office_contact_first_name: "Contact first name",
                office_contact_last_name: "Contact last name",
                office_contact_email: "Email",
              }}
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
                <FormFieldLabel
                  htmlFor="existing_contact_id"
                  requirement="required"
                >
                  Canonical contact
                </FormFieldLabel>
                <Select
                  value={existingContactId || NO_CANONICAL_CONTACT_OPTION_VALUE}
                  onValueChange={(value) => {
                    setExistingContactId(
                      value === NO_CANONICAL_CONTACT_OPTION_VALUE ? "" : value,
                    )
                    clearOfficeContactFieldError("existing_contact_id")
                  }}
                  disabled={
                    isCreatingContact ||
                    isLoadingCanonicalContacts ||
                    canonicalContactLookupFailed
                  }
                >
                  <SelectTrigger
                    id="existing_contact_id"
                    className="w-full"
                    {...fieldErrorProps(
                      "existing_contact_id",
                      officeContactFieldErrors.existing_contact_id,
                    )}
                  >
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
                <FieldError
                  id="existing_contact_id"
                  message={officeContactFieldErrors.existing_contact_id}
                />
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
                  <LabeledInput
                    id="office_contact_first_name"
                    name="contact_first_name"
                    label="First name"
                    requirement="conditional"
                    requirementText={CONTACT_NAME_REQUIREMENT_TEXT}
                    errorKey="office_contact_first_name"
                    errors={officeContactFieldErrors}
                    onChange={() => {
                      clearOfficeContactFieldError("contact_first_name")
                      clearOfficeContactFieldError("contact_last_name")
                      clearOfficeContactFieldError("office_contact_first_name")
                      clearOfficeContactFieldError("office_contact_last_name")
                    }}
                  />
                  <LabeledInput
                    id="office_contact_last_name"
                    name="contact_last_name"
                    label="Last name"
                    requirement="conditional"
                    requirementText={CONTACT_NAME_REQUIREMENT_TEXT}
                    errorKey="office_contact_last_name"
                    errors={officeContactFieldErrors}
                    onChange={() => {
                      clearOfficeContactFieldError("contact_first_name")
                      clearOfficeContactFieldError("contact_last_name")
                      clearOfficeContactFieldError("office_contact_first_name")
                      clearOfficeContactFieldError("office_contact_last_name")
                    }}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabeledInput
                    id="office_contact_email"
                    name="contact_email"
                    label="Email"
                    type="email"
                    errorKey="office_contact_email"
                    errors={officeContactFieldErrors}
                    onChange={() => {
                      clearOfficeContactFieldError("contact_email")
                      clearOfficeContactFieldError("office_contact_email")
                    }}
                  />
                  <LabeledInput
                    id="office_contact_phone"
                    name="contact_phone"
                    label="Phone"
                    errors={officeContactFieldErrors}
                  />
                </div>
              </>
            )}
            <LabeledInput
              id="office_contact_job_title"
              name="contact_job_title"
              label="Job title"
              errors={officeContactFieldErrors}
            />
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

function LabeledInput({
  id,
  name,
  label,
  errors,
  errorKey = name,
  type,
  onChange,
  requirement = "optional",
  requirementText,
}: {
  id: string
  name: string
  label: string
  errors: Record<string, string>
  errorKey?: string
  type?: string
  onChange?: () => void
  requirement?: "optional" | "required" | "conditional"
  requirementText?: string
}) {
  return (
    <div className="space-y-2">
      <FormFieldLabel
        htmlFor={id}
        requirement={requirement}
        requirementText={requirementText}
      >
        {label}
      </FormFieldLabel>
      <Input
        id={id}
        name={name}
        type={type}
        {...fieldErrorProps(id, errors[errorKey])}
        onChange={onChange}
      />
      <FieldError id={id} message={errors[errorKey]} />
    </div>
  )
}
