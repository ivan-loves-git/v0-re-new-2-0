"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { convertExternalPursuitToOpportunity } from "@/lib/actions/external-pursuit-conversion"
import type { ExternalPursuitConversionPanelProps } from "@/lib/types/external-pursuit-conversion"

/**
 * W-109 intentionally receives only fresh, staff-selected canonical context.
 * Its parent must not pass an External Pursuit title, owner, contact, note or
 * attachment as a form default.
 */
export function ExternalPursuitConversionPanel({
  pursuitId,
  officeOptions,
  geographyOptions,
}: ExternalPursuitConversionPanelProps) {
  const router = useRouter()
  const [publicTitle, setPublicTitle] = useState("")
  const [geographyNodeId, setGeographyNodeId] = useState("")
  const [sourceOfficeId, setSourceOfficeId] = useState("")
  const [primaryAffiliationId, setPrimaryAffiliationId] = useState("")
  const [requestKey, setRequestKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const selectedOffice = useMemo(
    () => officeOptions.find((office) => office.office_id === sourceOfficeId) ?? null,
    [officeOptions, sourceOfficeId],
  )

  async function submit() {
    const stableRequestKey = requestKey ?? crypto.randomUUID()
    setRequestKey(stableRequestKey)
    setSubmitting(true)
    setErrors({})
    const result = await convertExternalPursuitToOpportunity(
      pursuitId,
      { publicTitle, geographyNodeId, sourceOfficeId, primaryAffiliationId },
      stableRequestKey,
    )
    setSubmitting(false)
    if (!result.success) {
      setErrors(result.fieldErrors ?? { form: result.message })
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.push(`/opportunities/${result.opportunityId}`)
    router.refresh()
  }

  return (
    <section className="space-y-5" aria-labelledby="external-conversion-title">
      <div className="space-y-1">
        <h2 id="external-conversion-title" className="text-base font-semibold">Create a Re-New draft</h2>
        <p className="text-sm text-muted-foreground">This is a one-way staff action. WAVE will create a new staff-only Draft with a fresh mandate reference. It will not copy dossier details, create a match, start a pursuit, or change any Gate.</p>
      </div>
      <Alert>
        <AlertTitle>Choose fresh canonical information</AlertTitle>
        <AlertDescription>Use a safe anonymous title, canonical geography, real source office, and one active named contact. The provisional Acme source is not eligible.</AlertDescription>
      </Alert>
      {errors.form ? <p className="text-sm text-destructive" role="alert">{errors.form}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="external-conversion-public-title">Safe public title</Label>
          <Input id="external-conversion-public-title" value={publicTitle} onChange={(event) => setPublicTitle(event.target.value)} aria-invalid={Boolean(errors.publicTitle)} aria-describedby={errors.publicTitle ? "external-conversion-public-title-error" : undefined} placeholder="Regional specialist in…" disabled={submitting} />
          {errors.publicTitle ? <p id="external-conversion-public-title-error" className="text-sm text-destructive" role="alert">{errors.publicTitle}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="external-conversion-geography">Canonical geography</Label>
          <Select value={geographyNodeId} onValueChange={setGeographyNodeId} disabled={submitting}>
            <SelectTrigger id="external-conversion-geography" aria-invalid={Boolean(errors.geographyNodeId)}><SelectValue placeholder="Choose geography" /></SelectTrigger>
            <SelectContent>{["country", "macro_zone", "region"].map((level) => {
              const options = geographyOptions.filter((option) => option.node_level === level)
              return options.length ? <SelectGroup key={level}><SelectLabel className="capitalize">{level.replace("_", " ")}</SelectLabel>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectGroup> : null
            })}</SelectContent>
          </Select>
          {errors.geographyNodeId ? <p className="text-sm text-destructive" role="alert">{errors.geographyNodeId}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="external-conversion-office">Real source office</Label>
          <Select value={sourceOfficeId} onValueChange={(value) => { setSourceOfficeId(value); setPrimaryAffiliationId("") }} disabled={submitting}>
            <SelectTrigger id="external-conversion-office" aria-invalid={Boolean(errors.sourceOfficeId)}><SelectValue placeholder="Choose operating office" /></SelectTrigger>
            <SelectContent>{officeOptions.map((office) => <SelectItem key={office.office_id} value={office.office_id}>{office.office_label}</SelectItem>)}</SelectContent>
          </Select>
          {errors.sourceOfficeId ? <p className="text-sm text-destructive" role="alert">{errors.sourceOfficeId}</p> : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="external-conversion-primary-contact">Primary named contact</Label>
          <Select value={primaryAffiliationId} onValueChange={setPrimaryAffiliationId} disabled={submitting || !selectedOffice}>
            <SelectTrigger id="external-conversion-primary-contact" aria-invalid={Boolean(errors.primaryAffiliationId)}><SelectValue placeholder={selectedOffice ? "Choose contact" : "Choose office first"} /></SelectTrigger>
            <SelectContent>{selectedOffice?.contacts.map((contact) => <SelectItem key={contact.affiliation_id} value={contact.affiliation_id}>{contact.contact_name ?? "Unnamed contact"}{contact.job_title ? ` — ${contact.job_title}` : ""}</SelectItem>)}</SelectContent>
          </Select>
          {errors.primaryAffiliationId ? <p className="text-sm text-destructive" role="alert">{errors.primaryAffiliationId}</p> : null}
        </div>
      </div>
      <Button type="button" onClick={submit} disabled={submitting}>{submitting ? "Creating draft…" : "Create staff-only Draft"}</Button>
    </section>
  )
}
