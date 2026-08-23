"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateMaContactCorrection, updateMaFirmCorrection, updateMaOfficeCorrection } from "@/lib/actions/ma-relationship-workspaces"

type Field = { name: string; label: string; value: string | null; type?: "email" | "url" | "textarea" }
type Target = "firm" | "office" | "contact"

export function MaRelationshipCorrectionAction({ target, id, affiliationId, fields }: { target: Target; id: string; affiliationId?: string; fields: Field[] }) {
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const label = target === "firm" ? "firm" : target === "office" ? "office" : "contact"
  function save(formData: FormData) {
    setErrors({})
    startTransition(async () => {
      const result = target === "firm"
        ? await updateMaFirmCorrection(id, formData)
        : target === "office"
          ? await updateMaOfficeCorrection(id, formData)
          : await updateMaContactCorrection(id, affiliationId ?? "", formData)
      if (!result.success) {
        setErrors(result.fieldErrors ?? { form: result.message })
        toast.error(`Could not save ${label}`, { description: result.message })
        return
      }
      toast.success(result.message)
      setOpen(false)
    })
  }
  return <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil data-icon="inline-start" />Edit details</Button>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit {label} details</DialogTitle><DialogDescription>Only the approved relationship fields are editable. This does not move, merge, archive, or disclose any record.</DialogDescription></DialogHeader>
      <form action={save} className="space-y-4">
        {errors.form ? <p className="text-sm text-destructive" role="alert">{errors.form}</p> : null}
        {fields.map((field) => <div className="space-y-2" key={field.name}>
          <Label htmlFor={`${target}-${id}-${field.name}`}>{field.label}</Label>
          {field.type === "textarea" ? <Textarea id={`${target}-${id}-${field.name}`} name={field.name} defaultValue={field.value ?? ""} rows={4} aria-invalid={Boolean(errors[field.name])} /> : <Input id={`${target}-${id}-${field.name}`} name={field.name} type={field.type ?? "text"} defaultValue={field.value ?? ""} aria-invalid={Boolean(errors[field.name])} />}
          {errors[field.name] ? <p className="text-sm text-destructive" role="alert">{errors[field.name]}</p> : null}
        </div>)}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save correction"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
