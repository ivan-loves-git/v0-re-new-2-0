import type { LifecycleStatus } from "@/lib/types/repreneur"

export interface ParsedRepreneur {
  flatchr_id: string
  first_name: string
  last_name: string
  email: string // Will be empty, needs to be filled by Bertrand
  created_at: string
  lifecycle_status: LifecycleStatus
  tier1_score: number
  tier2_stars: number
  // Questionnaire fields
  q1_employment_status: string | null
  q2_years_experience: string | null
  q3_industry_sectors: string[]
  q4_has_ma_experience: boolean | null
  q5_team_size: string | null
  q6_involved_in_ma: boolean | null
  q7_ma_details: string | null
  q8_executive_roles: string[]
  q9_board_experience: boolean | null
  q10_journey_stages: string[]
  q11_target_sectors: string[]
  q12_has_identified_targets: boolean | null
  q13_target_details: string | null
  q14_investment_capacity: string | null
  q15_funding_status: string | null
  q16_network_training: string[]
  q17_open_to_co_acquisition: boolean | null
}

function parseBoolean(value: string): boolean | null {
  if (!value || value.trim() === "") return null
  const lower = value.toLowerCase().trim()
  if (lower === "oui" || lower === "yes" || lower === "true") return true
  if (lower === "non" || lower === "no" || lower === "false") return false
  return null
}

function parseArray(value: string): string[] {
  if (!value || value.trim() === "") return []
  // Split by semicolon (Flatchr uses ; for multi-value)
  return value.split(";").map((s) => s.trim()).filter(Boolean)
}

function parseStars(value: string): number {
  if (!value) return 0
  // Count the star characters
  const starCount = (value.match(/★/g) || []).length
  return starCount
}

function parseName(name: string): { firstName: string; lastName: string } {
  // Names come as "FirstName+LastName" with + as separator
  const parts = name.replace(/\+/g, " ").trim().split(" ")
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" }
  }
  // First part is first name, rest is last name
  const firstName = parts[0]
  const lastName = parts.slice(1).join(" ")
  return { firstName, lastName }
}

function parseNumber(value: string): number {
  if (!value || value.trim() === "") return 0
  // Handle French decimal format (7,5 -> 7.5)
  const normalized = value.replace(",", ".")
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

/**
 * Parse Flatchr TSV data into structured records
 */
export function parseFlatchrData(tsvContent: string): ParsedRepreneur[] {
  const lines = tsvContent.trim().split("\n")
  if (lines.length < 2) {
    throw new Error("No data rows found in import")
  }

  // Find the header row (contains "Identifier" and "Application Date")
  let headerIndex = lines.findIndex((line) =>
    line.includes("Identifier") && line.includes("Application Date")
  )

  if (headerIndex === -1) {
    // Try without header - assume first row is data
    headerIndex = -1
  }

  const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines

  const records: ParsedRepreneur[] = []

  for (const line of dataLines) {
    if (!line.trim()) continue

    const columns = line.split("\t")
    if (columns.length < 20) continue // Skip incomplete rows

    const { firstName, lastName } = parseName(columns[0] || "")
    const identifier = columns[1] || ""
    const applicationDate = columns[2] || new Date().toISOString()

    // Parse star rating from the last column
    const starsStr = columns[columns.length - 1] || ""
    const stars = parseStars(starsStr)

    // Parse total score (second to last column)
    const totalScoreStr = columns[columns.length - 2] || "0"
    const totalScore = parseNumber(totalScoreStr)

    // Determine status based on stars
    const lifecycleStatus: LifecycleStatus = stars > 0 ? "qualified" : "lead"

    const record: ParsedRepreneur = {
      flatchr_id: identifier,
      first_name: firstName,
      last_name: lastName,
      email: "", // Empty - needs to be filled by Bertrand
      created_at: applicationDate,
      lifecycle_status: lifecycleStatus,
      tier1_score: totalScore,
      tier2_stars: stars > 0 ? stars : 0,
      // Questionnaire fields (columns 3-20)
      q1_employment_status: columns[3] || null,
      q2_years_experience: columns[4] || null,
      q3_industry_sectors: parseArray(columns[5] || ""),
      q4_has_ma_experience: parseBoolean(columns[6] || ""),
      q5_team_size: columns[7] || null,
      q6_involved_in_ma: parseBoolean(columns[8] || ""),
      q7_ma_details: columns[9] || null,
      q8_executive_roles: parseArray(columns[10] || ""),
      q9_board_experience: parseBoolean(columns[11] || ""),
      q10_journey_stages: parseArray(columns[12] || ""),
      q11_target_sectors: parseArray(columns[13] || ""),
      q12_has_identified_targets: parseBoolean(columns[14] || ""),
      q13_target_details: columns[15] || null,
      q14_investment_capacity: columns[16] || null,
      q15_funding_status: columns[17] || null,
      q16_network_training: parseArray(columns[18] || ""),
      q17_open_to_co_acquisition: parseBoolean(columns[19] || ""),
    }

    records.push(record)
  }

  return records
}

/**
 * Deduplicate records by flatchr_id, keeping only the highest scoring one
 */
export function deduplicateRecords(records: ParsedRepreneur[]): ParsedRepreneur[] {
  const byId = new Map<string, ParsedRepreneur>()

  for (const record of records) {
    const existing = byId.get(record.flatchr_id)
    if (!existing || record.tier1_score > existing.tier1_score) {
      byId.set(record.flatchr_id, record)
    }
  }

  return Array.from(byId.values())
}
