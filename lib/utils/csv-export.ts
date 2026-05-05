import type { Repreneur } from "@/lib/types/repreneur"

export interface EnrichedRepreneur extends Repreneur {
  interview_count?: number
  /** "Yes" / "No" — set true when at least one interview activity has a future event_date. */
  interview_booked?: string
  offer_names?: string
  offer_status?: string
  decline_reason?: string
  /** YYYY-MM-DD aliases of repreneurs.created_at for funnel analysis. */
  first_contact_at?: string
  /** YYYY-MM-DD — earliest interview activity (event_date, fallback created_at). */
  first_interview_at?: string
  /** YYYY-MM-DD — repreneur_offers.offered_at, ordered chronologically. */
  first_offer_at?: string
  first_offer_status?: string
  /** YYYY-MM-DD — repreneur_offers.accepted_at, blank if not accepted. */
  first_offer_accepted_at?: string
  second_offer_at?: string
  second_offer_status?: string
  second_offer_accepted_at?: string
}

const HEADERS: { key: keyof EnrichedRepreneur; label: string }[] = [
  { key: "first_name", label: "first_name" },
  { key: "last_name", label: "last_name" },
  { key: "email", label: "email" },
  { key: "phone", label: "phone" },
  { key: "lifecycle_status", label: "lifecycle_status" },
  { key: "journey_stage", label: "journey_stage" },
  { key: "source", label: "source" },
  { key: "who_score", label: "who_score" },
  { key: "when_score", label: "when_score" },
  { key: "interview_count", label: "interview_count" },
  { key: "interview_booked", label: "interview_booked" },
  { key: "offer_names", label: "offer_names" },
  { key: "offer_status", label: "offer_status" },
  { key: "decline_reason", label: "decline_reason" },
  { key: "marketing_consent", label: "marketing_consent" },
  { key: "first_contact_at", label: "first_contact_at" },
  { key: "first_interview_at", label: "first_interview_at" },
  { key: "first_offer_at", label: "first_offer_at" },
  { key: "first_offer_status", label: "first_offer_status" },
  { key: "first_offer_accepted_at", label: "first_offer_accepted_at" },
  { key: "second_offer_at", label: "second_offer_at" },
  { key: "second_offer_status", label: "second_offer_status" },
  { key: "second_offer_accepted_at", label: "second_offer_accepted_at" },
  { key: "created_at", label: "created_at" },
]

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportRepreneursToCSV(rows: EnrichedRepreneur[], filename = "repreneurs.csv") {
  const csvRows = [
    HEADERS.map(h => h.label).join(","),
    ...rows.map((r) => HEADERS.map((h) => escapeCell(r[h.key])).join(",")),
  ]
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
