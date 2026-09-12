import {
  FULL_EXPORT_MATCH_COLUMNS,
  FULL_EXPORT_OPPORTUNITY_COLUMNS,
  FULL_OPPORTUNITY_EXPORT_HEADERS,
  FULL_EXPORT_REPRENEUR_COLUMNS,
  FULL_EXPORT_SOURCE_COLUMNS,
  FULL_EXPORT_CONTACT_COLUMNS,
  FULL_EXPORT_PURSUIT_EVENT_COLUMNS,
  FULL_EXPORT_COLLECTIONS,
  FULL_EXPORT_EVIDENCE_METADATA_COLUMNS,
  FULL_EXPORT_ATTACHMENT_COLUMNS,
  FULL_EXPORT_DISCLOSED_CONTACT_COLUMNS,
  FULL_EXPORT_LEGACY_CONTACT_COLUMNS,
} from "@/lib/opportunity-full-export-schema"
import {
  deriveOpportunityJourney,
  getOpportunityJourneyLabel,
} from "@/lib/utils/opportunity-journey"
import type {
  OpportunityMatchStatus,
  OpportunityPursuitStage,
  OpportunityStatus,
} from "@/lib/types/opportunity"

export type FullExportRecord = Record<string, unknown>

export type FullOpportunityExportSnapshot = Partial<
  Record<keyof typeof FULL_EXPORT_COLLECTIONS, FullExportRecord[]>
> & {
  opportunities: FullExportRecord[]
  matches: FullExportRecord[]
  repreneurs?: FullExportRecord[]
  sources?: FullExportRecord[]
  contacts?: FullExportRecord[]
  pursuitEvents?: FullExportRecord[]
  legacyContacts?: FullExportRecord[]
}

function pickFields(record: FullExportRecord, columns: readonly string[]) {
  return Object.fromEntries(columns.map((column) => [column, record[column]]))
}

function pickScalarFields(
  record: FullExportRecord,
  columns: readonly string[],
) {
  return Object.fromEntries(
    columns
      .filter(
        (column) =>
          record[column] === null ||
          ["string", "number", "boolean"].includes(typeof record[column]),
      )
      .map((column) => [column, record[column]]),
  )
}

function safeObjectArray(value: unknown, columns: readonly string[]) {
  return Array.isArray(value)
    ? value
        .filter(
          (entry): entry is FullExportRecord =>
            Boolean(entry) &&
            typeof entry === "object" &&
            !Array.isArray(entry),
        )
        .map((entry) => pickScalarFields(entry, columns))
    : []
}

function safeRelatedRecord(
  record: FullExportRecord,
  columns: readonly string[],
) {
  const safe = pickFields(record, columns)
  if ("metadata" in safe) {
    const metadata =
      record.metadata &&
      typeof record.metadata === "object" &&
      !Array.isArray(record.metadata)
        ? (record.metadata as FullExportRecord)
        : {}
    safe.metadata = {
      ...pickScalarFields(metadata, FULL_EXPORT_EVIDENCE_METADATA_COLUMNS),
      ...(Array.isArray(metadata.attachment_snapshot)
        ? {
            attachment_snapshot: safeObjectArray(
              metadata.attachment_snapshot,
              FULL_EXPORT_ATTACHMENT_COLUMNS,
            ),
          }
        : {}),
      ...(Array.isArray(metadata.contact_names)
        ? {
            contact_names: safeObjectArray(
              metadata.contact_names,
              FULL_EXPORT_DISCLOSED_CONTACT_COLUMNS,
            ),
          }
        : {}),
    }
  }
  if ("attachment_snapshot" in safe)
    safe.attachment_snapshot = safeObjectArray(
      record.attachment_snapshot,
      FULL_EXPORT_ATTACHMENT_COLUMNS,
    )
  if ("disclosed_contacts" in safe)
    safe.disclosed_contacts = safeObjectArray(
      record.disclosed_contacts,
      FULL_EXPORT_DISCLOSED_CONTACT_COLUMNS,
    )
  return safe
}

function byTimeAndId(timeColumn: string) {
  return (left: FullExportRecord, right: FullExportRecord) => {
    for (const column of [timeColumn, "id"]) {
      const a = String(left[column] ?? "")
      const b = String(right[column] ?? "")
      if (a !== b) return a < b ? -1 : 1
    }
    return 0
  }
}

