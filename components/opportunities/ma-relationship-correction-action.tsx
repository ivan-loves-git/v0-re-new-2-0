"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateMaContactCorrection, updateMaFirmCorrection, updateMaOfficeCorrection } from "@/lib/actions/ma-relationship-workspaces"

type Field = { name: string; label: string; value: string | null; type?: "email" | "url" | "textarea" }
type Target = "firm" | "office" | "contact"
type OfficeOption = { id: string; label: string }

export function MaRelationshipCorrectionAction({ target, id, affiliationId = "", currentOfficeId = "", officeOptions, moveBlocked = false, fields }: { target: Target; id: string; affiliationId?: string; currentOfficeId?: string; officeOptions?: OfficeOption[]; moveBlocked?: boolean; fields: Field[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedOfficeId, setSelectedOfficeId] = useState(currentOfficeId)
  const [isPending, startTransition] = useTransition()
  const label = target === "firm" ? "firm" : target === "office" ? "office" : "contact"
  function save(formData: FormData) {
    setErrors({})
    if (target === "contact") formData.set("office_id", selectedOfficeId)
    startTransition(async () => {
      const result = target === "firm"
        ? await updateMaFirmCorrection(id, formData)
        : target === "office"
          ? await updateMaOfficeCorrection(id, formData)
          : await updateMaContactCorrection(id, affiliationId, formData)
      if (!result.success) {
        setErrors(result.fieldErrors ?? { form: result.message })
        toast.error(`Could not save ${label}`, { description: result.message })
        return
      }
      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }
  function changeOpen(next: boolean) {
    if (isPending) return
    setOpen(next)
    if (!next) {
      setErrors({})
      setSelectedOfficeId(currentOfficeId)
    }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil data-icon="inline-start" />Edit details</Button>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit {label} details</DialogTitle><DialogDescription>{target === "contact" ? "Contact details and the current office are corrected together. Moving a person ends the old office relationship but keeps it as history." : "Only the approved relationship fields are editable. This does not move, merge, archive, or disclose any record."}</DialogDescription></DialogHeader>
      <form action={save} className="space-y-4">
        {errors.form ? <p className="text-sm text-destructive" role="alert">{errors.form}</p> : null}
        {target === "contact" && officeOptions?.length ? <div className="space-y-2">
          <Label htmlFor={`${target}-${id}-office`}>Current firm and office</Label>
          <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
            <SelectTrigger id={`${target}-${id}-office`} aria-invalid={Boolean(errors.office_id)}><SelectValue placeholder="Choose a firm and office" /></SelectTrigger>
            <SelectContent>{officeOptions.map((office) => <SelectItem key={office.id} value={office.id} disabled={moveBlocked && office.id !== currentOfficeId}>{office.label}</SelectItem>)}</SelectContent>
          </Select>
          {errors.office_id ? <p className="text-sm text-destructive" role="alert">{errors.office_id}</p> : null}
          <p className="text-xs text-muted-foreground">{moveBlocked ? "This person can still be edited, but cannot move while linked to a current opportunity from this office." : "Changing this office creates a new current relationship and retains the previous one as history."}</p>
        </div> : null}
        {fields.map((field) => <div className="space-y-2" key={field.name}>
          <Label htmlFor={`${target}-${id}-${field.name}`}>{field.label}</Label>
          {field.type === "textarea" ? <Textarea id={`${target}-${id}-${field.name}`} name={field.name} defaultValue={field.value ?? ""} rows={4} aria-invalid={Boolean(errors[field.name])} /> : <Input id={`${target}-${id}-${field.name}`} name={field.name} type={field.type ?? "text"} defaultValue={field.value ?? ""} aria-invalid={Boolean(errors[field.name])} />}
          {errors[field.name] ? <p className="text-sm text-destructive" role="alert">{errors[field.name]}</p> : null}
        </div>)}
        <DialogFooter><Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={isPending}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save correction"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
