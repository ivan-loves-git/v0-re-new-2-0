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
import { createMaOfficeContact } from "@/lib/actions/opportunity-intake"

export function MaOfficeContactAction({
  officeId,
  disabled = false,
}: {
  officeId: string
  disabled?: boolean
}) {
  const router = useRouter()
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
      const result = await createMaOfficeContact(officeId, formData)
      if (!result.success) {
        setErrors(result.fieldErrors ?? { form: result.message })
        toast.error("Contact not added", { description: result.message })
        return
      }
      toast.success("Office contact added")
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
        if (!next) setErrors({})
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
            Create a new canonical person at this office. To place an existing
            person here, move them from Contacts so their earlier office remains
            in history.
          </DialogDescription>
        </DialogHeader>
        <form action={save} className="space-y-4">
          {errors.form ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.form}
            </p>
          ) : null}
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
