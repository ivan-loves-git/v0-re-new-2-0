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

export function MaRelationshipCorrectionAction({ target, id, affiliationId, affiliations, fields }: { target: Target; id: string; affiliationId?: string; affiliations?: Array<{ id: string; label: string; jobTitle?: string | null }>; fields: Field[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedAffiliationId, setSelectedAffiliationId] = useState(affiliationId ?? affiliations?.[0]?.id ?? "")
  const [isPending, startTransition] = useTransition()
  const label = target === "firm" ? "firm" : target === "office" ? "office" : "contact"
  function save(formData: FormData) {
    setErrors({})
    startTransition(async () => {
      const result = target === "firm"
        ? await updateMaFirmCorrection(id, formData)
        : target === "office"
          ? await updateMaOfficeCorrection(id, formData)
          : await updateMaContactCorrection(id, selectedAffiliationId, formData)
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
  return <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil data-icon="inline-start" />Edit details</Button>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit {label} details</DialogTitle><DialogDescription>Only the approved relationship fields are editable. This does not move, merge, archive, or disclose any record.</DialogDescription></DialogHeader>
      <form action={save} className="space-y-4">
        {errors.form ? <p className="text-sm text-destructive" role="alert">{errors.form}</p> : null}
        {target === "contact" && affiliations && affiliations.length > 1 ? <div className="space-y-2">
          <Label htmlFor={`${target}-${id}-affiliation`}>Office affiliation for job title</Label>
          <Select value={selectedAffiliationId} onValueChange={setSelectedAffiliationId}>
            <SelectTrigger id={`${target}-${id}-affiliation`}><SelectValue placeholder="Choose an office affiliation" /></SelectTrigger>
            <SelectContent>{affiliations.map((affiliation) => <SelectItem key={affiliation.id} value={affiliation.id}>{affiliation.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Contact details apply to the canonical person. Job title applies only to the selected existing office affiliation.</p>
        </div> : null}
        {fields.map((field) => {
          const selectedAffiliation = affiliations?.find((affiliation) => affiliation.id === selectedAffiliationId)
          const value = field.name === "job_title" && selectedAffiliation ? selectedAffiliation.jobTitle ?? "" : field.value ?? ""
          return <div className="space-y-2" key={`${field.name}-${field.name === "job_title" ? selectedAffiliationId : ""}`}>
          <Label htmlFor={`${target}-${id}-${field.name}`}>{field.label}</Label>
          {field.type === "textarea" ? <Textarea id={`${target}-${id}-${field.name}`} name={field.name} defaultValue={value} rows={4} aria-invalid={Boolean(errors[field.name])} /> : <Input id={`${target}-${id}-${field.name}`} name={field.name} type={field.type ?? "text"} defaultValue={value} aria-invalid={Boolean(errors[field.name])} />}
          {errors[field.name] ? <p className="text-sm text-destructive" role="alert">{errors[field.name]}</p> : null}
        </div>})}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save correction"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
