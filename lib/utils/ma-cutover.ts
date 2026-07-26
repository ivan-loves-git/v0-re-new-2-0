import type {
  MaCutoverExceptionCode,
  MaCutoverGeographyDecision,
  MaCutoverIssue,
  MaCutoverLocationDecision,
  MaCutoverNormalizedOpportunity,
  MaCutoverReconciliationSummary,
  MaCutoverRehearsal,
  MaCutoverSyntheticContactRow,
  MaCutoverSyntheticFixture,
  MaCutoverSyntheticOpportunityRow,
  MaCutoverTargetStatus,
} from "@/lib/types/ma-cutover"

const USABLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value: string | null | undefined) {
  const normalized = value?.trim() ?? ""
  return normalized.length > 0 ? normalized : null
}

function stable<T extends { temporaryId: string }>(rows: T[]) {
  return [...rows].sort((left, right) =>
    left.temporaryId.localeCompare(right.temporaryId),
  )
}

function isTargetStatus(value: unknown): value is MaCutoverTargetStatus {
  return value === "active" || value === "paused"
}

function isGeographyDecision(
  value: unknown,
): value is MaCutoverGeographyDecision {
  return value === "confirmed" || value === "review" || value === "null"
}

function isLocationDecision(value: unknown): value is MaCutoverLocationDecision {
  return value === "approved" || value === "review" || value === "null"
}

function parseTargetNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { value: null, wasInvalid: false }
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { value, wasInvalid: false }
      : { value: null, wasInvalid: true }
  }

  const raw = String(value).trim()
  if (!raw) return { value: null, wasInvalid: false }

  // Stage input is already mapped to the target unit. Reject ambiguous or
  // decorated values rather than guessing a unit or a locale convention.
  if (!/^-?\d+(?:[.,]\d+)?$/.test(raw)) {
    return { value: null, wasInvalid: true }
  }

  const parsed = Number(raw.replace(",", "."))
  return Number.isFinite(parsed)
    ? { value: parsed, wasInvalid: false }
    : { value: null, wasInvalid: true }
}

function parseTargetInteger(value: unknown) {
  const parsed = parseTargetNumber(value)
  if (parsed.value === null) return parsed
  if (!Number.isInteger(parsed.value) || parsed.value < 0) {
    return { value: null, wasInvalid: true }
  }
  return parsed
}

function parseTargetDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { value: null, wasInvalid: false }
  }

  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const french = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const match = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : french
      ? {
          year: Number(french[3]),
          month: Number(french[2]),
          day: Number(french[1]),
        }
      : null

  if (!match) return { value: null, wasInvalid: true }

  const parsed = new Date(Date.UTC(match.year, match.month - 1, match.day))
  const isValid =
    parsed.getUTCFullYear() === match.year &&
    parsed.getUTCMonth() === match.month - 1 &&
    parsed.getUTCDate() === match.day

  if (!isValid) return { value: null, wasInvalid: true }

  return {
    value: `${match.year.toString().padStart(4, "0")}-${match.month
      .toString()
      .padStart(2, "0")}-${match.day.toString().padStart(2, "0")}`,
    wasInvalid: false,
  }
}

function addIssue(
  issues: MaCutoverIssue[],
  rowKey: string,
  code: MaCutoverExceptionCode,
  severity: MaCutoverIssue["severity"],
  field: string,
  message: string,
) {
  issues.push({ code, severity, rowKey, field, message })
}

function hasBlocker(issues: MaCutoverIssue[], rowKey: string) {
  return issues.some(
    (issue) => issue.rowKey === rowKey && issue.severity === "blocker",
  )
}

