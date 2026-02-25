import type { Repreneur } from "@/lib/types/repreneur"

const HEADERS: (keyof Repreneur)[] = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "lifecycle_status",
  "journey_stage",
  "source",
  "who_score",
  "when_score",
  "marketing_consent",
  "created_at",
]

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportRepreneursToCSV(rows: Repreneur[], filename = "repreneurs.csv") {
  const csvRows = [
    HEADERS.join(","),
    ...rows.map((r) => HEADERS.map((h) => escapeCell(r[h])).join(",")),
  ]
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
