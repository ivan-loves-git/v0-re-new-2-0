"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  normalizeOpportunityRows,
  summarizeOpportunityImport,
  type OpportunityImportRawRow,
  type OpportunityImportResult,
  type OpportunityImportSummary,
} from "@/lib/utils/opportunity-import"

export interface OpportunityImportPreview {
  results: OpportunityImportResult[]
  summary: OpportunityImportSummary
}

export interface OpportunityImportCommitSummary {
  created: number
  skipped: number
  blocked: number
  warnings: number
}

function parseRows(formData: FormData): OpportunityImportRawRow[] {
  const rowsJson = formData.get("rows_json")
  if (typeof rowsJson !== "string" || rowsJson.trim().length === 0) {
    throw new Error("Rows JSON is required")
  }

  const parsed = JSON.parse(rowsJson)
  if (!Array.isArray(parsed)) {
    throw new Error("Rows JSON must be an array")
  }

  return parsed as OpportunityImportRawRow[]
}

export async function previewOpportunityImport(formData: FormData): Promise<OpportunityImportPreview> {
  await requireUser()
  const rows = parseRows(formData)
  const results = normalizeOpportunityRows(rows)

  return {
    results,
    summary: summarizeOpportunityImport(results),
  }
}

export async function commitOpportunityImport(formData: FormData): Promise<OpportunityImportCommitSummary> {
  const user = await requireUser()
  const rows = parseRows(formData)
  const selectedJson = formData.get("approved_indexes")
  const approvedIndexes = new Set(
    typeof selectedJson === "string" && selectedJson
      ? (JSON.parse(selectedJson) as number[])
      : rows.map((_, index) => index)
  )

  const results = normalizeOpportunityRows(rows)
  const approved = results.filter((result) => approvedIndexes.has(result.rowIndex))
  const creatable = approved.filter((result) => result.isValid)
  const blocked = approved.length - creatable.length
  const supabase = createAdminClient()

  if (creatable.length > 0) {
    const { error } = await supabase.from("opportunities").insert(
      creatable.map((result) => ({
        ...result.draft,
        created_by: user.id,
      }))
    )

    if (error) throw new Error(error.message)
  }

  revalidatePath("/opportunities")

  return {
    created: creatable.length,
    skipped: results.length - approved.length,
    blocked,
    warnings: creatable.filter((result) => result.diagnostics.some((diagnostic) => diagnostic.severity === "warning")).length,
  }
}
