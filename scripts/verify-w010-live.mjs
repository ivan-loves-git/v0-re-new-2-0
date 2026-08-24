#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { databaseTls } from "./database-tls.mjs";

const [workbook, envFile, parser] = process.argv.slice(2);
if (!workbook || !envFile || !parser) {
  throw new Error("Usage: w010-live-verify.mjs <workbook> <env> <parser>");
}

function readEnvironment(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([^#=\s]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/))
      .filter(Boolean)
      .map((match) => [
        match[1],
        (match[2] ?? match[3] ?? match[4] ?? "").trim(),
      ]),
  );
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sameNumber(actual, expected) {
  if (actual == null || actual === "") return expected == null;
  if (expected == null) return false;
  return Number(actual) === Number(expected);
}

const source = JSON.parse(
  execFileSync("python3", [path.resolve(parser), path.resolve(workbook)], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);
const env = readEnvironment(envFile);
const client = new pg.Client({
  connectionString: env.DIRECT_URL ?? env.DATABASE_URL,
    ssl: databaseTls(env.DIRECT_URL ?? env.DATABASE_URL, env),
});
await client.connect();

const failures = [];
try {
  await client.query("BEGIN READ ONLY");
  const [
    run,
    directory,
    opportunityRows,
    opportunityLinks,
    matchRows,
    integrity,
  ] = await Promise.all([
    client.query(
      `
        SELECT
          run.id,
          run.status,
          run.result_summary,
          (SELECT COUNT(*)::int FROM public.ma_cutover_stage_rows row WHERE row.run_id = run.id) AS stage_rows,
          (SELECT COUNT(*)::int FROM public.ma_cutover_stage_issues issue WHERE issue.run_id = run.id) AS stage_issues
        FROM public.ma_cutover_runs run
        WHERE run.source_hash = $1
        ORDER BY run.created_at DESC
        LIMIT 1
      `,
      [source.source.sha256],
    ),
    client.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM public.ma_firms WHERE created_by = 'Ivan Paudice via Codex W-010') AS firms,
          (SELECT COUNT(*)::int FROM public.ma_offices WHERE created_by = 'Ivan Paudice via Codex W-010') AS offices,
          (SELECT COUNT(*)::int FROM public.ma_contacts WHERE created_by = 'Ivan Paudice via Codex W-010') AS contacts,
          (SELECT COUNT(*)::int FROM public.ma_contact_office_affiliations WHERE created_by = 'Ivan Paudice via Codex W-010') AS affiliations,
          (
            SELECT COUNT(*)::int
            FROM public.ma_contacts
            WHERE created_by = 'Ivan Paudice via Codex W-010'
              AND internal_notes LIKE 'Email suppressed in the W-010 source snapshot;%'
          ) AS suppressed_contacts
      `,
    ),
    client.query(
      `
        SELECT
          opportunity.id,
          opportunity.reference,
          opportunity.description,
          opportunity.status::text,
          opportunity.repreneur_exposure::text,
          opportunity.public_title,
          opportunity.teaser_summary,
          opportunity.sector,
          opportunity.location,
          opportunity.revenue_meur,
          opportunity.ebitda_keur,
          opportunity.headcount,
          opportunity.headcount_range,
          opportunity.date_added::text,
          opportunity.internal_notes,
          opportunity.source_office_id,
          opportunity.created_by,
          EXISTS (
            SELECT 1
            FROM public.ma_interactions interaction
            WHERE interaction.opportunity_id = opportunity.id
          ) AS has_interaction_history,
          firm.name AS source_firm_name,
          office.name AS source_office_name
        FROM public.opportunities opportunity
        LEFT JOIN public.ma_offices office ON office.id = opportunity.source_office_id
        LEFT JOIN public.ma_firms firm ON firm.id = office.firm_id
        WHERE LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
        ORDER BY opportunity.reference
      `,
      [source.opportunities.map((item) => normalize(item.reference))],
    ),
    client.query(
      `
        SELECT
          COUNT(*)::int AS active_links,
          COUNT(*) FILTER (
            WHERE affiliation.office_id IS DISTINCT FROM opportunity.source_office_id
          )::int AS cross_office_links,
          COUNT(*) FILTER (WHERE link.is_primary)::int AS primary_links
        FROM public.opportunity_ma_contacts link
        JOIN public.opportunities opportunity ON opportunity.id = link.opportunity_id
        JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = link.affiliation_id
        WHERE link.is_active
          AND LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
      `,
      [source.opportunities.map((item) => normalize(item.reference))],
    ),
    client.query(
      `
        SELECT
          COUNT(*)::int AS inserted,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft
        FROM public.opportunity_matches
        WHERE created_by = 'Ivan Paudice via Codex W-010'
          AND human_notes LIKE 'W-010 source indicated a positioned repreneur;%'
      `,
    ),
    client.query(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM public.opportunities opportunity
            WHERE LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
              AND opportunity.created_by = 'Ivan Paudice via Codex W-010'
          ) AS new_opportunities,
          (
            SELECT COUNT(*)::int
            FROM public.opportunities opportunity
            WHERE LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
              AND opportunity.created_by = 'Ivan Paudice via Codex W-010'
              AND opportunity.status = 'draft'
              AND opportunity.repreneur_exposure = 'staff_only'
          ) AS safe_new_opportunities,
          (
            SELECT COUNT(*)::int
            FROM public.opportunities opportunity
            WHERE LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
              AND opportunity.created_by IS DISTINCT FROM 'Ivan Paudice via Codex W-010'
              AND NULLIF(BTRIM(opportunity.public_title), '') IS NOT NULL
              AND NULLIF(BTRIM(opportunity.teaser_summary), '') IS NOT NULL
          ) AS preserved_titled_reuses,
          (
            SELECT COUNT(*)::int
            FROM public.opportunities opportunity
            WHERE LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
              AND NULLIF(BTRIM(opportunity.public_title), '') IS NULL
          ) AS title_gaps,
          (
            SELECT COUNT(*)::int
            FROM public.opportunity_documents document
            JOIN public.opportunities opportunity ON opportunity.id = document.opportunity_id
            WHERE LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
          ) AS documents,
          (
            SELECT COUNT(*)::int
            FROM public.ma_interactions interaction
            JOIN public.opportunities opportunity ON opportunity.id = interaction.opportunity_id
            WHERE LOWER(BTRIM(opportunity.reference)) = ANY($1::text[])
          ) AS interactions
      `,
      [source.opportunities.map((item) => normalize(item.reference))],
    ),
  ]);

  const runRow = run.rows[0];
  if (!runRow || runRow.status !== "activated") failures.push("cutover_run_not_activated");
  if (runRow?.stage_rows !== 0 || runRow?.stage_issues !== 0) {
    failures.push("temporary_staging_not_purged");
  }

  const counts = directory.rows[0];
  for (const [field, expected] of [
    ["firms", 229],
    ["offices", 431],
    ["contacts", 575],
    ["affiliations", 603],
    ["suppressed_contacts", 18],
  ]) {
    if (counts[field] !== expected) failures.push(`${field}_count`);
  }

  const actualByReference = new Map(
    opportunityRows.rows.map((row) => [normalize(row.reference), row]),
  );
  if (actualByReference.size !== 148) failures.push("opportunity_reference_count");

  const firmByTemporaryId = new Map(
    source.firms.map((item) => [item.temporaryId, item]),
  );
  const officeByTemporaryId = new Map(
    source.offices.map((item) => [item.temporaryId, item]),
  );
  let sourceContextExceptions = 0;
  for (const expected of source.opportunities) {
    const actual = actualByReference.get(normalize(expected.reference));
    if (!actual) {
      failures.push(`missing_opportunity_row_${expected.sourceRow}`);
      continue;
    }
    if (actual.description !== expected.description) failures.push(`description_row_${expected.sourceRow}`);
    if ((actual.sector ?? null) !== (expected.sector ?? null)) failures.push(`sector_row_${expected.sourceRow}`);
    if (!sameNumber(actual.revenue_meur, expected.revenueMeur)) failures.push(`revenue_row_${expected.sourceRow}`);
    if (!sameNumber(actual.ebitda_keur, expected.ebitdaKeur)) failures.push(`ebitda_row_${expected.sourceRow}`);
    if (!sameNumber(actual.headcount, expected.headcount)) failures.push(`headcount_row_${expected.sourceRow}`);
    if ((actual.headcount_range ?? null) !== (expected.headcountRange ?? null)) failures.push(`headcount_range_row_${expected.sourceRow}`);
    if ((actual.date_added ?? null) !== (expected.dateAdded ?? null)) failures.push(`date_row_${expected.sourceRow}`);
    if (
      expected.internalNotes &&
      !String(actual.internal_notes ?? "").includes(expected.internalNotes)
    ) {
      failures.push(`notes_row_${expected.sourceRow}`);
    }
    if (
      expected.locationDecision === "approved" &&
      (actual.location ?? null) !== (expected.location ?? null)
    ) {
      failures.push(`location_row_${expected.sourceRow}`);
    }
    const expectedOffice = officeByTemporaryId.get(
      expected.sourceOfficeTemporaryId,
    );
    const expectedFirm = firmByTemporaryId.get(
      expectedOffice?.parentFirmTemporaryId,
    );
    const sourceMatches =
      normalize(actual.source_office_name) === normalize(expectedOffice?.name) &&
      normalize(actual.source_firm_name) === normalize(expectedFirm?.name);
    if (!sourceMatches) {
      if (actual.has_interaction_history) sourceContextExceptions += 1;
      else failures.push(`source_context_row_${expected.sourceRow}`);
    }
  }
  if (sourceContextExceptions !== 2) failures.push("source_context_history_exception_count");

  const links = opportunityLinks.rows[0];
  if (links.cross_office_links !== 0) failures.push("cross_office_link_integrity");
  if (links.primary_links !== 148) failures.push("primary_link_count");

  const matches = matchRows.rows[0];
  if (matches.inserted !== 20 || matches.draft !== 20) failures.push("positioned_match_count");

  const proof = integrity.rows[0];
  for (const [field, expected] of [
    ["new_opportunities", 37],
    ["safe_new_opportunities", 37],
    ["preserved_titled_reuses", 111],
    ["title_gaps", 20],
    ["documents", 2],
    ["interactions", 2],
  ]) {
    if (proof[field] !== expected) failures.push(`${field}_proof`);
  }

  await client.query("ROLLBACK");
  console.log(
    JSON.stringify(
      {
        status: failures.length === 0 ? "pass" : "fail",
        failures,
        run_id: runRow?.id ?? null,
        directory: counts,
        opportunities: {
          matched: actualByReference.size,
          created: proof.new_opportunities,
          updated_in_place: proof.preserved_titled_reuses,
          safe_new_drafts: proof.safe_new_opportunities,
          title_gaps_staff_only: proof.title_gaps,
          source_context_preserved_for_history: sourceContextExceptions,
          active_contact_links: links.active_links,
          primary_links: links.primary_links,
          cross_office_links: links.cross_office_links,
        },
        evidence_preserved: {
          documents: proof.documents,
          interactions: proof.interactions,
        },
        positioned_matches: matches,
        staging: {
          rows: runRow?.stage_rows ?? null,
          issues: runRow?.stage_issues ?? null,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {}
  throw error;
} finally {
  await client.end();
}
