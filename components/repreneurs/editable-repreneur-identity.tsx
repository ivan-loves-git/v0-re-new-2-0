"use client"

import { useRef, useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateRepreneurIdentity } from "@/lib/actions/repreneurs"
import { FieldError, FormFieldLabel, ValidationSummary, fieldErrorProps, focusValidationSummary, type FieldErrors } from "@/components/forms/validation-feedback"

interface EditableRepreneurIdentityProps {
  repreneurId: string
  firstName: string
  lastName: string
}

export function EditableRepreneurIdentity({
  repreneurId,
  firstName,
  lastName,
}: EditableRepreneurIdentityProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [nextFirstName, setNextFirstName] = useState(firstName)
  const [nextLastName, setNextLastName] = useState(lastName)
  const [displayFirstName, setDisplayFirstName] = useState(firstName)
  const [displayLastName, setDisplayLastName] = useState(lastName)
  const [errors, setErrors] = useState<FieldErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)

  async function handleSave() {
    const normalizedFirstName = nextFirstName.trim()
    const normalizedLastName = nextLastName.trim()

    const nextErrors: FieldErrors = {}
    if (!normalizedFirstName) nextErrors["repreneur-first-name"] = "Enter a first name."
    if (!normalizedLastName) nextErrors["repreneur-last-name"] = "Enter a surname."
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      focusValidationSummary(summaryRef)
      return
    }

    setErrors({})
    setIsSaving(true)
    try {
      if (normalizedFirstName !== displayFirstName || normalizedLastName !== displayLastName) {
        await updateRepreneurIdentity(repreneurId, normalizedFirstName, normalizedLastName)
      }
      setDisplayFirstName(normalizedFirstName)
      setDisplayLastName(normalizedLastName)
      setIsEditing(false)
      toast.success("Name updated")
    } catch (error) {
      console.error("Repreneur identity update failed")
      toast.error("Failed to update the name. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancel() {
    setNextFirstName(displayFirstName)
    setNextLastName(displayLastName)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ValidationSummary ref={summaryRef} errors={errors} labels={{ "repreneur-first-name": "First name", "repreneur-last-name": "Surname" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FormFieldLabel htmlFor="repreneur-first-name" requirement="required" className="text-xs text-muted-foreground">
            Name
          </FormFieldLabel>
          <Input
            id="repreneur-first-name"
            name="firstName"
            autoComplete="given-name"
            value={nextFirstName}
            {...fieldErrorProps("repreneur-first-name", errors["repreneur-first-name"])}
            onChange={(event) => { setNextFirstName(event.target.value); setErrors(current => ({ ...current, "repreneur-first-name": "" })) }}
            onKeyDown={(event) => {
              if (event.key === "Escape") handleCancel()
              if (event.key === "Enter") void handleSave()
            }}
          />
          <FieldError id="repreneur-first-name" message={errors["repreneur-first-name"]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FormFieldLabel htmlFor="repreneur-last-name" requirement="required" className="text-xs text-muted-foreground">
            Surname
          </FormFieldLabel>
          <Input
            id="repreneur-last-name"
            name="lastName"
            autoComplete="family-name"
            value={nextLastName}
            {...fieldErrorProps("repreneur-last-name", errors["repreneur-last-name"])}
            onChange={(event) => { setNextLastName(event.target.value); setErrors(current => ({ ...current, "repreneur-last-name": "" })) }}
            onKeyDown={(event) => {
              if (event.key === "Escape") handleCancel()
              if (event.key === "Enter") void handleSave()
            }}
          />
          <FieldError id="repreneur-last-name" message={errors["repreneur-last-name"]} />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={isSaving}>
            <Check data-icon="inline-start" />
            {isSaving ? "Saving…" : "Save name"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group/identity flex min-w-0 items-start gap-2">
      <h1 className="min-w-0 text-2xl font-semibold leading-8 tracking-[-0.025em] text-foreground sm:text-[28px] sm:leading-9">
        <span className="block sm:inline">{displayFirstName}</span>{" "}
        <span className="block sm:inline">{displayLastName}</span>
      </h1>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Edit repreneur name"
        className="mt-0.5 shrink-0 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 group-hover/identity:opacity-100"
        onClick={() => setIsEditing(true)}
      >
        <Pencil />
      </Button>
    </div>
  )
}
