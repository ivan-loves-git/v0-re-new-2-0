"use client"

import { useRef, useState, useTransition } from "react"
import { CheckCircle2, ExternalLink, FileText, Loader2, Pencil, Upload, UsersRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import {
  canonicalTargetThesisValues,
  legacyTargetThesisValues,
} from "@/lib/repreneur-target-thesis"
import {
  certifyMyProfileContribution,
  updateMyTargetThesis,
  type ProfileContribution,
  type TargetThesisInput,
} from "@/lib/actions/repreneur-profile"

export type TargetThesisProfile = {
  id: string
  q12_geo_zones?: string[]
  q13_target_sectors_v2?: string[]
  q14_deal_size?: string[]
  q16_equity?: string | null
  target_location?: string[]
  sector_preferences?: string[]
  target_acquisition_size?: string | null
  investment_capacity?: string | null
  target_revenue_min_meur?: number | null
  target_revenue_max_meur?: number | null
  target_ebitda_margin_min_pct?: number | null
  target_staff_size_min?: number | null
  target_staff_size_max?: number | null
}

export type ProfileContributionsProfile = {
  id: string
  ldc_url?: string | null
  ldc_self_certified_at?: string | null
  advisory_team_self_certified_at?: string | null
  ms_ldc_validated?: boolean
  ms_advisory_team?: boolean
  ms_advisory_team_identified?: boolean
}

type Draft = Omit<TargetThesisInput, "target_revenue_min_meur" | "target_revenue_max_meur" | "target_ebitda_margin_min_pct" | "target_staff_size_min" | "target_staff_size_max"> & {
  target_revenue_min_meur: string
  target_revenue_max_meur: string
  target_ebitda_margin_min_pct: string
  target_staff_size_min: string
  target_staff_size_max: string
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function optionalNumber(value: string) {
  const trimmed = value.trim()
  return trimmed === "" ? null : Number(trimmed)
}

function initialDraft(repreneur: TargetThesisProfile): Draft {
  const geoZones = arrayValue(repreneur.q12_geo_zones)
  const sectors = arrayValue(repreneur.q13_target_sectors_v2)
  const dealSizes = arrayValue(repreneur.q14_deal_size)

  return {
    q12_geo_zones: canonicalTargetThesisValues(
      geoZones.length > 0 ? geoZones : arrayValue(repreneur.target_location),
      WHEN_QUESTIONS.q12.options,
      "geography",
    ),
    q13_target_sectors_v2: canonicalTargetThesisValues(
      sectors.length > 0 ? sectors : arrayValue(repreneur.sector_preferences),
      WHEN_QUESTIONS.q13.options,
      "sector",
    ),
    q14_deal_size: canonicalTargetThesisValues(
      dealSizes.length > 0 ? dealSizes : (repreneur.target_acquisition_size ? [repreneur.target_acquisition_size] : []),
      WHEN_QUESTIONS.q14.options,
    ),
    q16_equity: canonicalTargetThesisValues(
      [repreneur.q16_equity ?? repreneur.investment_capacity ?? ""],
      WHEN_QUESTIONS.q16.options,
    )[0] ?? "",
    target_revenue_min_meur: repreneur.target_revenue_min_meur?.toString() ?? "",
    target_revenue_max_meur: repreneur.target_revenue_max_meur?.toString() ?? "",
    target_ebitda_margin_min_pct: repreneur.target_ebitda_margin_min_pct?.toString() ?? "",
    target_staff_size_min: repreneur.target_staff_size_min?.toString() ?? "",
    target_staff_size_max: repreneur.target_staff_size_max?.toString() ?? "",
  }
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function SelectionGroup({
  id,
  label,
  values,
  options,
  legacyValues,
  onChange,
}: {
  id: string
  label: string
  values: string[]
  options: ReadonlyArray<{ value: string; label: string }>
  legacyValues: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <div key={option.value} className="flex min-h-8 items-center gap-2">
            <Checkbox
              id={`${id}-${option.value}`}
              checked={values.includes(option.value)}
              onCheckedChange={() => onChange(toggleValue(values, option.value))}
            />
            <Label htmlFor={`${id}-${option.value}`} className="cursor-pointer text-sm font-normal">
              {option.label}
            </Label>
          </div>
        ))}
        {legacyValues.map((value, index) => (
          <div key={value} className="flex min-h-8 items-center gap-2">
            <Checkbox
              id={`${id}-legacy-${index}`}
              checked
              onCheckedChange={() => onChange(toggleValue(values, value))}
            />
            <Label htmlFor={`${id}-legacy-${index}`} className="cursor-pointer text-sm font-normal">
              {value} (existing selection)
            </Label>
          </div>
        ))}
      </div>
    </fieldset>
  )
}

