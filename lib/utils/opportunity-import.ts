import type { Opportunity_Insert } from "@/lib/types/opportunity"

export type OpportunityImportRawRow = Record<string, unknown>

export type OpportunityImportSeverity = "warning" | "blocker"

export interface OpportunityImportDiagnostic {
  severity: OpportunityImportSeverity
  field: string
  message: string
}

export interface OpportunityImportResult {
  rowIndex: number
  source: OpportunityImportRawRow
  draft: Opportunity_Insert
  diagnostics: OpportunityImportDiagnostic[]
  isValid: boolean
}

export interface OpportunityImportSummary {
  total: number
  valid: number
  blocked: number
  warnings: number
}

const FIELD_ALIASES = {
  reference: ["Ref. Mandat", "Ref Mandat", "Reference", "Référence", "Mandat", "reference", "ref"],
  source: ["Source", "source", "Cabinet", "M&A firm", "Intermediaire", "Intermédiaire"],
  location: ["Localisation", "Location", "Région", "Region", "localisation", "location"],
  sector: ["Secteur", "Sector", "Activité", "Activity", "secteur", "sector"],
  description: ["Description", "description", "Résumé", "Resume", "Summary"],
  revenue: ["CA M€", "CA M EUR", "Revenue M€", "Revenue", "Chiffre d'affaires", "revenue_meur"],
  ebitda: ["EBE K€", "EBITDA K€", "EBITDA", "Ebitda", "ebe_keur", "ebitda_keur"],
  headcount: ["Effectif", "Headcount", "Employees", "effectif", "headcount"],
  dateAdded: ["Date ajout", "Date d'ajout", "Added", "Date Added", "date_added"],
} as const

function getValue(row: OpportunityImportRawRow, aliases: readonly string[]) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return row[alias]
    }
  }
  return null
}

function asString(value: unknown) {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNumber(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return null
  const normalized = stringValue.replace(/\s/g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function asHeadcountApproximation(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return null
  const match = stringValue.replace(",", ".").match(/\d+(\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function asDate(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue

  const date = new Date(stringValue)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }

  const frenchMatch = stringValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (frenchMatch) {
    const [, day, month, year] = frenchMatch
    const fullYear = year.length === 2 ? `20${year}` : year
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  return null
}

export function normalizeOpportunityRows(rows: OpportunityImportRawRow[]): OpportunityImportResult[] {
  return rows.map((row, index) => {
    const diagnostics: OpportunityImportDiagnostic[] = []
    const reference = asString(getValue(row, FIELD_ALIASES.reference))
    const source = asString(getValue(row, FIELD_ALIASES.source))
    const sector = asString(getValue(row, FIELD_ALIASES.sector))
    const location = asString(getValue(row, FIELD_ALIASES.location))
    const description = asString(getValue(row, FIELD_ALIASES.description))
    const revenue = asNumber(getValue(row, FIELD_ALIASES.revenue))
    const ebitda = asNumber(getValue(row, FIELD_ALIASES.ebitda))
    const headcountRaw = asString(getValue(row, FIELD_ALIASES.headcount))
    const headcount = asHeadcountApproximation(headcountRaw)
    const dateAdded = asDate(getValue(row, FIELD_ALIASES.dateAdded))

    if (!reference) {
      diagnostics.push({ severity: "blocker", field: "reference", message: "Missing opportunity reference." })
    }
    if (!sector) {
      diagnostics.push({ severity: "warning", field: "sector", message: "Missing sector/activity." })
    }
    if (!location) {
      diagnostics.push({ severity: "warning", field: "location", message: "Missing location." })
    }
    if (!description) {
      diagnostics.push({ severity: "warning", field: "description", message: "Missing description." })
    }
    if (getValue(row, FIELD_ALIASES.revenue) !== null && revenue === null) {
      diagnostics.push({ severity: "warning", field: "revenue_meur", message: "Revenue could not be parsed." })
    }
    if (getValue(row, FIELD_ALIASES.ebitda) !== null && ebitda === null) {
      diagnostics.push({ severity: "warning", field: "ebitda_keur", message: "EBITDA could not be parsed." })
    }
    if (getValue(row, FIELD_ALIASES.dateAdded) !== null && dateAdded === null) {
      diagnostics.push({ severity: "warning", field: "date_added", message: "Date could not be parsed." })
    }

    const draft: Opportunity_Insert = {
      reference: reference ?? `import-row-${index + 1}`,
      status: "draft",
      source_label: source,
      sector,
      activity: sector,
      location,
      description,
      revenue_meur: revenue,
      ebitda_keur: ebitda,
      headcount,
      headcount_range: headcountRaw,
      date_added: dateAdded,
      repreneur_exposure: "anonymized",
      public_title: sector && location ? `${sector} - ${location}` : sector,
      teaser_summary: description,
      imported_from: "Bertrand Excel review",
      imported_at: new Date().toISOString(),
    }

    return {
      rowIndex: index,
      source: row,
      draft,
      diagnostics,
      isValid: diagnostics.every((diagnostic) => diagnostic.severity !== "blocker"),
    }
  })
}

export function summarizeOpportunityImport(results: OpportunityImportResult[]): OpportunityImportSummary {
  return {
    total: results.length,
    valid: results.filter((result) => result.isValid).length,
    blocked: results.filter((result) => !result.isValid).length,
    warnings: results.filter((result) => result.diagnostics.some((diagnostic) => diagnostic.severity === "warning")).length,
  }
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}

export function parseDelimitedOpportunityRows(text: string): OpportunityImportRawRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const firstLine = lines[0]
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ","
  const headers = parseDelimitedLine(firstLine, delimiter)

  return lines.slice(1).map((line) => {
    const cells = parseDelimitedLine(line, delimiter)
    return headers.reduce<OpportunityImportRawRow>((row, header, index) => {
      row[header] = cells[index] ?? ""
      return row
    }, {})
  })
}