function namespaceStatus(
  opportunity: FullExportRecord,
  repreneur: FullExportRecord | undefined,
) {
  if (
    typeof opportunity.is_demo !== "boolean" ||
    typeof repreneur?.is_demo !== "boolean"
  )
    return "unresolved_identity"
  return opportunity.is_demo === repreneur.is_demo
    ? "same_namespace"
    : "historical_mismatch"
}

function escapeCell(value: unknown) {
  if (value === null || value === undefined) return ""
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  // Stored numeric losses remain numbers. Formula-like text is never executable.
  const safe =
    typeof value === "string" &&
    (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
      ? `'${text}`
      : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function fullOpportunitySnapshotToCsv(
  snapshot: FullOpportunityExportSnapshot,
) {
  const rows: unknown[][] = []
  const repreneurs = new Map(
    (snapshot.repreneurs ?? []).map((record) => [record.id, record]),
  )
  for (const opportunity of snapshot.opportunities) {
    const matches = snapshot.matches.filter(
      (match) => match.opportunity_id === opportunity.id,
    )
    const sources = snapshot.sources?.find(
      (source) => source.opportunity_id === opportunity.id,
    )
    const contacts = (snapshot.contacts ?? [])
      .filter((contact) => contact.opportunity_id === opportunity.id)
      .sort(byTimeAndId("linked_at"))
      .map((contact) => pickFields(contact, FULL_EXPORT_CONTACT_COLUMNS))
    const journey = getOpportunityJourneyLabel(
      deriveOpportunityJourney({
        status: opportunity.status as OpportunityStatus,
        matches: matches
          .filter(
            (match) =>
              namespaceStatus(
                opportunity,
                repreneurs.get(match.repreneur_id),
              ) === "same_namespace",
          )
          .map((match) => ({
            status: match.status as OpportunityMatchStatus,
            pursuit_stage: match.pursuit_stage as
              | OpportunityPursuitStage
              | undefined,
          })),
      }),
    )
    for (const match of matches.length ? matches : [null]) {
      const repreneur = match ? repreneurs.get(match.repreneur_id) : undefined
      const events = match
        ? (snapshot.pursuitEvents ?? [])
            .filter(
              (event) =>
                event.opportunity_id === opportunity.id &&
                event.match_id === match.id &&
                event.repreneur_id === match.repreneur_id,
            )
            .sort(byTimeAndId("created_at"))
            .map((event) =>
              pickFields(event, FULL_EXPORT_PURSUIT_EVENT_COLUMNS),
            )
        : null
      rows.push([
        ...FULL_EXPORT_OPPORTUNITY_COLUMNS.map((column) =>
          column === "date_added" &&
          opportunity.date_added_precision === "month" &&
          typeof opportunity[column] === "string"
            ? opportunity[column].slice(0, 7)
            : opportunity[column],
        ),
        ...FULL_EXPORT_MATCH_COLUMNS.map((column) => match?.[column]),
        ...FULL_EXPORT_REPRENEUR_COLUMNS.map((column) => repreneur?.[column]),
        ...FULL_EXPORT_SOURCE_COLUMNS.map((column) => sources?.[column]),
        journey,
        match ? namespaceStatus(opportunity, repreneur) : "",
        contacts,
        events,
        ...Object.entries(FULL_EXPORT_COLLECTIONS).map(([key, collection]) => {
          if (!match && !["opportunity", "artifact"].includes(collection.scope))
            return null
          return (snapshot[key as keyof typeof FULL_EXPORT_COLLECTIONS] ?? [])
            .filter((record) => {
              if (collection.scope === "opportunity")
                return record.opportunity_id === opportunity.id
              if (collection.scope === "artifact")
                return (
                  record.opportunity_id === opportunity.id &&
                  (record.match_id == null || record.match_id === match?.id)
                )
              if (!match || record.match_id !== match.id) return false
              if (
                collection.scope !== "match" &&
                record.opportunity_id !== opportunity.id
              )
                return false
              return (
                collection.scope !== "identity" ||
                record.repreneur_id === match.repreneur_id
              )
            })
            .sort(byTimeAndId(collection.time))
            .map((record) => safeRelatedRecord(record, collection.columns))
        }),
        (snapshot.legacyContacts ?? [])
          .filter((contact) => contact.opportunity_id === opportunity.id)
          .sort((left, right) =>
            byTimeAndId("created_at")(
              { ...left, id: left.contact_id },
              { ...right, id: right.contact_id },
            ),
          )
          .map((contact) =>
            pickFields(contact, FULL_EXPORT_LEGACY_CONTACT_COLUMNS),
          ),
      ])
    }
  }
  return [
    FULL_OPPORTUNITY_EXPORT_HEADERS.join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n")
}
