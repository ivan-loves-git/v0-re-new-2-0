"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2 } from "lucide-react"
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
import { createMaOfficeForExistingFirm } from "@/lib/actions/opportunity-intake"

export function MaFirmOfficeAction({
  firmId,
  firmName,
  disabled = false,
}: {
  firmId: string
  firmName: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  function save(formData: FormData) {
    setErrors({})
    formData.set("existing_firm_id", firmId)
    startTransition(async () => {
      const result = await createMaOfficeForExistingFirm(formData)
      if (!result.success) {
        setErrors(result.fieldErrors ?? { form: result.message })
        toast.error("Office not added", { description: result.message })
        return
      }
      toast.success("Operating office added")
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
          disabled ? "Only active firms can receive new offices." : undefined
        }
      >
        <Building2 data-icon="inline-start" />
        Add office
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add operating office</DialogTitle>
          <DialogDescription>
            Add a real operating office under {firmName} using the existing
            audited W-082 service. This does not create a contact or move
            relationships.
          </DialogDescription>
        </DialogHeader>
        <form action={save} className="space-y-4">
          {errors.form ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.form}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="ma-firm-office-name">Office name</Label>
            <Input
              id="ma-firm-office-name"
              name="office_name"
              placeholder="Example: Paris"
              aria-invalid={Boolean(errors.office_name)}
              aria-describedby={
                errors.office_name ? "ma-firm-office-name-error" : undefined
              }
              onChange={() => setErrors({})}
            />
            {errors.office_name ? (
              <p
                id="ma-firm-office-name-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.office_name}
              </p>
            ) : null}
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
              {isPending ? "Adding..." : "Add office"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
