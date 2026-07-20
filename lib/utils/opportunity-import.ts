import type { Opportunity_Insert } from "@/lib/types/opportunity"
import { normalizeOpportunitySector } from "@/lib/utils/opportunity-sector"

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
  reference: [
    "Ref. Mandat",
    "Ref Mandat",
    "Reference",
    "Référence",
    "Mandat",
    "reference",
    "ref",
    "ID",
    "Id",
  ],
  source: [
    "Source",
    "source",
    "Cabinet",
    "M&A firm",
    "Intermediaire",
    "Intermédiaire",
  ],
  location: [
    "Localisation",
    "Location",
    "Région",
    "Region",
    "localisation",
    "location",
  ],
  sector: ["Secteur", "Sector", "Activité", "Activity", "secteur", "sector"],
  description: ["Description", "description", "Résumé", "Resume", "Summary"],
  revenue: [
    "CA",
    "CA M€",
    "CA M EUR",
    "CA (M€)",
    "CA (€)",
    "CA EUR",
    "Revenue M€",
    "Revenue (M€)",
    "Revenue",
    "Turnover",
    "Sales",
    "Chiffre d'affaires",
    "Chiffre d'affaires (M€)",
    "Chiffre d'affaires (€)",
    "Chiffre affaires",
    "revenue_meur",
  ],
  ebitda: [
    "EBE",
    "EBE K€",
    "EBE (K€)",
    "EBE K EUR",
    "EBE M€",
    "EBE (M€)",
    "EBE M EUR",
    "EBE retraité",
    "EBITDA K€",
    "EBITDA (K€)",
    "EBITDA K EUR",
    "EBITDA M€",
    "EBITDA (M€)",
    "EBITDA M EUR",
    "EBITDA",
    "Ebitda",
    "EBITDA retraité",
    "ebe_keur",
    "ebitda_keur",
  ],
  headcount: [
    "Effectif",
    "Effectifs",
    "Headcount",
    "Employees",
    "FTE",
    "ETP",
    "Nombre de salariés",
    "Nb salariés",
    "Nb. salariés",
    "Salariés",
    "effectif",
    "headcount",
  ],
  dateAdded: [
    "Date ajout",
    "Date d'ajout",
    "Added",
    "Date Added",
    "date_added",
  ],
} as const

type MoneyUnit = "eur" | "keur" | "meur"
type TargetMoneyUnit = "meur" | "keur"

