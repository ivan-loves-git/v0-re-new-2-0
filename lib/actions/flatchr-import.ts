"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { parseFlatchrData, deduplicateRecords, type ParsedRepreneur } from "@/lib/utils/flatchr-parser"

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

/**
 * Import parsed Flatchr data into Supabase
 */
export async function importFlatchrData(tsvContent: string): Promise<ImportResult> {
  const supabase = await createServerClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  try {
    // Parse and deduplicate
    const allRecords = parseFlatchrData(tsvContent)
    const records = deduplicateRecords(allRecords)

    result.skipped = allRecords.length - records.length

    // Check for existing flatchr_ids to avoid duplicates
    const flatchrIds = records.map((r) => r.flatchr_id).filter(Boolean)
    const { data: existing } = await supabase
      .from("repreneurs")
      .select("flatchr_id")
      .in("flatchr_id", flatchrIds)

    const existingIds = new Set((existing || []).map((r) => r.flatchr_id))

    // Filter out already imported records
    const newRecords = records.filter((r) => !existingIds.has(r.flatchr_id))
    result.skipped += records.length - newRecords.length

    if (newRecords.length === 0) {
      result.success = true
      return result
    }

    // Insert in batches
    const batchSize = 50
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize)

      const insertData = batch.map((record) => ({
        flatchr_id: record.flatchr_id,
        first_name: record.first_name,
        last_name: record.last_name,
        email: record.email || `imported-${record.flatchr_id}@placeholder.invalid`,
        lifecycle_status: record.lifecycle_status,
        tier1_score: record.tier1_score,
        tier2_stars: record.tier2_stars > 0 ? record.tier2_stars : null,
        source: "flatchr_import",
        created_at: record.created_at,
        created_by: user.id,
        // Questionnaire fields
        q1_employment_status: record.q1_employment_status,
        q2_years_experience: record.q2_years_experience,
        q3_industry_sectors: record.q3_industry_sectors,
        q4_has_ma_experience: record.q4_has_ma_experience,
        q5_team_size: record.q5_team_size,
        q6_involved_in_ma: record.q6_involved_in_ma,
        q7_ma_details: record.q7_ma_details,
        q8_executive_roles: record.q8_executive_roles,
        q9_board_experience: record.q9_board_experience,
        q10_journey_stages: record.q10_journey_stages,
        q11_target_sectors: record.q11_target_sectors,
        q12_has_identified_targets: record.q12_has_identified_targets,
        q13_target_details: record.q13_target_details,
        q14_investment_capacity: record.q14_investment_capacity,
        q15_funding_status: record.q15_funding_status,
        q16_network_training: record.q16_network_training,
        q17_open_to_co_acquisition: record.q17_open_to_co_acquisition,
        questionnaire_completed_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from("repreneurs").insert(insertData)

      if (error) {
        result.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`)
      } else {
        result.imported += batch.length
      }
    }

    result.success = result.errors.length === 0

    // Revalidate paths
    revalidatePath("/repreneurs")
    revalidatePath("/pipeline")
    revalidatePath("/")

    return result
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Unknown error")
    return result
  }
}

/**
 * Preview import without actually importing
 */
export async function previewFlatchrImport(tsvContent: string): Promise<{
  total: number
  unique: number
  duplicatesRemoved: number
  sampleRecords: ParsedRepreneur[]
  starDistribution: Record<number, number>
}> {
  const allRecords = parseFlatchrData(tsvContent)
  const uniqueRecords = deduplicateRecords(allRecords)

  // Calculate star distribution
  const starDistribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const record of uniqueRecords) {
    const stars = record.tier2_stars || 0
    starDistribution[stars] = (starDistribution[stars] || 0) + 1
  }

  return {
    total: allRecords.length,
    unique: uniqueRecords.length,
    duplicatesRemoved: allRecords.length - uniqueRecords.length,
    sampleRecords: uniqueRecords.slice(0, 5),
    starDistribution,
  }
}
