"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createMaOfficeContact,
  listMaCanonicalContactOptions,
} from "@/lib/actions/opportunity-intake"
import type { MaCanonicalContactOption } from "@/lib/types/opportunity"

export function MaOfficeContactAction({
  officeId,
  disabled = false,
}: {
  officeId: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [contacts, setContacts] = useState<MaCanonicalContactOption[]>([])
  const [contactId, setContactId] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [contactLoadError, setContactLoadError] = useState(false)
  const [isPending, startTransition] = useTransition()

  function clearError(field: string) {
    setErrors((current) => {
      if (!current[field] && !current.form) return current
      const next = { ...current }
      delete next[field]
      delete next.form
      return next
    })
  }

  async function loadCanonicalContacts() {
    setContactLoadError(false)
    try {
      setContacts(await listMaCanonicalContactOptions())
    } catch {
      setContacts([])
      setContactLoadError(true)
      toast.error("Canonical contacts could not be loaded.")
    }
  }

  function chooseMode(value: string) {
    const next = value === "existing" ? "existing" : "new"
    setMode(next)
    setContactId("")
    setErrors({})
    if (next === "existing" && contacts.length === 0) {
      void loadCanonicalContacts()
    }
  }

  function save(formData: FormData) {
    setErrors({})
    formData.set("contact_mode", mode)
    if (mode === "existing") formData.set("existing_contact_id", contactId)
    startTransition(async () => {
      const result = await createMaOfficeContact(officeId, formData)
      if (!result.success) {
        setErrors(result.fieldErrors ?? { form: result.message })
        toast.error("Contact not added", { description: result.message })
        return
      }
      toast.success("Office contact added")
      setOpen(false)
      setContactId("")
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return
        setOpen(next)
        if (!next) {
          setErrors({})
          setContactLoadError(false)
        }
      }}
    >
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          disabled ? "Archived offices cannot receive contacts." : undefined
        }
      >
        <Plus data-icon="inline-start" />
        Add contact
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add office contact</DialogTitle>
          <DialogDescription>
            Add a new person or affiliate an existing canonical person. WAVE
            rejects an already-active office affiliation.
          </DialogDescription>
        </DialogHeader>
        <form action={save} className="space-y-4">
          {errors.form ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.form}
            </p>
          ) : null}
          <RadioGroup
            value={mode}
            onValueChange={chooseMode}
            className="grid gap-2 sm:grid-cols-2"
            aria-label="Contact type"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="new" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">New person</span>
                <span className="text-xs text-muted-foreground">
                  Create one canonical contact.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="existing" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">
                  Existing person
                </span>
                <span className="text-xs text-muted-foreground">
                  Affiliate without duplicating identity.
                </span>
              </span>
            </label>
          </RadioGroup>
          {mode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="ma-office-existing-contact">
                Canonical contact
              </Label>
              <Select
                value={contactId}
                onValueChange={(value) => {
                  setContactId(value)
                  clearError("existing_contact_id")
                }}
                required
              >
                <SelectTrigger
                  id="ma-office-existing-contact"
                  aria-invalid={Boolean(errors.existing_contact_id)}
                  aria-describedby={
                    errors.existing_contact_id
                      ? "ma-office-existing-contact-error"
                      : undefined
                  }
                >
                  <SelectValue placeholder="Choose a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
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
                </SelectContent>
              </Select>
              {errors.existing_contact_id ? (
                <p
                  id="ma-office-existing-contact-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {errors.existing_contact_id}
                </p>
              ) : null}
              {contactLoadError ? (
                <div className="flex flex-wrap items-center gap-2" role="alert">
                  <p className="text-sm text-destructive">
                    Canonical contacts could not be loaded.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadCanonicalContacts()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ma-office-contact-first-name">First name</Label>
                <Input
                  id="ma-office-contact-first-name"
                  name="contact_first_name"
                  aria-invalid={Boolean(errors.contact_first_name)}
                  onChange={() => clearError("contact_first_name")}
                />
                {errors.contact_first_name ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.contact_first_name}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ma-office-contact-last-name">Last name</Label>
                <Input
                  id="ma-office-contact-last-name"
                  name="contact_last_name"
                  aria-invalid={Boolean(errors.contact_last_name)}
                  onChange={() => clearError("contact_last_name")}
                />
                {errors.contact_last_name ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.contact_last_name}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ma-office-contact-email">Email</Label>
                <Input
                  id="ma-office-contact-email"
                  name="contact_email"
                  type="email"
                  aria-invalid={Boolean(errors.contact_email)}
                  onChange={() => clearError("contact_email")}
                />
                {errors.contact_email ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.contact_email}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ma-office-contact-phone">Phone</Label>
                <Input id="ma-office-contact-phone" name="contact_phone" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ma-office-contact-job-title">Job title</Label>
            <Input id="ma-office-contact-job-title" name="contact_job_title" />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || (mode === "existing" && !contactId)}
            >
              {isPending ? "Adding..." : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
