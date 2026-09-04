export type DemoClassificationChoice = "real" | "demo"

export type DemoClassificationLockReason = "matched" | "unavailable" | null

export interface DemoClassificationControlState {
  lockReason: DemoClassificationLockReason
  updatedAt: string | null
  updatedByLabel: string | null
}

interface DemoClassificationWriteError {
  message?: string | null
}

export interface DemoClassificationMutationRow {
  entity_id: string
  is_demo: boolean
  changed: boolean
  changed_at: string | null
  changed_by: string | null
}

export const DEMO_CLASSIFICATION_MATCH_LOCK_MESSAGE =
  "Classification is locked because this record has match history. Keep it as is; a historical correction needs a separately reviewed data-treatment plan."

export function demoClassificationWriteErrorMessage(
  error: DemoClassificationWriteError,
  entityLabel: "opportunity" | "repreneur",
) {
  const message = error.message?.toLowerCase() ?? ""
  if (
    message.includes("ticket_95_classification_locked") ||
    message.includes("w164_matched_opportunity_reclassification_denied") ||
    message.includes("w164_matched_repreneur_reclassification_denied")
  ) {
    return DEMO_CLASSIFICATION_MATCH_LOCK_MESSAGE
  }

  if (message.includes("ticket_95_classification_not_found")) {
    return `This ${entityLabel} no longer exists.`
  }

  return `We could not update this ${entityLabel} classification. Please try again.`
}

export function demoClassificationMutationRow(
  data: unknown,
): DemoClassificationMutationRow | null {
  const candidate = Array.isArray(data) ? data[0] : data
  if (!candidate || typeof candidate !== "object") return null

  const row = candidate as Partial<DemoClassificationMutationRow>
  if (
    typeof row.entity_id !== "string" ||
    typeof row.is_demo !== "boolean" ||
    typeof row.changed !== "boolean"
  ) {
    return null
  }

  return {
    entity_id: row.entity_id,
    is_demo: row.is_demo,
    changed: row.changed,
    changed_at: typeof row.changed_at === "string" ? row.changed_at : null,
    changed_by: typeof row.changed_by === "string" ? row.changed_by : null,
  }
}

export function parseExplicitDemoClassification(value: FormDataEntryValue | null): {
  value: boolean | null
  error: string | null
} {
  if (value === "real") return { value: false, error: null }
  if (value === "demo") return { value: true, error: null }
  return { value: null, error: "Choose REAL or DEMO before creating this record." }
}
