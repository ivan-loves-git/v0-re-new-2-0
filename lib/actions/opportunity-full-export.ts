"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { Pool, type PoolClient } from "pg"
import { env } from "@/lib/env"
import { postgresSslForConnection } from "@/lib/postgres-ssl"
import {
  FULL_EXPORT_COLLECTIONS,
  FULL_EXPORT_MATCH_COLUMNS,
  FULL_EXPORT_OPPORTUNITY_COLUMNS,
  FULL_EXPORT_PURSUIT_EVENT_COLUMNS,
  FULL_EXPORT_REPRENEUR_COLUMNS,
} from "@/lib/opportunity-full-export-schema"
import {
  fullOpportunitySnapshotToCsv,
  type FullExportRecord,
  type FullOpportunityExportSnapshot,
} from "@/lib/utils/opportunity-full-export"

type FullExportResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string }

let pool: Pool | null = null
function getPool() {
  return (pool ??= new Pool({
    connectionString: env.DATABASE_URL,
    ssl: postgresSslForConnection(env.DATABASE_URL),
    max: 2,
    connectionTimeoutMillis: 10_000,
  }))
}

const ACCESS_ERROR =
  "Staff access is required for the full export. Please sign in again."

async function readRecords(client: PoolClient, sql: string) {
  // row_to_json preserves database dates and timestamps, including date-only fields.
  const { rows } = await client.query<{ record: FullExportRecord }>(
    `SELECT row_to_json(export_record) AS record FROM (${sql}) AS export_record`,
  )
  return rows.map((row) => row.record)
}

async function readTable(
  client: PoolClient,
  table: string,
  columns: readonly string[],
  where = "",
) {
  // Identifiers only come from the checked-in allowlists, never request input.
  return readRecords(
    client,
    `SELECT ${columns.map((column) => `record.${column}`).join(", ")} FROM public.${table} AS record ${where} ORDER BY record.id`,
  )
}

async function readSnapshot(
  client: PoolClient,
): Promise<FullOpportunityExportSnapshot> {
  const snapshot: FullOpportunityExportSnapshot = {
    opportunities: await readTable(
      client,
      "opportunities",
      FULL_EXPORT_OPPORTUNITY_COLUMNS,
    ),
    matches: await readTable(
      client,
      "opportunity_matches",
      FULL_EXPORT_MATCH_COLUMNS,
    ),
    repreneurs: await readTable(
      client,
      "repreneurs",
      FULL_EXPORT_REPRENEUR_COLUMNS,
      "WHERE EXISTS (SELECT 1 FROM public.opportunity_matches AS match WHERE match.repreneur_id = record.id)",
    ),
    pursuitEvents: await readTable(
      client,
      "opportunity_pursuit_events",
      FULL_EXPORT_PURSUIT_EVENT_COLUMNS,
    ),
    sources: await readRecords(
      client,
      `SELECT opportunity.id AS opportunity_id,
      firm.id AS firm_id, firm.name AS firm_name, office.id AS office_id, office.name AS office_name,
      office.city AS office_city, office.general_email AS office_general_email, office.general_phone AS office_general_phone,
      legacy.id AS legacy_firm_id, legacy.firm_name AS legacy_firm_name
      FROM public.opportunities AS opportunity
      LEFT JOIN public.ma_offices AS office ON office.id = opportunity.source_office_id
      LEFT JOIN public.ma_firms AS firm ON firm.id = office.firm_id
      LEFT JOIN public.ma_sources AS legacy ON legacy.id = opportunity.source_id
      ORDER BY opportunity.id`,
    ),
    contacts: await readRecords(
      client,
      `SELECT link.id, link.opportunity_id, link.affiliation_id, link.legacy_source_contact_id,
      link.contact_name_snapshot, link.contact_email_snapshot, link.contact_phone_snapshot, link.is_primary, link.is_active,
      link.linked_by, link.linked_at, link.removed_by, link.removed_at,
      contact.id AS contact_id, contact.display_name AS current_contact_name, contact.email AS current_contact_email, contact.phone AS current_contact_phone,
      affiliation.office_id AS affiliation_office_id, affiliation.job_title AS affiliation_job_title,
      affiliation.is_active AS affiliation_is_active, affiliation.started_at AS affiliation_started_at, affiliation.ended_at AS affiliation_ended_at
      FROM public.opportunity_ma_contacts AS link
      LEFT JOIN public.ma_contact_office_affiliations AS affiliation ON affiliation.id = link.affiliation_id
      LEFT JOIN public.ma_contacts AS contact ON contact.id = affiliation.contact_id ORDER BY link.id`,
    ),
    legacyContacts: await readRecords(
      client,
      `SELECT link.opportunity_id, link.source_id, link.contact_id, link.is_primary,
      link.created_by, link.created_at, link.contact_name_snapshot, link.contact_email_snapshot, link.contact_phone_snapshot,
      link.canonical_opportunity_contact_id, contact.name AS current_contact_name,
      contact.email AS current_contact_email, contact.phone AS current_contact_phone,
      contact.canonical_contact_id, contact.office_affiliation_id
      FROM public.opportunity_source_contacts AS link
      LEFT JOIN public.ma_source_contacts AS contact ON contact.id = link.contact_id
      ORDER BY link.opportunity_id, link.contact_id`,
    ),
  }
  for (const [key, collection] of Object.entries(FULL_EXPORT_COLLECTIONS)) {
    snapshot[key as keyof typeof FULL_EXPORT_COLLECTIONS] = await readTable(
      client,
      collection.table,
      collection.columns,
      collection.scope === "opportunity"
        ? "WHERE record.opportunity_id IS NOT NULL"
        : "",
    )
  }
  return snapshot
}

export async function exportFullOpportunityCsv(
  confirmed: boolean,
): Promise<FullExportResult> {
  if (confirmed !== true)
    return {
      ok: false,
      error: "Confirm the confidential full export before downloading.",
    }
  let client: PoolClient | undefined
  let completed = false
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    })
    if (!session?.user) return { ok: false, error: ACCESS_ERROR }
    client = await getPool().connect()
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await client.query("SET LOCAL statement_timeout = '30s'")
    await client.query("SET LOCAL timezone = 'UTC'")
    // Same identity semantics as staff access, rechecked inside this snapshot.
    const staff = await client.query(
      "SELECT 1 FROM public.app_user_roles WHERE role::text = 'staff' AND (user_id = $1 OR LOWER(TRIM(email)) = $2) LIMIT 1",
      [session.user.id, session.user.email.trim().toLowerCase()],
    )
    if (!staff.rows.length) return { ok: false, error: ACCESS_ERROR }
    const snapshot = await readSnapshot(client)
    const csv = fullOpportunitySnapshotToCsv(snapshot)
    await client.query("COMMIT")
    completed = true
    return {
      ok: true,
      csv,
      filename: `wave-full-opportunities-pursuits-internal-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    }
  } catch {
    return {
      ok: false,
      error:
        "The full export is unavailable. No file was downloaded. Please try again.",
    }
  } finally {
    if (client) {
      let discardConnection = false
      if (!completed) {
        try {
          await client.query("ROLLBACK")
        } catch {
          discardConnection = true
        }
      }
      client.release(discardConnection)
    }
  }
}
