/**
 * The former browser-side CSV/TSV/JSON opportunity importer is deliberately
 * retired. W-020 introduces an audited, service-role-only cutover staging
 * path; this module remains only as a hard-stop compatibility boundary so an
 * old import surface cannot be wired back in accidentally.
 */

export const OPPORTUNITY_DIRECT_IMPORT_DISABLED =
  "Direct opportunity import is disabled. Use the controlled cutover staging process after explicit production approval."

export function directOpportunityImportDisabled(): never {
  throw new Error(OPPORTUNITY_DIRECT_IMPORT_DISABLED)
}

/** @deprecated Direct delimited parsing is intentionally unavailable. */
export function parseDelimitedOpportunityRows(): never {
  return directOpportunityImportDisabled()
}

/** @deprecated Direct row normalization is intentionally unavailable. */
export function normalizeOpportunityRows(): never {
  return directOpportunityImportDisabled()
}