export function RepreneurTargetThesisEditor({ repreneur }: { repreneur: TargetThesisProfile }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => initialDraft(repreneur))
  const [isPending, startTransition] = useTransition()

  const reset = () => setDraft(initialDraft(repreneur))

  const save = () => {
    startTransition(async () => {
      try {
        await updateMyTargetThesis({
          q12_geo_zones: draft.q12_geo_zones,
          q13_target_sectors_v2: draft.q13_target_sectors_v2,
          q14_deal_size: draft.q14_deal_size,
          q16_equity: draft.q16_equity,
          target_revenue_min_meur: optionalNumber(draft.target_revenue_min_meur),
          target_revenue_max_meur: optionalNumber(draft.target_revenue_max_meur),
          target_ebitda_margin_min_pct: optionalNumber(draft.target_ebitda_margin_min_pct),
          target_staff_size_min: optionalNumber(draft.target_staff_size_min),
          target_staff_size_max: optionalNumber(draft.target_staff_size_max),
        })
        toast.success("Target thesis updated. Your deal matching has been refreshed.")
        setOpen(false)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update your target thesis.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) reset()
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil data-icon="inline-start" />
          Edit thesis
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Update your target thesis</DialogTitle>
          <DialogDescription>
            Keep the criteria Re-New uses to surface relevant opportunities current. Your readiness milestones remain managed by Re-New.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          <SelectionGroup
            id="target-sector"
            label="Sectors"
            values={draft.q13_target_sectors_v2}
            options={WHEN_QUESTIONS.q13.options}
            legacyValues={legacyTargetThesisValues(draft.q13_target_sectors_v2, WHEN_QUESTIONS.q13.options, "sector")}
            onChange={(q13_target_sectors_v2) => setDraft((current) => ({ ...current, q13_target_sectors_v2 }))}
          />
          <SelectionGroup
            id="target-geography"
            label="Geography"
            values={draft.q12_geo_zones}
            options={WHEN_QUESTIONS.q12.options}
            legacyValues={legacyTargetThesisValues(draft.q12_geo_zones, WHEN_QUESTIONS.q12.options, "geography")}
            onChange={(q12_geo_zones) => setDraft((current) => ({ ...current, q12_geo_zones }))}
          />
          <SelectionGroup
            id="target-deal-size"
            label="Deal size"
            values={draft.q14_deal_size}
            options={WHEN_QUESTIONS.q14.options}
            legacyValues={legacyTargetThesisValues(draft.q14_deal_size, WHEN_QUESTIONS.q14.options)}
            onChange={(q14_deal_size) => setDraft((current) => ({ ...current, q14_deal_size }))}
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Investment capacity</legend>
            <RadioGroup
              value={draft.q16_equity}
              onValueChange={(q16_equity) => setDraft((current) => ({ ...current, q16_equity }))}
              className="grid gap-2 sm:grid-cols-2"
            >
              {WHEN_QUESTIONS.q16.options.map((option) => (
                <div key={option.value} className="flex min-h-8 items-center gap-2">
                  <RadioGroupItem value={option.value} id={`target-equity-${option.value}`} />
                  <Label htmlFor={`target-equity-${option.value}`} className="cursor-pointer text-sm font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target-revenue-min">Revenue range, minimum (M€)</Label>
              <Input
                id="target-revenue-min"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.target_revenue_min_meur}
                onChange={(event) => setDraft((current) => ({ ...current, target_revenue_min_meur: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-revenue-max">Revenue range, maximum (M€)</Label>
              <Input
                id="target-revenue-max"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.target_revenue_max_meur}
                onChange={(event) => setDraft((current) => ({ ...current, target_revenue_max_meur: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-ebitda-min">Minimum EBITDA margin (%)</Label>
              <Input
                id="target-ebitda-min"
                type="number"
                min="0"
                max="100"
                step="0.1"
                inputMode="decimal"
                value={draft.target_ebitda_margin_min_pct}
                onChange={(event) => setDraft((current) => ({ ...current, target_ebitda_margin_min_pct: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-staff-min">Staff-size minimum</Label>
              <Input
                id="target-staff-min"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.target_staff_size_min}
                onChange={(event) => setDraft((current) => ({ ...current, target_staff_size_min: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-staff-max">Staff-size maximum</Label>
              <Input
                id="target-staff-max"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.target_staff_size_max}
                onChange={(event) => setDraft((current) => ({ ...current, target_staff_size_max: event.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={isPending}>
            {isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Save target thesis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function dateLabel(value: string | null | undefined) {
  if (!value) return null
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
}

export function RepreneurProfileContributions({ repreneur }: { repreneur: ProfileContributionsProfile }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingContribution, setPendingContribution] = useState<ProfileContribution | null>(null)
  const ldcStaffValidated = Boolean(repreneur.ms_ldc_validated)
  const advisoryStaffValidated = Boolean(repreneur.ms_advisory_team || repreneur.ms_advisory_team_identified)
  const ldcCertificationDate = dateLabel(repreneur.ldc_self_certified_at)
  const advisoryCertificationDate = dateLabel(repreneur.advisory_team_self_certified_at)

  const certify = async (item: ProfileContribution) => {
    setPendingContribution(item)
    try {
      await certifyMyProfileContribution(item)
      toast.success(item === "ldc" ? "Lettre de cadrage certified as current." : "Advisory team declaration recorded.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record your declaration.")
    } finally {
      setPendingContribution(null)
    }
  }

  const uploadLdc = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase()
    if (!extension || !["pdf", "doc", "docx"].includes(extension)) {
      toast.error("Upload a PDF or Word document.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("The document must be smaller than 10 MB.")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("repreneurId", repreneur.id)
      formData.append("documentType", "ldc")
      const response = await fetch("/api/upload-cv", { method: "POST", body: formData })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Could not upload your Lettre de cadrage.")
      }
      toast.success("Lettre de cadrage added and certified as current.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload your Lettre de cadrage.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void uploadLdc(file)
        }}
      />
      <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Lettre de cadrage</p>
            <p className="text-xs text-muted-foreground">
              {ldcStaffValidated
                ? "Validated by Re-New. Changes are managed with the team."
                : repreneur.ldc_url
                  ? ldcCertificationDate
                    ? `Certified as current on ${ldcCertificationDate}.`
                    : "Document added. Certify it when it is current."
                  : "Add your current document when it is ready."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ldcStaffValidated && <Badge variant="outline">Validated by Re-New</Badge>}
          {repreneur.ldc_url && (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/repreneurs/${encodeURIComponent(repreneur.id)}/documents/ldc`} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" />
                View
              </a>
            </Button>
          )}
          {!ldcStaffValidated && !repreneur.ldc_url && (
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
              Add document
            </Button>
          )}
          {!ldcStaffValidated && repreneur.ldc_url && !ldcCertificationDate && (
            <Button size="sm" onClick={() => void certify("ldc")} disabled={pendingContribution !== null}>
              {pendingContribution === "ldc" && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Certify as current
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <UsersRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Advisory team</p>
            <p className="text-xs text-muted-foreground">
              {advisoryStaffValidated
                ? "Validated by Re-New. This readiness item remains managed by the team."
                : advisoryCertificationDate
                  ? `Declared on ${advisoryCertificationDate}. Re-New can review it when needed.`
                  : "Let Re-New know when your legal, accounting, or M&A advisors are in place."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {advisoryStaffValidated && <Badge variant="outline">Validated by Re-New</Badge>}
          {!advisoryCertificationDate && !advisoryStaffValidated && (
            <Button size="sm" onClick={() => void certify("advisory_team")} disabled={pendingContribution !== null}>
              {pendingContribution === "advisory_team" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <CheckCircle2 data-icon="inline-start" />}
              My advisory team is in place
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