function normaliseOpportunity(
  row: MaCutoverSyntheticOpportunityRow,
  issues: MaCutoverIssue[],
): {
  opportunity: MaCutoverNormalizedOpportunity
  invalidRevenue: boolean
  invalidEbitda: boolean
  invalidHeadcount: boolean
  invalidDate: boolean
} {
  const rowKey = `opportunity:${row.temporaryId}`
  const rawSelectedContactTemporaryIds = (row.contactTemporaryIds ?? [])
    .map((contactId) => text(contactId))
    .filter((contactId): contactId is string => contactId !== null)
  const selectedContactTemporaryIds = [
    ...new Set(rawSelectedContactTemporaryIds),
  ]
  const primaryContactTemporaryId = text(row.primaryContactTemporaryId)
  const targetStatus =
    row.targetStatus === null || row.targetStatus === undefined
      ? "active"
      : isTargetStatus(row.targetStatus)
        ? row.targetStatus
        : null
  const locationDecision = isLocationDecision(row.locationDecision)
    ? row.locationDecision
    : "null"
  const geographyDecision = isGeographyDecision(row.geographyDecision)
    ? row.geographyDecision
    : "null"
  const sourceGeographyLabel = text(row.sourceGeographyLabel)
  const locationInput = text(row.location)
  const location =
    locationDecision === "approved" && locationInput ? locationInput : null
  const sector = text(row.sector)
  const activity = text(row.activity)
  const headcountRange = text(row.headcountRange)
  const publicTitle = text(row.publicTitle)
  const teaserSummary = text(row.teaserSummary)
  const internalNotes = text(row.internalNotes)
  const revenue = parseTargetNumber(row.revenueMeur)
  const ebitda = parseTargetNumber(row.ebitdaKeur)
  const headcount = parseTargetInteger(row.headcount)
  const dateAdded = parseTargetDate(row.dateAdded)

  if (selectedContactTemporaryIds.length === 0) {
    addIssue(
      issues,
      rowKey,
      "OPPORTUNITY_CONTACTS_REQUIRED",
      "blocker",
      "contactTemporaryIds",
      "An opportunity requires at least one selected contact before activation.",
    )
  }
  if (
    primaryContactTemporaryId &&
    !selectedContactTemporaryIds.includes(primaryContactTemporaryId)
  ) {
    addIssue(
      issues,
      rowKey,
      "PRIMARY_CONTACT_NOT_SELECTED",
      "blocker",
      "primaryContactTemporaryId",
      "The primary contact must be included in the opportunity’s selected contact set.",
    )
  }

  if (!text(row.reference)) {
    addIssue(
      issues,
      rowKey,
      "OPPORTUNITY_REFERENCE_REQUIRED",
      "blocker",
      "reference",
      "An opportunity reference is required for one-time activation.",
    )
  }
  if (!targetStatus) {
    addIssue(
      issues,
      rowKey,
      "OPPORTUNITY_TARGET_STATUS_INVALID",
      "blocker",
      "targetStatus",
      "Cutover activation supports active or paused opportunities only.",
    )
  }
  if (locationDecision === "approved" && !locationInput) {
    addIssue(
      issues,
      rowKey,
      "LOCATION_APPROVAL_VALUE_REQUIRED",
      "blocker",
      "location",
      "A location decision cannot be approved without an explicit location value.",
    )
  }
  if (geographyDecision === "confirmed" && !sourceGeographyLabel) {
    addIssue(
      issues,
      rowKey,
      "GEOGRAPHY_CONFIRMATION_VALUE_REQUIRED",
      "blocker",
      "sourceGeographyLabel",
      "A confirmed geography decision requires an explicit source geography label.",
    )
  }
  if (geographyDecision === "review") {
    addIssue(
      issues,
      rowKey,
      "GEOGRAPHY_REVIEW_REQUIRED",
      "warning",
      "sourceGeographyLabel",
      "Geography remains a reviewed staging decision; WAVE does not infer a canonical code.",
    )
  }
  if (geographyDecision === "null" && sourceGeographyLabel) {
    addIssue(
      issues,
      rowKey,
      "GEOGRAPHY_RETAINED_NULL",
      "warning",
      "sourceGeographyLabel",
      "The supplied geography label is deliberately retained as an explicit null decision.",
    )
  }
  if (revenue.wasInvalid) {
    addIssue(
      issues,
      rowKey,
      "INVALID_REVENUE_SUPPLIED",
      "blocker",
      "revenueMeur",
      "A supplied revenue value is invalid and must be corrected before activation.",
    )
  }
  if (ebitda.wasInvalid) {
    addIssue(
      issues,
      rowKey,
      "INVALID_EBITDA_SUPPLIED",
      "blocker",
      "ebitdaKeur",
      "A supplied EBITDA value is invalid and must be corrected before activation.",
    )
  }
  if (headcount.wasInvalid) {
    addIssue(
      issues,
      rowKey,
      "INVALID_HEADCOUNT_SUPPLIED",
      "blocker",
      "headcount",
      "A supplied headcount value is invalid and must be corrected before activation.",
    )
  }
  if (dateAdded.wasInvalid) {
    addIssue(
      issues,
      rowKey,
      "INVALID_DATE_SUPPLIED",
      "blocker",
      "dateAdded",
      "A supplied business date is invalid and must be corrected before activation.",
    )
  }

  return {
    opportunity: {
      temporaryId: row.temporaryId,
      reference: text(row.reference),
      sourceOfficeTemporaryId: text(row.sourceOfficeTemporaryId),
      selectedContactTemporaryIds,
      primaryContactTemporaryId,
      description: text(row.description),
      targetStatus,
      sector,
      activity,
      location,
      locationDecision,
      sourceGeographyLabel,
      geographyDecision,
      revenueMeur: revenue.value,
      ebitdaKeur: ebitda.value,
      headcount: headcount.value,
      headcountRange,
      dateAdded: dateAdded.value,
      publicTitle,
      teaserSummary,
      internalNotes,
    },
    invalidRevenue: revenue.wasInvalid,
    invalidEbitda: ebitda.wasInvalid,
    invalidHeadcount: headcount.wasInvalid,
    invalidDate: dateAdded.wasInvalid,
  }
}

