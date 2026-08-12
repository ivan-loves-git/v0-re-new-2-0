/** Keeps the W-039/W-099 screen harmless before migration 092 exists. */
export function isFranceGeographyMandatesEnabled() {
  return process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED === "true"
}
