"use server"

import { requirePortalAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import { WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import {
  normalizePortalRepreneurProfile,
  PORTAL_REPRENEUR_PROFILE_SELECT,
  type PortalRepreneurProfile,
} from "@/lib/data/portal-profile"
import { recalculateRepreneurScoresAndMatches } from "@/lib/repreneur-profile-refresh"
import { canonicalTargetThesisValues } from "@/lib/repreneur-target-thesis"
import { createAdminClient } from "@/lib/supabase/admin"

export type TargetThesisInput = {
  q12_geo_zones: string[]
  q13_target_sectors_v2: string[]
  q14_deal_size: string[]
  q16_equity: string
  target_revenue_min_meur: number | null
  target_revenue_max_meur: number | null
  target_ebitda_margin_min_pct: number | null
  target_staff_size_min: number | null
  target_staff_size_max: number | null
}

export type ProfileContribution = "ldc" | "advisory_team"

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function validOptions(
  values: unknown,
  options: ReadonlyArray<{ value: string }>,
  fieldName: string,
  existingValues: string[] = [],
) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${fieldName} needs at least one selection.`)
  }

  const allowed = new Set(options.map((option) => option.value))
  const preservedValues = new Set(existingValues)
  const normalized = [...new Set(values)]
  if (!normalized.every((value): value is string => typeof value === "string" && (allowed.has(value) || preservedValues.has(value)))) {
    throw new Error(`${fieldName} contains an unsupported option.`)
  }
  return normalized
}

function optionalNumber(value: unknown, fieldName: string, maximum: number, integer = false) {
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${fieldName} must be a number between 0 and ${maximum}.`)
  }
  if (integer && !Number.isInteger(value)) {
    throw new Error(`${fieldName} must be a whole number.`)
  }
  return value
}

function validateRange(min: number | null, max: number | null, fieldName: string) {
  if (min !== null && max !== null && min > max) {
    throw new Error(`${fieldName} minimum cannot be greater than its maximum.`)
  }
}

export async function getMyRepreneurProfile(): Promise<PortalRepreneurProfile | null> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) return null

  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select(PORTAL_REPRENEUR_PROFILE_SELECT)
    .eq("id", access.repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return normalizePortalRepreneurProfile(repreneur)
}

/** Updates only the authenticated repreneur's matching thesis. */
export async function updateMyTargetThesis(input: TargetThesisInput) {
  const access = await requirePortalAccess()
  if (!access.repreneurId) throw new Error("No linked repreneur profile")

  const supabase = createAdminClient()
  const { data: currentThesis, error: currentThesisError } = await supabase
    .from("repreneurs")
    .select("q12_geo_zones, q13_target_sectors_v2, q14_deal_size, target_location, sector_preferences, target_acquisition_size")
    .eq("id", access.repreneurId)
    .maybeSingle()

  if (currentThesisError) throw new Error(currentThesisError.message)
  if (!currentThesis) throw new Error("Repreneur profile not found")

  const geoZones = validOptions(
    canonicalTargetThesisValues(input.q12_geo_zones, WHEN_QUESTIONS.q12.options, "geography"),
    WHEN_QUESTIONS.q12.options,
    "Geography",
    canonicalTargetThesisValues(
      arrayValue(currentThesis.q12_geo_zones).length > 0
        ? arrayValue(currentThesis.q12_geo_zones)
        : arrayValue(currentThesis.target_location),
      WHEN_QUESTIONS.q12.options,
      "geography",
    ),
  )
  const sectors = validOptions(
    canonicalTargetThesisValues(input.q13_target_sectors_v2, WHEN_QUESTIONS.q13.options, "sector"),
    WHEN_QUESTIONS.q13.options,
    "Sectors",
    canonicalTargetThesisValues(
      arrayValue(currentThesis.q13_target_sectors_v2).length > 0
        ? arrayValue(currentThesis.q13_target_sectors_v2)
        : arrayValue(currentThesis.sector_preferences),
      WHEN_QUESTIONS.q13.options,
      "sector",
    ),
  )
  const dealSizes = validOptions(
    canonicalTargetThesisValues(input.q14_deal_size, WHEN_QUESTIONS.q14.options),
    WHEN_QUESTIONS.q14.options,
    "Deal size",
    canonicalTargetThesisValues(
      arrayValue(currentThesis.q14_deal_size).length > 0
        ? arrayValue(currentThesis.q14_deal_size)
        : currentThesis.target_acquisition_size ? [currentThesis.target_acquisition_size] : [],
      WHEN_QUESTIONS.q14.options,
    ),
  )
  const [equity] = validOptions(
    canonicalTargetThesisValues([input.q16_equity], WHEN_QUESTIONS.q16.options),
    WHEN_QUESTIONS.q16.options,
    "Investment capacity",
  )

  const revenueMin = optionalNumber(input.target_revenue_min_meur, "Revenue minimum", 100000)
  const revenueMax = optionalNumber(input.target_revenue_max_meur, "Revenue maximum", 100000)
  const ebitdaMarginMin = optionalNumber(input.target_ebitda_margin_min_pct, "Minimum EBITDA margin", 100)
  const staffSizeMin = optionalNumber(input.target_staff_size_min, "Staff-size minimum", 100000, true)
  const staffSizeMax = optionalNumber(input.target_staff_size_max, "Staff-size maximum", 100000, true)
  validateRange(revenueMin, revenueMax, "Revenue range")
  validateRange(staffSizeMin, staffSizeMax, "Staff-size range")

  const { error } = await supabase
    .from("repreneurs")
    .update({
      q12_geo_zones: geoZones,
      q13_target_sectors_v2: sectors,
      q14_deal_size: dealSizes,
      q16_equity: equity,
      sector_preferences: sectors,
      target_location: geoZones,
      target_revenue_min_meur: revenueMin,
      target_revenue_max_meur: revenueMax,
      target_ebitda_margin_min_pct: ebitdaMarginMin,
      target_staff_size_min: staffSizeMin,
      target_staff_size_max: staffSizeMax,
    })
    .eq("id", access.repreneurId)

  if (error) throw new Error(error.message)
  await recalculateRepreneurScoresAndMatches(access.repreneurId)
  revalidatePath("/portal/profile")
}

/** Keeps repreneur declarations separate from staff-owned milestones. */
export async function certifyMyProfileContribution(item: ProfileContribution) {
  const access = await requirePortalAccess()
  if (!access.repreneurId) throw new Error("No linked repreneur profile")

  const supabase = createAdminClient()
  if (item === "ldc") {
    const { data: repreneur, error: loadError } = await supabase
      .from("repreneurs")
      .select("ldc_url")
      .eq("id", access.repreneurId)
      .maybeSingle()

    if (loadError) throw new Error(loadError.message)
    if (!repreneur?.ldc_url) throw new Error("Add your Lettre de cadrage before certifying it.")
  }

  const field = item === "ldc" ? "ldc_self_certified_at" : "advisory_team_self_certified_at"
  const { error } = await supabase
    .from("repreneurs")
    .update({ [field]: new Date().toISOString() })
    .eq("id", access.repreneurId)

  if (error) throw new Error(error.message)
  revalidatePath("/portal/profile")
}