function contactHasOffice(
  contact: MaCutoverSyntheticContactRow | undefined,
  officeTemporaryId: string | null,
) {
  return Boolean(
    contact &&
      officeTemporaryId &&
      contact.officeTemporaryIds.some((id) => id === officeTemporaryId),
  )
}

/**
 * Produces a deterministic, in-memory reconciliation result. This deliberately
 * accepts only an already-structured synthetic fixture: there is no file,
 * spreadsheet, CSV, TSV or pasted-text parser in the W-020 rehearsal.
 */
export function reconcileSyntheticMaCutover(
  fixture: MaCutoverSyntheticFixture,
): MaCutoverRehearsal {
  const issues: MaCutoverIssue[] = []
  const firms = stable(fixture.firms)
  const offices = stable(fixture.offices)
  const contacts = stable(fixture.contacts)
  const opportunities = stable(fixture.opportunities)
  const firmIds = new Set(firms.map((firm) => firm.temporaryId))
  const firmById = new Map(firms.map((firm) => [firm.temporaryId, firm]))
  const validFirmIds = new Set<string>()
  const officeById = new Map(offices.map((office) => [office.temporaryId, office]))
  const contactById = new Map(
    contacts.map((contact) => [contact.temporaryId, contact]),
  )
  const validOfficeIds = new Set<string>()
  const resolvedContactOfficeKeys = new Set<string>()

  for (const firm of firms) {
    if (!text(firm.name)) {
      addIssue(
        issues,
        `firm:${firm.temporaryId}`,
        "FIRM_NAME_REQUIRED",
        "blocker",
        "name",
        "A staged firm requires a name before activation.",
      )
      continue
    }
    validFirmIds.add(firm.temporaryId)
  }

  for (const office of offices) {
    const rowKey = `office:${office.temporaryId}`
    const parentId = text(office.firmTemporaryId)
    if (!parentId || !firmIds.has(parentId) || !validFirmIds.has(parentId)) {
      addIssue(
        issues,
        rowKey,
        "OFFICE_PARENT_MAPPING_UNRESOLVED",
        "blocker",
        "firmTemporaryId",
        "The office cannot resolve its staged firm parent across sheets.",
      )
    }
    if (!text(office.name)) {
      addIssue(
        issues,
        rowKey,
        "OFFICE_NAME_REQUIRED",
        "blocker",
        "name",
        "A staged operating office requires a name before activation.",
      )
    }
    if (office.isSyntheticDefault === true && parentId) {
      const parentFirm = firmById.get(parentId)
      const parentFirmName = text(parentFirm?.name)
      const officeName = text(office.name)
      if (
        parentFirmName &&
        officeName &&
        parentFirmName.toLowerCase() !== officeName.toLowerCase()
      ) {
        addIssue(
          issues,
          rowKey,
          "SYNTHETIC_DEFAULT_NAME_MISMATCH",
          "blocker",
          "name",
          "A synthetic default office must use the exact firm name.",
        )
      }

      const hasStagedRealOffice = offices.some(
        (candidate) =>
          candidate.temporaryId !== office.temporaryId &&
          text(candidate.firmTemporaryId) === parentId &&
          candidate.isSyntheticDefault !== true,
      )
      if (hasStagedRealOffice) {
        addIssue(
          issues,
          rowKey,
          "SYNTHETIC_DEFAULT_REQUIRES_UNKNOWN_OFFICE",
          "blocker",
          "isSyntheticDefault",
          "A firm with a staged real office cannot use a synthetic fallback.",
        )
      }
    }
    if (!hasBlocker(issues, rowKey)) validOfficeIds.add(office.temporaryId)
  }

  for (const contact of contacts) {
    for (const officeId of [...contact.officeTemporaryIds].sort()) {
      if (!validOfficeIds.has(officeId)) {
        addIssue(
          issues,
          `contact:${contact.temporaryId}`,
          "CONTACT_OFFICE_MAPPING_UNRESOLVED",
          "blocker",
          "officeTemporaryIds",
          "The contact cannot resolve one of its staged office affiliations.",
        )
        continue
      }
      resolvedContactOfficeKeys.add(`${contact.temporaryId}:${officeId}`)
    }
  }

  const normalized = opportunities.map((row) => normaliseOpportunity(row, issues))
  const references = new Map<string, string[]>()
  for (const { opportunity } of normalized) {
    if (!opportunity.reference) continue
    const referenceKey = opportunity.reference.toLowerCase()
    references.set(referenceKey, [
      ...(references.get(referenceKey) ?? []),
      opportunity.temporaryId,
    ])
  }

  for (const duplicateIds of references.values()) {
    if (duplicateIds.length < 2) continue
    for (const temporaryId of duplicateIds.sort()) {
      addIssue(
        issues,
        `opportunity:${temporaryId}`,
        "DUPLICATE_OPPORTUNITY_REFERENCE",
        "blocker",
        "reference",
        "This mandate reference is duplicated in the staged cutover set.",
      )
    }
  }

  let opportunityContactLinks = 0
  let primaryContactLinks = 0
  for (const { opportunity } of normalized) {
    const rowKey = `opportunity:${opportunity.temporaryId}`
    const officeId = opportunity.sourceOfficeTemporaryId
    if (!officeId || !officeById.has(officeId) || !validOfficeIds.has(officeId)) {
      addIssue(
        issues,
        rowKey,
        "OPPORTUNITY_SOURCE_OFFICE_REQUIRED",
        "blocker",
        "sourceOfficeTemporaryId",
        "A valid opportunity requires a staged operating office before activation.",
      )
    }
    if (!opportunity.description) {
      addIssue(
        issues,
        rowKey,
        "OPPORTUNITY_DESCRIPTION_REQUIRED",
        "blocker",
        "description",
        "A valid opportunity requires a description before activation.",
      )
    }

    const primaryContact = opportunity.primaryContactTemporaryId
      ? contactById.get(opportunity.primaryContactTemporaryId)
      : undefined
    const primaryContactMapsToOffice = Boolean(
      officeId &&
        validOfficeIds.has(officeId) &&
        contactHasOffice(primaryContact, officeId),
    )
    if (!primaryContactMapsToOffice) {
      addIssue(
        issues,
        rowKey,
        "PRIMARY_CONTACT_MAPPING_UNRESOLVED",
        "blocker",
        "primaryContactTemporaryId",
        "The primary contact must resolve to the same staged operating office.",
      )
    }

    for (const contactTemporaryId of opportunity.selectedContactTemporaryIds) {
      const selectedContact = contactById.get(contactTemporaryId)
      const selectedContactMapsToOffice = Boolean(
        officeId &&
          validOfficeIds.has(officeId) &&
          contactHasOffice(selectedContact, officeId),
      )
      if (!selectedContactMapsToOffice) {
        if (contactTemporaryId !== opportunity.primaryContactTemporaryId) {
          addIssue(
            issues,
            rowKey,
            "OPPORTUNITY_CONTACT_MAPPING_UNRESOLVED",
            "blocker",
            "contactTemporaryIds",
            "Every selected contact must resolve to the opportunity’s staged operating office.",
          )
        }
        continue
      }
      opportunityContactLinks += 1
    }

    if (primaryContact && primaryContactMapsToOffice) {
      const hasPrimaryIdentity = Boolean(
        text(primaryContact.firstName) || text(primaryContact.lastName),
      )
      if (!hasPrimaryIdentity) {
        addIssue(
          issues,
          rowKey,
          "PRIMARY_CONTACT_IDENTITY_REQUIRED",
          "blocker",
          "primaryContactTemporaryId",
          "The primary contact requires a first name or last name.",
        )
      }

      const primaryEmail = text(primaryContact.email)
      if (!primaryEmail) {
        addIssue(
          issues,
          rowKey,
          "PRIMARY_CONTACT_EMAIL_REQUIRED",
          "blocker",
          "primaryContactTemporaryId",
          "The primary contact requires a usable email address.",
        )
      } else if (!USABLE_EMAIL.test(primaryEmail)) {
        addIssue(
          issues,
          rowKey,
          "PRIMARY_CONTACT_EMAIL_INVALID",
          "blocker",
          "primaryContactTemporaryId",
          "The primary contact email is malformed and cannot activate an opportunity.",
        )
      } else if (
        hasPrimaryIdentity &&
        opportunity.primaryContactTemporaryId !== null &&
        opportunity.selectedContactTemporaryIds.includes(
          opportunity.primaryContactTemporaryId,
        )
      ) {
        primaryContactLinks += 1
      }
    }
  }

  const normalizedOpportunities = normalized.map(({ opportunity }) => opportunity)
  const sortedIssues = issues.sort(
    (left, right) =>
      left.rowKey.localeCompare(right.rowKey) ||
      left.code.localeCompare(right.code) ||
      left.field.localeCompare(right.field),
  )
  const readyForActivation = normalizedOpportunities.filter(
    (opportunity) => !hasBlocker(sortedIssues, `opportunity:${opportunity.temporaryId}`),
  ).length
  const duplicateReferences = [...references.values()].filter(
    (ids) => ids.length > 1,
  ).length

  const summary: MaCutoverReconciliationSummary = {
    sourceRows: {
      firms: firms.length,
      offices: offices.length,
      contacts: contacts.length,
      opportunities: opportunities.length,
    },
    resolvedMappings: {
      officeParents: validOfficeIds.size,
      contactOfficeAffiliations: resolvedContactOfficeKeys.size,
      opportunityContactLinks,
      primaryContactLinks,
    },
    opportunityRows: {
      readyForActivation,
      blocked: opportunities.length - readyForActivation,
      duplicateReferences,
    },
    geography: {
      confirmed: normalizedOpportunities.filter(
        (opportunity) => opportunity.geographyDecision === "confirmed",
      ).length,
      review: normalizedOpportunities.filter(
        (opportunity) => opportunity.geographyDecision === "review",
      ).length,
      retainedNull: normalizedOpportunities.filter(
        (opportunity) => opportunity.geographyDecision === "null",
      ).length,
    },
    normalization: {
      invalidSuppliedRevenue: normalized.filter(
        ({ invalidRevenue }) => invalidRevenue,
      ).length,
      invalidSuppliedEbitda: normalized.filter(
        ({ invalidEbitda }) => invalidEbitda,
      ).length,
      invalidSuppliedHeadcount: normalized.filter(
        ({ invalidHeadcount }) => invalidHeadcount,
      ).length,
      invalidSuppliedDate: normalized.filter(({ invalidDate }) => invalidDate)
        .length,
    },
    issues: {
      blockers: sortedIssues.filter((issue) => issue.severity === "blocker")
        .length,
      warnings: sortedIssues.filter((issue) => issue.severity === "warning")
        .length,
    },
  }

  return {
    fixtureId: fixture.id,
    sourceFingerprint: fixture.sourceFingerprint,
    normalizedOpportunities,
    issues: sortedIssues,
    summary,
  }
}

