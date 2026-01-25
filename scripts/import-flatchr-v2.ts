/**
 * Flatchr CSV Import Script (v2)
 *
 * Processes Flatchr ATS export CSV and generates SQL INSERT statements
 * for the Re-New Platform database with dual scoring support.
 *
 * Usage:
 *   npx ts-node scripts/import-flatchr-v2.ts path/to/flatchr-export.csv
 *
 * Output:
 *   Generates scripts/flatchr-import-v2-{timestamp}.sql
 *
 * Features:
 * - Deduplicates by email
 * - Sets flatchr_id for tracking
 * - Sets needs_data_completion = true (legacy records need manual v2 data entry)
 * - Maps legacy questionnaire fields
 * - Generates tier1_score from legacy calculation
 *
 * Sprint 7, Task 7.3
 */

import * as fs from 'fs'
import * as path from 'path'

// ========================================
// Types
// ========================================

interface FlatchrRecord {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  linkedin_url?: string
  status?: string
  tier1_score?: number
  tier2_stars?: number
  created_at?: string
  // Legacy questionnaire fields
  q1_employment_status?: string
  q2_years_experience?: string
  q3_industry_sectors?: string[]
  q4_has_ma_experience?: boolean
  q5_team_size?: string
  q6_involved_in_ma?: boolean
  q7_ma_details?: string
  q8_executive_roles?: string[]
  q9_board_experience?: boolean
  q10_journey_stages?: string[]
  q11_target_sectors?: string[]
  q12_has_identified_targets?: boolean
  q13_target_details?: string
  q14_investment_capacity?: string
  q15_funding_status?: string
  q16_network_training?: string[]
  q17_open_to_co_acquisition?: boolean
}

interface RepreneurInsert {
  flatchr_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  linkedin_url: string | null
  lifecycle_status: string
  tier1_score: number | null
  tier2_stars: number | null
  source: string
  created_at: string
  needs_data_completion: boolean
  // Legacy fields
  q1_employment_status: string | null
  q2_years_experience: string | null
  q3_industry_sectors: string[] | null
  q4_has_ma_experience: boolean | null
  q5_team_size: string | null
  q6_involved_in_ma: boolean | null
  q7_ma_details: string | null
  q8_executive_roles: string[] | null
  q9_board_experience: boolean | null
  q10_journey_stages: string[] | null
  q11_target_sectors: string[] | null
  q12_has_identified_targets: boolean | null
  q13_target_details: string | null
  q14_investment_capacity: string | null
  q15_funding_status: string | null
  q16_network_training: string[] | null
  q17_open_to_co_acquisition: boolean | null
  questionnaire_completed_at: string | null
  created_by: string
}

// ========================================
// CSV Parser (simple implementation)
// ========================================

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const records: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const record: Record<string, string> = {}

    headers.forEach((header, idx) => {
      record[header] = values[idx] || ''
    })

    records.push(record)
  }

  return records
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

// ========================================
// Field Mapping from Flatchr CSV to DB
// ========================================

