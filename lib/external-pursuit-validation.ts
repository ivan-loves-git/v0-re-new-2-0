import type { ExternalPursuitInput } from "@/lib/types/external-pursuit"

type ValidatedFields = Pick<ExternalPursuitInput,
  "dueAt" | "revenueMeur" | "ebitdaKeur" | "headcount" | "externalUrl">

function validOptionalDate(value: string | null | undefined) {
  if (value === undefined || value === null) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validOptionalMetric(value: number | null | undefined) {
  return value === undefined || value === null || (Number.isFinite(value) && value >= 0)
}

function validOptionalExternalUrl(value: string | null | undefined) {
  if (value === undefined || value === null || value.trim() === "") return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** Keep selected-staff and ordinary owner/staff writes on the same field boundary. */
export function validateExternalPursuitFields(input: ValidatedFields): string | null {
  if (!validOptionalDate(input.dueAt)) return "Due date must use a valid YYYY-MM-DD date."
  if (![input.revenueMeur, input.ebitdaKeur, input.headcount].every(validOptionalMetric)) return "External metrics must be zero or greater."
  if (input.headcount !== undefined && input.headcount !== null && !Number.isInteger(input.headcount)) return "Headcount must be a whole number."
  if (!validOptionalExternalUrl(input.externalUrl)) return "External URL must start with http:// or https://."
  return null
}
