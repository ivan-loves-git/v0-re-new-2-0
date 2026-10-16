import type { MaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

type Contact = MaRelationshipWorkspace["contacts"][number]
type Office = Pick<
  MaRelationshipWorkspace["offices"][number],
  "id" | "firmName" | "officeName"
>

const HEADERS = [
  "first_name",
  "last_name",
  "email",
  "office",
  "firm",
  "email_policy",
  "email_policy_reason",
] as const

function escapeCell(value: string | null | undefined): string {
  if (!value) return ""
  // Prefix formula triggers so spreadsheet apps treat imported names as text.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** One row per canonical contact, using its current (active, else first) affiliation. */
export function buildMaContactsCsv(
  contacts: readonly Contact[],
  offices: readonly Office[],
): string {
  const officeById = new Map(offices.map((office) => [office.id, office]))
  const rows = contacts.map((contact) => {
    const affiliation =
      contact.affiliations.find((item) => item.isActive) ??
      contact.affiliations[0]
    const office = affiliation ? officeById.get(affiliation.officeId) : undefined
    return [
      contact.firstName,
      contact.lastName,
      contact.email,
      office?.officeName,
      office?.firmName,
      contact.campaignEmailSuppressed ? "Blocked" : "Allowed",
      contact.campaignEmailSuppressionReason,
    ]
      .map(escapeCell)
      .join(",")
  })
  return [HEADERS.join(","), ...rows].join("\r\n")
}

export function downloadMaContactsCsv(csv: string, filename: string) {
  // BOM so Excel reads accented names as UTF-8.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