function mapFlatchrToRepreneur(raw: Record<string, string>): RepreneurInsert | null {
  // Skip records without essential fields
  const flatchrId = raw['id'] || raw['ID'] || raw['flatchr_id']
  const firstName = raw['first_name'] || raw['prenom'] || raw['Prénom'] || ''
  const lastName = raw['last_name'] || raw['nom'] || raw['Nom'] || ''
  const email = raw['email'] || raw['Email'] || ''

  if (!flatchrId || !firstName || !lastName) {
    console.warn(`Skipping record: missing essential fields`, raw)
    return null
  }

  // Map lifecycle status
  const rawStatus = raw['status'] || raw['statut'] || 'lead'
  let lifecycleStatus = 'lead'
  if (rawStatus.toLowerCase().includes('qualified') || rawStatus.toLowerCase().includes('qualifié')) {
    lifecycleStatus = 'qualified'
  } else if (rawStatus.toLowerCase().includes('client')) {
    lifecycleStatus = 'client'
  } else if (rawStatus.toLowerCase().includes('reject')) {
    lifecycleStatus = 'rejected'
  }

  // Parse arrays (JSON or comma-separated)
  const parseArray = (value: string | undefined): string[] | null => {
    if (!value) return null
    try {
      // Try JSON first
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      // Fall back to comma-separated
      return value.split(',').map(s => s.trim()).filter(Boolean)
    }
  }

  // Parse boolean
  const parseBool = (value: string | undefined): boolean | null => {
    if (!value) return null
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === 'oui' || lower === 'yes' || lower === '1') return true
    if (lower === 'false' || lower === 'non' || lower === 'no' || lower === '0') return false
    return null
  }

  // Parse number
  const parseNumber = (value: string | undefined): number | null => {
    if (!value) return null
    const num = parseInt(value, 10)
    return isNaN(num) ? null : num
  }

  return {
    flatchr_id: flatchrId,
    first_name: firstName,
    last_name: lastName,
    email: email || `imported-${flatchrId}@placeholder.invalid`,
    phone: raw['phone'] || raw['telephone'] || raw['Téléphone'] || null,
    linkedin_url: raw['linkedin_url'] || raw['linkedin'] || raw['LinkedIn'] || null,
    lifecycle_status: lifecycleStatus,
    tier1_score: parseNumber(raw['tier1_score'] || raw['score']),
    tier2_stars: parseNumber(raw['tier2_stars'] || raw['stars']),
    source: 'flatchr_import',
    created_at: raw['created_at'] || raw['date_creation'] || new Date().toISOString(),
    needs_data_completion: true, // All imports need v2 data completion

    // Legacy questionnaire fields
    q1_employment_status: raw['q1_employment_status'] || raw['statut_emploi'] || null,
    q2_years_experience: raw['q2_years_experience'] || raw['experience'] || null,
    q3_industry_sectors: parseArray(raw['q3_industry_sectors'] || raw['secteurs']),
    q4_has_ma_experience: parseBool(raw['q4_has_ma_experience']),
    q5_team_size: raw['q5_team_size'] || raw['taille_equipe'] || null,
    q6_involved_in_ma: parseBool(raw['q6_involved_in_ma']),
    q7_ma_details: raw['q7_ma_details'] || null,
    q8_executive_roles: parseArray(raw['q8_executive_roles'] || raw['roles_direction']),
    q9_board_experience: parseBool(raw['q9_board_experience']),
    q10_journey_stages: parseArray(raw['q10_journey_stages']),
    q11_target_sectors: parseArray(raw['q11_target_sectors'] || raw['secteurs_cibles']),
    q12_has_identified_targets: parseBool(raw['q12_has_identified_targets']),
    q13_target_details: raw['q13_target_details'] || null,
    q14_investment_capacity: raw['q14_investment_capacity'] || raw['capacite_investissement'] || null,
    q15_funding_status: raw['q15_funding_status'] || null,
    q16_network_training: parseArray(raw['q16_network_training']),
    q17_open_to_co_acquisition: parseBool(raw['q17_open_to_co_acquisition']),
    questionnaire_completed_at: raw['questionnaire_completed_at'] || null,
    created_by: '(SELECT id FROM auth.users LIMIT 1)',
  }
}

// ========================================
// SQL Generation
// ========================================

