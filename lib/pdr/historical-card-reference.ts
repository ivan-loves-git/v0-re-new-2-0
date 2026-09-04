import type { PdrHistoricalWorkCard } from "@/lib/pdr/intake-server"

const LEGACY_WORK_CARD_REFERENCE = /^W-([1-9]\d{0,5})$/

/**
 * Accept only the stable, public-shaped legacy reference. This parser is
 * deliberately narrower than the former PDR UI: it is not a card search
 * endpoint and never accepts UUIDs, titles, or arbitrary query text.
 */
export function parseHistoricalWorkCardReference(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null
  const match = LEGACY_WORK_CARD_REFERENCE.exec(value)
  if (!match) return null
  const referenceNumber = Number(match[1])
  return Number.isSafeInteger(referenceNumber) ? referenceNumber : null
}

/** Resolves only against an already-authorized, server-side history read. */
export function resolveHistoricalWorkCardReference(
  referenceNumber: number | null,
  cards: readonly Pick<PdrHistoricalWorkCard, "id" | "referenceNumber">[],
) {
  if (referenceNumber === null) return null
  return cards.find((card) => card.referenceNumber === referenceNumber) ?? null
}
