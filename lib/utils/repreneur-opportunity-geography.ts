/**
 * The repreneur-facing opportunity field is a staff-provided geography label.
 * It can describe an area at any precision, so presentation must preserve it
 * exactly rather than translate it into a more specific region or place.
 */
export function displayRepreneurOpportunityGeography(
  geographyLabel: string | null | undefined,
  language: Language = "en",
) {
  return geographyLabel?.trim()
    ? geographyLabel
    : language === "fr" ? "Zone géographique à confirmer" : "Geography to confirm"
}
import type { Language } from "@/lib/i18n/translations"