function escapeSql(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

function arrayToSql(arr: string[] | null): string {
  if (!arr || arr.length === 0) return 'NULL'
  return `'${JSON.stringify(arr)}'::jsonb`
}

function generateInsertSQL(repreneur: RepreneurInsert): string {
  return `INSERT INTO repreneurs (
  flatchr_id, first_name, last_name, email, phone, linkedin_url,
  lifecycle_status, tier1_score, tier2_stars, source, created_at,
  needs_data_completion,
  q1_employment_status, q2_years_experience, q3_industry_sectors,
  q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
  q8_executive_roles, q9_board_experience, q10_journey_stages,
  q11_target_sectors, q12_has_identified_targets, q13_target_details,
  q14_investment_capacity, q15_funding_status, q16_network_training,
  q17_open_to_co_acquisition, questionnaire_completed_at, created_by
) VALUES (
  ${escapeSql(repreneur.flatchr_id)}, ${escapeSql(repreneur.first_name)}, ${escapeSql(repreneur.last_name)},
  ${escapeSql(repreneur.email)}, ${escapeSql(repreneur.phone)}, ${escapeSql(repreneur.linkedin_url)},
  ${escapeSql(repreneur.lifecycle_status)}, ${repreneur.tier1_score ?? 'NULL'}, ${repreneur.tier2_stars ?? 'NULL'},
  ${escapeSql(repreneur.source)}, ${escapeSql(repreneur.created_at)},
  TRUE,
  ${escapeSql(repreneur.q1_employment_status)}, ${escapeSql(repreneur.q2_years_experience)}, ${arrayToSql(repreneur.q3_industry_sectors)},
  ${repreneur.q4_has_ma_experience === null ? 'NULL' : repreneur.q4_has_ma_experience}, ${escapeSql(repreneur.q5_team_size)},
  ${repreneur.q6_involved_in_ma === null ? 'NULL' : repreneur.q6_involved_in_ma}, ${escapeSql(repreneur.q7_ma_details)},
  ${arrayToSql(repreneur.q8_executive_roles)}, ${repreneur.q9_board_experience === null ? 'NULL' : repreneur.q9_board_experience},
  ${arrayToSql(repreneur.q10_journey_stages)},
  ${arrayToSql(repreneur.q11_target_sectors)}, ${repreneur.q12_has_identified_targets === null ? 'NULL' : repreneur.q12_has_identified_targets},
  ${escapeSql(repreneur.q13_target_details)},
  ${escapeSql(repreneur.q14_investment_capacity)}, ${escapeSql(repreneur.q15_funding_status)}, ${arrayToSql(repreneur.q16_network_training)},
  ${repreneur.q17_open_to_co_acquisition === null ? 'NULL' : repreneur.q17_open_to_co_acquisition},
  ${repreneur.questionnaire_completed_at ? escapeSql(repreneur.questionnaire_completed_at) : 'NOW()'},
  ${repreneur.created_by}
) ON CONFLICT (flatchr_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = CASE WHEN repreneurs.email LIKE 'imported-%' THEN EXCLUDED.email ELSE repreneurs.email END,
  phone = COALESCE(EXCLUDED.phone, repreneurs.phone),
  linkedin_url = COALESCE(EXCLUDED.linkedin_url, repreneurs.linkedin_url),
  tier1_score = COALESCE(EXCLUDED.tier1_score, repreneurs.tier1_score),
  tier2_stars = COALESCE(EXCLUDED.tier2_stars, repreneurs.tier2_stars),
  updated_at = NOW();
`
}

// ========================================
// Main
// ========================================

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
Flatchr CSV Import Script (v2)

Usage:
  npx ts-node scripts/import-flatchr-v2.ts <csv-file>

Example:
  npx ts-node scripts/import-flatchr-v2.ts ~/Downloads/flatchr-export.csv

Output:
  Generates scripts/flatchr-import-v2-{timestamp}.sql
`)
    process.exit(0)
  }

  const csvPath = args[0]

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: File not found: ${csvPath}`)
    process.exit(1)
  }

  console.log(`Reading CSV: ${csvPath}`)
  const content = fs.readFileSync(csvPath, 'utf-8')
  const records = parseCSV(content)

  console.log(`Parsed ${records.length} records`)

  // Map and deduplicate
  const repreneurs: RepreneurInsert[] = []
  const seenEmails = new Set<string>()
  const seenIds = new Set<string>()
  let duplicateCount = 0

  for (const raw of records) {
    const repreneur = mapFlatchrToRepreneur(raw)
    if (!repreneur) continue

    // Check for duplicates
    const emailKey = repreneur.email.toLowerCase()
    if (seenEmails.has(emailKey) || seenIds.has(repreneur.flatchr_id)) {
      duplicateCount++
      continue
    }

    seenEmails.add(emailKey)
    seenIds.add(repreneur.flatchr_id)
    repreneurs.push(repreneur)
  }

  console.log(`Unique records: ${repreneurs.length} (${duplicateCount} duplicates removed)`)

  // Generate SQL
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(process.cwd(), 'scripts', `flatchr-import-v2-${timestamp}.sql`)

  const sql = `-- Flatchr Import v2: ${repreneurs.length} unique records (${duplicateCount} duplicates removed)
-- Generated: ${new Date().toISOString()}
-- Source: ${path.basename(csvPath)}
--
-- IMPORTANT: After running this import, also run:
--   scripts/028_migrate_legacy_to_v2.sql
-- to map legacy fields to v2 scoring fields.

BEGIN;

${repreneurs.map(generateInsertSQL).join('\n')}

COMMIT;

-- Post-import: Apply legacy data mapping
-- Run this separately: scripts/028_migrate_legacy_to_v2.sql
`

  fs.writeFileSync(outputPath, sql)
  console.log(`Generated SQL: ${outputPath}`)

  // Summary
  console.log(`
Summary:
  - Total CSV records: ${records.length}
  - Unique records imported: ${repreneurs.length}
  - Duplicates removed: ${duplicateCount}
  - All records have needs_data_completion = true

Next steps:
  1. Review the generated SQL file
  2. Run it on your Supabase database
  3. Run scripts/028_migrate_legacy_to_v2.sql to map legacy fields
`)
}

main()
