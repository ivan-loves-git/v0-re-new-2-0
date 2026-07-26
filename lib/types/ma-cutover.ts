/**
 * Types for the one-time M&A cutover rehearsal.
 *
 * These shapes deliberately model staging and reconciliation only. They are
 * not a browser import contract and they never become a recurring sync API.
 * Temporary source identifiers belong only in staged rows during the eventual
 * controlled cutover; the synthetic fixture below keeps them in memory.
 */

export const MA_CUTOVER_EXCEPTION_CODES = [
  "DUPLICATE_OPPORTUNITY_REFERENCE",
  "FIRM_NAME_REQUIRED",
  "OFFICE_PARENT_MAPPING_UNRESOLVED",
  "OFFICE_NAME_REQUIRED",
  "SYNTHETIC_DEFAULT_NAME_MISMATCH",
  "SYNTHETIC_DEFAULT_REQUIRES_UNKNOWN_OFFICE",
  "CONTACT_OFFICE_MAPPING_UNRESOLVED",
  "PRIMARY_CONTACT_MAPPING_UNRESOLVED",
  "OPPORTUNITY_CONTACTS_REQUIRED",
  "PRIMARY_CONTACT_NOT_SELECTED",
  "OPPORTUNITY_CONTACT_MAPPING_UNRESOLVED",
  "PRIMARY_CONTACT_IDENTITY_REQUIRED",
  "PRIMARY_CONTACT_EMAIL_REQUIRED",
  "PRIMARY_CONTACT_EMAIL_INVALID",
  "OPPORTUNITY_REFERENCE_REQUIRED",
  "OPPORTUNITY_SOURCE_OFFICE_REQUIRED",
  "OPPORTUNITY_DESCRIPTION_REQUIRED",
  "OPPORTUNITY_TARGET_STATUS_INVALID",
  "LOCATION_APPROVAL_VALUE_REQUIRED",
  "GEOGRAPHY_REVIEW_REQUIRED",
  "GEOGRAPHY_RETAINED_NULL",
  "GEOGRAPHY_CONFIRMATION_VALUE_REQUIRED",
  "INVALID_REVENUE_SUPPLIED",
  "INVALID_EBITDA_SUPPLIED",
  "INVALID_HEADCOUNT_SUPPLIED",
  "INVALID_DATE_SUPPLIED",
] as const

export type MaCutoverExceptionCode =
  (typeof MA_CUTOVER_EXCEPTION_CODES)[number]

export type MaCutoverIssueSeverity = "blocker" | "warning"

export type MaCutoverGeographyDecision = "confirmed" | "review" | "null"

export type MaCutoverLocationDecision = "approved" | "review" | "null"

export type MaCutoverTargetStatus = "active" | "paused"

export interface MaCutoverSyntheticFirmRow {
  temporaryId: string
  name: string | null
}

export interface MaCutoverSyntheticOfficeRow {
  temporaryId: string
  firmTemporaryId: string | null
  name: string | null
  /** `true` is the synthetic unknown-office fallback, never a preferred office. */
  isSyntheticDefault?: boolean
}

export interface MaCutoverSyntheticContactRow {
  temporaryId: string
  officeTemporaryIds: string[]
  firstName: string | null
  lastName: string | null
  email: string | null
}

export interface MaCutoverSyntheticOpportunityRow {
  temporaryId: string
  reference: string | null
  sourceOfficeTemporaryId: string | null
  /** Full selected contact set for this opportunity; the primary must be one. */
  contactTemporaryIds: string[]
  primaryContactTemporaryId: string | null
  description: string | null
  targetStatus?: MaCutoverTargetStatus | string | null
  sector?: string | null
  /** Compatibility display field, only written when explicitly approved. */
  activity?: string | null
  location?: string | null
  locationDecision?: MaCutoverLocationDecision | null
  sourceGeographyLabel?: string | null
  geographyDecision?: MaCutoverGeographyDecision | null
  revenueMeur?: unknown
  ebitdaKeur?: unknown
  headcount?: unknown
  headcountRange?: string | null
  dateAdded?: unknown
  publicTitle?: string | null
  teaserSummary?: string | null
  internalNotes?: string | null
}

export interface MaCutoverSyntheticFixture {
  id: string
  sourceFingerprint: string
  firms: MaCutoverSyntheticFirmRow[]
  offices: MaCutoverSyntheticOfficeRow[]
  contacts: MaCutoverSyntheticContactRow[]
  opportunities: MaCutoverSyntheticOpportunityRow[]
}

export interface MaCutoverIssue {
  code: MaCutoverExceptionCode
  severity: MaCutoverIssueSeverity
  rowKey: string
  field: string
  message: string
}

export interface MaCutoverNormalizedOpportunity {
  temporaryId: string
  reference: string | null
  sourceOfficeTemporaryId: string | null
  selectedContactTemporaryIds: string[]
  primaryContactTemporaryId: string | null
  description: string | null
  targetStatus: MaCutoverTargetStatus | null
  sector: string | null
  activity: string | null
  /**
   * Existing `opportunities.location` may be written only when the manifest
   * explicitly approves this text. It is otherwise deliberately null.
   */
  location: string | null
  locationDecision: MaCutoverLocationDecision
  sourceGeographyLabel: string | null
  geographyDecision: MaCutoverGeographyDecision
  revenueMeur: number | null
  ebitdaKeur: number | null
  headcount: number | null
  headcountRange: string | null
  dateAdded: string | null
  publicTitle: string | null
  teaserSummary: string | null
  internalNotes: string | null
}

export interface MaCutoverReconciliationSummary {
  sourceRows: {
    firms: number
    offices: number
    contacts: number
    opportunities: number
  }
  resolvedMappings: {
    officeParents: number
    contactOfficeAffiliations: number
    opportunityContactLinks: number
    primaryContactLinks: number
  }
  opportunityRows: {
    readyForActivation: number
    blocked: number
    duplicateReferences: number
  }
  geography: {
    confirmed: number
    review: number
    retainedNull: number
  }
  normalization: {
    invalidSuppliedRevenue: number
    invalidSuppliedEbitda: number
    invalidSuppliedHeadcount: number
    invalidSuppliedDate: number
  }
  issues: {
    blockers: number
    warnings: number
  }
}

export interface MaCutoverRehearsal {
  fixtureId: string
  sourceFingerprint: string
  normalizedOpportunities: MaCutoverNormalizedOpportunity[]
  issues: MaCutoverIssue[]
  summary: MaCutoverReconciliationSummary
}
