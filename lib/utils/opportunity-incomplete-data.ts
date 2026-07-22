import type { OpportunityIncompleteDataField } from "@/lib/types/opportunity"

export function readOpportunityFormString(
  formData: FormData,
  key: string,
): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function readOpportunityNumber(
  formData: FormData,
  key: string,
): number | null {
  const value = readOpportunityFormString(formData, key)
  if (!value) return null
  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/m€|meur|m€/gi, "")
    .replace(/k€|keur|k€/gi, "")
    .replace(/[€]/g, "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function readOpportunityHeadcount(formData: FormData): number | null {
  const value = readOpportunityFormString(formData, "headcount_range")
  if (!value) return null
  const match = value.replace(",", ".").match(/\d+(\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

export function findIncompleteOpportunityDataFields(
  formData: FormData,
): OpportunityIncompleteDataField[] {
  const fields: OpportunityIncompleteDataField[] = []

  if (readOpportunityFormString(formData, "revenue_meur") === null)
    fields.push("revenue_meur")
  if (readOpportunityFormString(formData, "ebitda_keur") === null)
    fields.push("ebitda_keur")
  if (readOpportunityFormString(formData, "headcount_range") === null)
    fields.push("headcount_range")
  if (readOpportunityFormString(formData, "source_firm_name") === null)
    fields.push("source_firm_name")
  const hasSelectedContact = formData
    .getAll("source_contact_ids")
    .some((value) => typeof value === "string" && value.trim().length > 0)
  const hasNewContact = [
    "new_source_contact_name",
    "new_source_contact_email",
    "new_source_contact_phone",
  ].some((key) => readOpportunityFormString(formData, key) !== null)
  if (!hasSelectedContact && !hasNewContact)
    fields.push("source_contact")

  return fields
}

export function isIncompleteOpportunityDataAcknowledged(formData: FormData) {
  return (
    readOpportunityFormString(formData, "acknowledge_incomplete_data") ===
    "true"
  )
}