const SYNTHETIC_CUTOVER_FIXTURE: MaCutoverSyntheticFixture = {
  id: "ma-cutover-synthetic-rehearsal-v1",
  sourceFingerprint: "synthetic:ma-cutover-rehearsal:v1",
  firms: [
    { temporaryId: "firm-alpine", name: "Alpine Advisory" },
    { temporaryId: "firm-no-name", name: null },
  ],
  offices: [
    {
      temporaryId: "office-paris",
      firmTemporaryId: "firm-alpine",
      name: "Paris",
    },
    {
      temporaryId: "office-unmapped-parent",
      firmTemporaryId: "firm-not-in-fixture",
      name: "West desk",
    },
  ],
  contacts: [
    {
      temporaryId: "contact-valid",
      officeTemporaryIds: ["office-paris"],
      firstName: "Marie",
      lastName: "Durand",
      email: "marie.durand@example.test",
    },
    {
      temporaryId: "contact-secondary",
      officeTemporaryIds: ["office-paris"],
      firstName: "Lina",
      lastName: "Moreau",
      email: "lina.moreau@example.test",
    },
    {
      temporaryId: "contact-no-name",
      officeTemporaryIds: ["office-paris"],
      firstName: null,
      lastName: null,
      email: "noname@example.test",
    },
    {
      temporaryId: "contact-malformed-email",
      officeTemporaryIds: ["office-paris"],
      firstName: "Alex",
      lastName: "Martin",
      email: "not-an-email",
    },
    {
      temporaryId: "contact-unmapped-office",
      officeTemporaryIds: ["office-unmapped-parent"],
      firstName: "Noah",
      lastName: "West",
      email: "noah.west@example.test",
    },
  ],
  opportunities: [
    {
      temporaryId: "opportunity-valid-chain",
      reference: "SYN-001",
      sourceOfficeTemporaryId: "office-paris",
      contactTemporaryIds: ["contact-valid", "contact-secondary"],
      primaryContactTemporaryId: "contact-valid",
      description: "Synthetic valid chain used only for cutover rehearsal.",
      sector: "Industrial services",
      activity: "Engineering services",
      location: "Paris",
      locationDecision: "approved",
      sourceGeographyLabel: "Île-de-France",
      geographyDecision: "confirmed",
      revenueMeur: "3.4",
      ebitdaKeur: 620,
      headcount: 18,
      headcountRange: "10-25",
      dateAdded: "2026-07-01",
      publicTitle: "Established industrial-services business",
      teaserSummary: "Synthetic public summary for rehearsal only.",
      internalNotes: "Synthetic staff-only cutover note.",
    },
    {
      temporaryId: "opportunity-duplicate-a",
      reference: "SYN-002",
      sourceOfficeTemporaryId: "office-paris",
      contactTemporaryIds: ["contact-valid"],
      primaryContactTemporaryId: "contact-valid",
      description: "First duplicate reference for reconciliation coverage.",
    },
    {
      temporaryId: "opportunity-duplicate-b",
      reference: "SYN-002",
      sourceOfficeTemporaryId: "office-paris",
      contactTemporaryIds: ["contact-valid"],
      primaryContactTemporaryId: "contact-valid",
      description: "Second duplicate reference for reconciliation coverage.",
    },
    {
      temporaryId: "opportunity-missing-office-description",
      reference: "SYN-003",
      sourceOfficeTemporaryId: null,
      contactTemporaryIds: ["contact-valid"],
      primaryContactTemporaryId: "contact-valid",
      description: null,
    },
    {
      temporaryId: "opportunity-primary-no-name",
      reference: "SYN-004",
      sourceOfficeTemporaryId: "office-paris",
      contactTemporaryIds: ["contact-no-name"],
      primaryContactTemporaryId: "contact-no-name",
      description: "Primary identity validation rehearsal.",
    },
    {
      temporaryId: "opportunity-primary-malformed-email",
      reference: "SYN-005",
      sourceOfficeTemporaryId: "office-paris",
      contactTemporaryIds: ["contact-malformed-email"],
      primaryContactTemporaryId: "contact-malformed-email",
      description: "Primary email validation rehearsal.",
    },
    {
      temporaryId: "opportunity-review-geography-null-metrics",
      reference: "SYN-006",
      sourceOfficeTemporaryId: "office-paris",
      contactTemporaryIds: ["contact-valid"],
      primaryContactTemporaryId: "contact-valid",
      description: "Geography review and null numeric/date rehearsal.",
      location: "Nantes",
      locationDecision: "review",
      sourceGeographyLabel: "West coast label from source",
      geographyDecision: "review",
      revenueMeur: "not available",
      ebitdaKeur: "unknown",
      headcount: "around twenty",
      dateAdded: "31/02/2026",
    },
    {
      temporaryId: "opportunity-cross-sheet-parent-unmapped",
      reference: "SYN-007",
      sourceOfficeTemporaryId: "office-unmapped-parent",
      contactTemporaryIds: ["contact-unmapped-office"],
      primaryContactTemporaryId: "contact-unmapped-office",
      description: "Cross-sheet parent mapping must block activation when unresolved.",
    },
  ],
}

export function getSyntheticMaCutoverRehearsal() {
  return reconcileSyntheticMaCutover(SYNTHETIC_CUTOVER_FIXTURE)
}