interface ImportFieldValue {
  value: unknown
  header: string | null
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function getField(
  row: OpportunityImportRawRow,
  aliases: readonly string[],
): ImportFieldValue {
  for (const alias of aliases) {
    if (
      row[alias] !== undefined &&
      row[alias] !== null &&
      String(row[alias]).trim() !== ""
    ) {
      return { value: row[alias], header: alias }
    }
  }

  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  for (const [header, value] of Object.entries(row)) {
    if (
      normalizedAliases.has(normalizeHeader(header)) &&
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return { value, header }
    }
  }

  return { value: null, header: null }
}

function asString(value: unknown) {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseLocalizedNumber(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return null

  const negative =
    /^\s*\(.*\)\s*$/.test(stringValue) || /^\s*[-−–—]/.test(stringValue)
  const numeric = stringValue
    .replace(/[−–—]/g, "-")
    .replace(/[^0-9,.-]/g, "")
    .replace(/-/g, "")

  if (!/\d/.test(numeric)) return null

  const commaCount = (numeric.match(/,/g) ?? []).length
  const dotCount = (numeric.match(/\./g) ?? []).length
  const lastComma = numeric.lastIndexOf(",")
  const lastDot = numeric.lastIndexOf(".")
  let normalized: string

  if (commaCount > 0 && dotCount > 0) {
    const decimalSeparator = lastComma > lastDot ? "," : "."
    const thousandsSeparator = decimalSeparator === "," ? "." : ","
    normalized = numeric
      .split(thousandsSeparator)
      .join("")
      .replace(decimalSeparator, ".")
  } else if (commaCount > 1) {
    normalized = numeric.replace(/,/g, "")
  } else if (dotCount > 1) {
    normalized = numeric.replace(/\./g, "")
  } else {
    normalized = numeric.replace(",", ".")
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}

function inferMoneyUnit(
  value: unknown,
  header: string | null,
): MoneyUnit | null {
  const text = [header, asString(value)]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (/(^|[^a-z])k\s*(€|eur|euros?)|k€|keur|k eur|milliers?/.test(text))
    return "keur"
  if (/(^|[^a-z])m\s*(€|eur|euros?)|m€|meur|m eur|millions?/.test(text))
    return "meur"
  if (/€|(^|[^a-z])eur(os)?([^a-z]|$)/.test(text)) return "eur"

  return null
}

function convertMoneyUnit(
  value: number,
  sourceUnit: MoneyUnit | null,
  targetUnit: TargetMoneyUnit,
) {
  if (!sourceUnit) return value
  if (sourceUnit === targetUnit) return value
  if (sourceUnit === "eur" && targetUnit === "meur") return value / 1_000_000
  if (sourceUnit === "eur" && targetUnit === "keur") return value / 1_000
  if (sourceUnit === "keur" && targetUnit === "meur") return value / 1_000
  if (sourceUnit === "meur" && targetUnit === "keur") return value * 1_000
  return value
}

function asMoneyNumber(field: ImportFieldValue, targetUnit: TargetMoneyUnit) {
  const parsed = parseLocalizedNumber(field.value)
  if (parsed === null) return null
  return convertMoneyUnit(
    parsed,
    inferMoneyUnit(field.value, field.header),
    targetUnit,
  )
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

export function normalizeOpportunityRows(
  rows: OpportunityImportRawRow[],
): OpportunityImportResult[] {
  return rows.map((row, index) => {
    const diagnostics: OpportunityImportDiagnostic[] = []
    const referenceField = getField(row, FIELD_ALIASES.reference)
    const sourceField = getField(row, FIELD_ALIASES.source)
    const sectorField = getField(row, FIELD_ALIASES.sector)
    const locationField = getField(row, FIELD_ALIASES.location)
    const descriptionField = getField(row, FIELD_ALIASES.description)
    const revenueField = getField(row, FIELD_ALIASES.revenue)
    const ebitdaField = getField(row, FIELD_ALIASES.ebitda)
    const headcountField = getField(row, FIELD_ALIASES.headcount)
    const dateAddedField = getField(row, FIELD_ALIASES.dateAdded)

    const reference = asString(referenceField.value)
    const source = asString(sourceField.value)
    const sector = normalizeOpportunitySector(asString(sectorField.value))
    const location = asString(locationField.value)
    const description = asString(descriptionField.value)
    const revenue = asMoneyNumber(revenueField, "meur")
    const ebitda = asMoneyNumber(ebitdaField, "keur")
    const headcountRaw = asString(headcountField.value)
    const headcount = asHeadcountApproximation(headcountRaw)
    const dateAdded = asDate(dateAddedField.value)

    if (!reference) {
      diagnostics.push({
        severity: "blocker",
        field: "reference",
        message: "Missing opportunity reference.",
      })
    }
    if (!sector) {
      diagnostics.push({
        severity: "warning",
        field: "sector",
        message: "Missing sector/activity.",
      })
    }
    if (!location) {
      diagnostics.push({
        severity: "warning",
        field: "location",
        message: "Missing location.",
      })
    }
    if (!description) {
      diagnostics.push({
        severity: "warning",
        field: "description",
        message: "Missing description.",
      })
    }
    if (revenueField.value !== null && revenue === null) {
      diagnostics.push({
        severity: "warning",
        field: "revenue_meur",
        message: "Revenue could not be parsed.",
      })
    }
    if (ebitdaField.value !== null && ebitda === null) {
      diagnostics.push({
        severity: "warning",
        field: "ebitda_keur",
        message: "EBITDA could not be parsed.",
      })
    }
    if (dateAddedField.value !== null && dateAdded === null) {
      diagnostics.push({
        severity: "warning",
        field: "date_added",
        message: "Date could not be parsed.",
      })
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
      isValid: diagnostics.every(
        (diagnostic) => diagnostic.severity !== "blocker",
      ),
    }
  })
}

export function summarizeOpportunityImport(
  results: OpportunityImportResult[],
): OpportunityImportSummary {
  return {
    total: results.length,
    valid: results.filter((result) => result.isValid).length,
    blocked: results.filter((result) => !result.isValid).length,
    warnings: results.filter((result) =>
      result.diagnostics.some(
        (diagnostic) => diagnostic.severity === "warning",
      ),
    ).length,
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

export function parseDelimitedOpportunityRows(
  text: string,
): OpportunityImportRawRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const firstLine = lines[0]
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(";")
      ? ";"
      : ","
  const headers = parseDelimitedLine(firstLine, delimiter)

  return lines.slice(1).map((line) => {
    const cells = parseDelimitedLine(line, delimiter)
    return headers.reduce<OpportunityImportRawRow>((row, header, index) => {
      row[header] = cells[index] ?? ""
      return row
    }, {})
  })
}
