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
import { MaOfficeCombobox } from "@/components/opportunities/ma-office-combobox"
import type { MaOfficeIdentity } from "@/lib/ma-office-presentation"
import { createMaOfficeContact } from "@/lib/actions/opportunity-intake"

export function MaOfficeContactAction({
  officeId = "",
  officeLabel,
  offices,
  disabled = false,
}: {
  officeId?: string
  officeLabel?: string
  offices?: readonly MaOfficeIdentity[]
  disabled?: boolean
}) {
  const router = useRouter()
  const [selectedOfficeId, setSelectedOfficeId] = useState(officeId)
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
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

  function save(formData: FormData) {
    setErrors({})
    formData.set("contact_mode", "new")
    startTransition(async () => {
      const result = await createMaOfficeContact(selectedOfficeId, formData)
      if (!result.success) {
        setErrors(result.fieldErrors ?? { form: result.message })
        toast.error("Contact not added", { description: result.message })
        return
      }
      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return
        setOpen(next)
        if (!next) { setErrors({}); setSelectedOfficeId(officeId) }
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add office contact</DialogTitle>
          <DialogDescription>
            Supply at least one name and an email address or phone number. For a person already in Contacts, use Edit details to retain their office history.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(event) => { event.preventDefault(); save(new FormData(event.currentTarget)) }} className="space-y-4">
          {errors.form ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.form}
            </p>
          ) : null}
          {offices ? <div className="space-y-2">
            <Label htmlFor="ma-contact-office">Firm and office (required)</Label>
            <MaOfficeCombobox id="ma-contact-office" offices={offices} value={selectedOfficeId} onValueChange={(value) => { setSelectedOfficeId(value); clearError("office_id") }} />
            {errors.office_id ? <p className="text-sm text-destructive" role="alert">{errors.office_id}</p> : null}
          </div> : <p className="text-sm break-words">Firm and office: {officeLabel}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ma-office-contact-first-name">First name</Label>
              <Input
                id="ma-office-contact-first-name"
                name="contact_first_name"
                aria-invalid={Boolean(errors.contact_first_name)}
                aria-describedby={errors.contact_first_name ? "ma-office-contact-first_name-error" : undefined}
                onChange={() => clearError("contact_first_name")}
              />
              {errors.contact_first_name ? (
                <p id="ma-office-contact-first_name-error" className="text-sm text-destructive" role="alert">
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
                aria-describedby={errors.contact_last_name ? "ma-office-contact-last_name-error" : undefined}
                onChange={() => clearError("contact_last_name")}
              />
              {errors.contact_last_name ? (
                <p id="ma-office-contact-last_name-error" className="text-sm text-destructive" role="alert">
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
                aria-describedby={errors.contact_email ? "ma-office-contact-email-error" : undefined}
                onChange={() => clearError("contact_email")}
              />
              {errors.contact_email ? (
                <p id="ma-office-contact-email-error" className="text-sm text-destructive" role="alert">
                  {errors.contact_email}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ma-office-contact-phone">Phone</Label>
              <Input id="ma-office-contact-phone" name="contact_phone" type="tel" aria-invalid={Boolean(errors.contact_phone)} aria-describedby={errors.contact_phone ? "ma-office-contact-phone-error" : undefined} onChange={() => clearError("contact_phone")} />
              {errors.contact_phone ? <p id="ma-office-contact-phone-error" className="text-sm text-destructive" role="alert">{errors.contact_phone}</p> : null}
            </div>
          </div>
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
