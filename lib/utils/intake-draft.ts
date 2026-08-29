import type { IntakeV2FormData } from "@/lib/types/intake-v2"

export const INTAKE_DRAFT_STORAGE_KEY = "renew:intake-v2:draft"

const DRAFT_VERSION = 1
const MAX_STEP = 6
const UPLOAD_FIELDS = new Set(["cv_url", "q18_investment_thesis_url"])
const INTAKE_FIELDS = new Set<keyof IntakeV2FormData>([
  "first_name",
  "last_name",
  "email",
  "phone",
  "cv_url",
  "linkedin_url",
  "q05_status",
  "q06_experience",
  "q07_leadership",
  "q08_crisis",
  "q09_investment",
  "q10_impact",
  "q11_priority_choice",
  "q11_project_status",
  "q12_geo_zones",
  "q13_target_sectors_v2",
  "q14_deal_size",
  "q15_structure",
  "q16_equity",
  "target_revenue_min_meur",
  "target_revenue_max_meur",
  "target_ebitda_min_keur",
  "target_ebitda_max_keur",
  "target_ebitda_margin_min_pct",
  "target_staff_size_min",
  "target_staff_size_max",
  "q17_current_needs",
  "q18_investment_thesis_url",
  "marketing_consent",
])

type StoredDraft = {
  version: number
  currentStep: number
  data: Partial<IntakeV2FormData>
  requiresCvReattachment: boolean
  discardedThesisAttachment: boolean
}

export type RestoredIntakeDraft = Omit<StoredDraft, "version">

function isSafeValue(value: unknown): value is string | number | boolean | null | string[] {
  return value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
}

function sanitiseData(data: Partial<IntakeV2FormData>): Partial<IntakeV2FormData> {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) =>
      INTAKE_FIELDS.has(key as keyof IntakeV2FormData) &&
      !UPLOAD_FIELDS.has(key) &&
      isSafeValue(value)
    )
  ) as Partial<IntakeV2FormData>
}

export function createIntakeDraft(
  currentStep: number,
  data: Partial<IntakeV2FormData>
): string {
  const draft: StoredDraft = {
    version: DRAFT_VERSION,
    currentStep,
    data: sanitiseData(data),
    requiresCvReattachment: Boolean(data.cv_url),
    discardedThesisAttachment: Boolean(data.q18_investment_thesis_url),
  }

  return JSON.stringify(draft)
}

export function restoreIntakeDraft(raw: string | null): RestoredIntakeDraft | null {
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null

    const draft = parsed as Partial<StoredDraft>
    const currentStep = draft.currentStep
    if (
      draft.version !== DRAFT_VERSION ||
      !Number.isInteger(currentStep) ||
      (currentStep as number) < 1 ||
      (currentStep as number) > MAX_STEP ||
      !draft.data ||
      typeof draft.data !== "object" ||
      Array.isArray(draft.data) ||
      typeof draft.requiresCvReattachment !== "boolean" ||
      typeof draft.discardedThesisAttachment !== "boolean"
    ) {
      return null
    }

    return {
      currentStep: currentStep as number,
      data: sanitiseData(draft.data),
      requiresCvReattachment: draft.requiresCvReattachment,
      discardedThesisAttachment: draft.discardedThesisAttachment,
    }
  } catch {
    return null
  }
}

export function clearIntakeDraft(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(INTAKE_DRAFT_STORAGE_KEY)
}
