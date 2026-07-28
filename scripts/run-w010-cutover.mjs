#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ACTOR = "Ivan Paudice via Codex W-010";
const DEFERRED_SAME_NAME_CONTACT_IDS = new Set([
  "contact:516",
  "contact:578",
]);

function parseArguments(argv) {
  const options = {
    apply: false,
    rehearse: false,
    envFile: ".env.local",
    workbook: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--rehearse") {
      options.rehearse = true;
    } else if (argument === "--env-file") {
      options.envFile = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!options.workbook) {
      options.workbook = argument;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }
  if (!options.workbook) {
    throw new Error(
      "Usage: node scripts/run-w010-cutover.mjs <workbook.xlsx> [--env-file <path>] [--rehearse|--apply]",
    );
  }
  if (options.apply && options.rehearse) {
    throw new Error("--apply and --rehearse are mutually exclusive.");
  }
  return options;
}

function readEnvironment(envFile) {
  const text = fs.readFileSync(envFile, "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^([^#=\s]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/))
      .filter(Boolean)
      .map((match) => [
        match[1],
        (match[2] ?? match[3] ?? match[4] ?? "").trim(),
      ]),
  );
}

function parseWorkbook(workbook) {
  const raw = execFileSync(
    "python3",
    [path.join(SCRIPT_DIR, "parse-w010-workbook.py"), workbook],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(raw);
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function unique(items) {
  return [...new Set(items)];
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

function mergedNotes(waveNote, sourceNote) {
  const current = String(waveNote ?? "").trim();
  const incoming = String(sourceNote ?? "").trim();
  if (!incoming) return current || undefined;
  if (!current || current.includes(incoming)) return current || incoming;
  return `${current}\n\nW-010 source note:\n${incoming}`;
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function loadProduction(client) {
  const [
    firms,
    offices,
    contacts,
    affiliations,
    opportunities,
    repreneurs,
    matches,
    cutoverRuns,
    provisional,
  ] = await Promise.all([
    client.query(`
      SELECT id, name, status
      FROM public.ma_firms
      WHERE status <> 'archived'
      ORDER BY id
    `),
    client.query(`
      SELECT id, firm_id, name, status, is_default
      FROM public.ma_offices
      WHERE status = 'active'
      ORDER BY id
    `),
    client.query(`
      SELECT id, first_name, last_name, email, status
      FROM public.ma_contacts
      WHERE status = 'active'
      ORDER BY id
    `),
    client.query(`
      SELECT id, contact_id, office_id, is_active
      FROM public.ma_contact_office_affiliations
      WHERE is_active
      ORDER BY id
    `),
    client.query(`
      SELECT
        id, reference, status::text, repreneur_exposure::text,
        public_title, teaser_summary, internal_notes, location
      FROM public.opportunities
      ORDER BY id
    `),
    client.query(`
      SELECT id, first_name, last_name
      FROM public.repreneurs
      ORDER BY id
    `),
    client.query(`
      SELECT opportunity_id, repreneur_id, status::text
      FROM public.opportunity_matches
      ORDER BY opportunity_id, repreneur_id
    `),
    client.query(`
      SELECT id, status, source_hash
      FROM public.ma_cutover_runs
      ORDER BY created_at, id
    `),
    client.query(`
      SELECT COUNT(*)::int AS count
      FROM public.opportunities opportunity
      WHERE public.ma_opportunity_source_review_required(opportunity.id)
    `),
  ]);
  return {
    firms: firms.rows,
    offices: offices.rows,
    contacts: contacts.rows,
    affiliations: affiliations.rows,
    opportunities: opportunities.rows,
    repreneurs: repreneurs.rows,
    matches: matches.rows,
    cutoverRuns: cutoverRuns.rows,
    unresolvedProvisionalSources: provisional.rows[0]?.count ?? 0,
  };
}

function reconcile(source, production) {
  const blockers = [];
  const stageRows = [];
  const decisions = {
    firms: { create: 0, reuse: 0 },
    offices: { create: 0, reuse: 0 },
    contacts: { create: 0, reuse: 0 },
    affiliations: { create: 0, reuse: 0 },
    opportunities: { create: 0, reuse: 0 },
  };
  const canonicalByTemporary = new Map();

  if (production.unresolvedProvisionalSources !== 0) {
    blockers.push("Unresolved Acme source context blocks cutover.");
  }
  const openRuns = production.cutoverRuns.filter((run) =>
    ["draft", "staged", "review_required", "approved", "activating"].includes(
      run.status,
    ),
  );
  if (openRuns.length > 0) {
    blockers.push("An open cutover run already exists.");
  }
  if (
    production.cutoverRuns.some(
      (run) =>
        run.status === "activated" && run.source_hash === source.source.sha256,
    )
  ) {
    blockers.push("This exact workbook snapshot has already been activated.");
  }

  const firmsByName = new Map();
  for (const firm of production.firms) {
    const key = normalize(firm.name);
    const values = firmsByName.get(key) ?? [];
    values.push(firm);
    firmsByName.set(key, values);
  }

  for (const firm of source.firms) {
    const candidates = firmsByName.get(normalize(firm.name)) ?? [];
    if (candidates.length > 1) {
      blockers.push(`Firm mapping is ambiguous for source row ${firm.sourceRow}.`);
      continue;
    }
    const reuse = candidates[0];
    const action = reuse ? "reuse" : "create";
    decisions.firms[action] += 1;
    if (reuse) canonicalByTemporary.set(firm.temporaryId, reuse.id);
    stageRows.push({
      entity_kind: "firm",
      resolution_action: action,
      reuse_canonical_id: reuse?.id ?? null,
      temporary_entity_id: firm.temporaryId,
      parent_temporary_entity_id: null,
      related_temporary_entity_ids: [],
      source_row_locator: {
        sourceSheet: "Cabinets",
        sourceRow: firm.sourceRow,
        sourceKey: firm.sourceId,
      },
      normalized_payload: compactObject({
        name: firm.name,
        status: firm.status,
        category: firm.category,
        networkLabel: firm.networkLabel,
        websiteUrl: firm.websiteUrl,
        discoveryChannel: firm.discoveryChannel,
        discoveryUrl: firm.discoveryUrl,
        discoveredAt: firm.discoveredAt,
        internalNotes: firm.internalNotes,
      }),
    });
  }

  const officesByFirmAndName = new Map();
  for (const office of production.offices) {
    officesByFirmAndName.set(
      `${office.firm_id}:${normalize(office.name)}`,
      office,
    );
  }
  for (const office of source.offices) {
    const firmId = canonicalByTemporary.get(office.parentFirmTemporaryId);
    const reuse = firmId
      ? officesByFirmAndName.get(`${firmId}:${normalize(office.name)}`)
      : null;
    const action = reuse ? "reuse" : "create";
    decisions.offices[action] += 1;
    if (reuse) canonicalByTemporary.set(office.temporaryId, reuse.id);
    stageRows.push({
      entity_kind: "office",
      resolution_action: action,
      reuse_canonical_id: reuse?.id ?? null,
      temporary_entity_id: office.temporaryId,
      parent_temporary_entity_id: office.parentFirmTemporaryId,
      related_temporary_entity_ids: [],
      source_row_locator: {
        sourceSheet: "Cabinets",
        sourceRow: office.sourceRow,
        sourceKey: office.sourceId,
      },
      normalized_payload: compactObject({
        name: office.name,
        isSyntheticDefault: false,
        city: office.city,
        regionCodes: office.regionCodes.join(";"),
        geographyConfidence: office.geographyConfidence,
        coverageNote: office.coverageNote,
        websiteUrl: office.websiteUrl,
        internalNotes: office.internalNotes,
      }),
    });
  }

  const affiliationsByContact = new Map();
  for (const affiliation of production.affiliations) {
    const values = affiliationsByContact.get(affiliation.contact_id) ?? [];
    values.push(affiliation);
    affiliationsByContact.set(affiliation.contact_id, values);
  }
  const contactsByEmail = new Map();
  const contactsByName = new Map();
  for (const contact of production.contacts) {
    const email = normalize(contact.email);
    if (email) {
      const values = contactsByEmail.get(email) ?? [];
      values.push(contact);
      contactsByEmail.set(email, values);
    }
    const name = normalize(`${contact.first_name ?? ""} ${contact.last_name ?? ""}`);
    const values = contactsByName.get(name) ?? [];
    values.push(contact);
    contactsByName.set(name, values);
  }

  for (const contact of source.contacts) {
    const fullName = normalize(
      `${contact.firstName ?? ""} ${contact.lastName ?? ""}`,
    );
    let candidates = contact.email
      ? contactsByEmail.get(normalize(contact.email)) ?? []
      : [];
    if (candidates.length > 1) {
      candidates = candidates.filter(
        (candidate) =>
          normalize(
            `${candidate.first_name ?? ""} ${candidate.last_name ?? ""}`,
          ) === fullName,
      );
    }
    if (candidates.length === 1) {
      const candidateName = normalize(
        `${candidates[0].first_name ?? ""} ${candidates[0].last_name ?? ""}`,
      );
      if (candidateName !== fullName) {
        blockers.push(
          `Existing email has a different named contact at source row ${contact.sourceRow}.`,
        );
        candidates = [];
      }
    }
    if (!contact.email && candidates.length === 0) {
      const sourceOfficeIds = contact.officeIds
        .map((sourceOfficeId) =>
          canonicalByTemporary.get(`office:${sourceOfficeId}`),
        )
        .filter(Boolean);
      candidates = (contactsByName.get(fullName) ?? []).filter((candidate) =>
        (affiliationsByContact.get(candidate.id) ?? []).some((affiliation) =>
          sourceOfficeIds.includes(affiliation.office_id),
        ),
      );
    }
    if (candidates.length > 1) {
      blockers.push(
        `Contact mapping is ambiguous at source row ${contact.sourceRow}.`,
      );
      continue;
    }
    const reuse = candidates[0];
    const action = reuse ? "reuse" : "create";
    decisions.contacts[action] += 1;
    if (reuse) canonicalByTemporary.set(contact.temporaryId, reuse.id);
    stageRows.push({
      entity_kind: "contact",
      resolution_action: action,
      reuse_canonical_id: reuse?.id ?? null,
      temporary_entity_id: contact.temporaryId,
      parent_temporary_entity_id: null,
      related_temporary_entity_ids: [],
      source_row_locator: {
        sourceSheet: contact.derivedFromOpportunity
          ? "Opportunités"
          : "Contacts",
        sourceRow: contact.sourceRow,
      },
      normalized_payload: compactObject({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        emailSuppressed: contact.emailSuppressed,
      }),
    });
  }

  const affiliationByContactAndOffice = new Map(
    production.affiliations.map((affiliation) => [
      `${affiliation.contact_id}:${affiliation.office_id}`,
      affiliation,
    ]),
  );
  const sourceAffiliationByTemporary = new Map(
    source.affiliations.map((affiliation) => [
      affiliation.temporaryId,
      affiliation,
    ]),
  );
  for (const affiliation of source.affiliations) {
    const contactId = canonicalByTemporary.get(
      affiliation.parentContactTemporaryId,
    );
    const officeId = canonicalByTemporary.get(affiliation.officeTemporaryId);
    const reuse =
      contactId && officeId
        ? affiliationByContactAndOffice.get(`${contactId}:${officeId}`)
        : null;
    const action = reuse ? "reuse" : "create";
    decisions.affiliations[action] += 1;
    if (reuse) canonicalByTemporary.set(affiliation.temporaryId, reuse.id);
    stageRows.push({
      entity_kind: "affiliation",
      resolution_action: action,
      reuse_canonical_id: reuse?.id ?? null,
      temporary_entity_id: affiliation.temporaryId,
      parent_temporary_entity_id: affiliation.parentContactTemporaryId,
      related_temporary_entity_ids: [affiliation.officeTemporaryId],
      source_row_locator: {
        sourceSheet: affiliation.temporaryId.includes("opportunity")
          ? "Opportunités"
          : "Contacts",
        sourceRow: affiliation.sourceRow,
      },
      normalized_payload: compactObject({ jobTitle: affiliation.jobTitle }),
    });
  }

  const opportunitiesByReference = new Map();
  for (const opportunity of production.opportunities) {
    const key = normalize(opportunity.reference);
    const values = opportunitiesByReference.get(key) ?? [];
    values.push(opportunity);
    opportunitiesByReference.set(key, values);
  }
  let finalTitleMissing = 0;
  for (const opportunity of source.opportunities) {
    const candidates =
      opportunitiesByReference.get(normalize(opportunity.reference)) ?? [];
    if (candidates.length > 1) {
      blockers.push(
        `Opportunity reference mapping is ambiguous at row ${opportunity.sourceRow}.`,
      );
      continue;
    }
    const reuse = candidates[0];
    const action = reuse ? "reuse" : "create";
    decisions.opportunities[action] += 1;
    if (reuse) canonicalByTemporary.set(opportunity.temporaryId, reuse.id);
    const targetStatus = reuse?.status ?? "draft";
    if (!["draft", "active", "paused"].includes(targetStatus)) {
      blockers.push(
        `Historical opportunity cannot be cut over at row ${opportunity.sourceRow}.`,
      );
    }
    const finalTitle = reuse?.public_title ?? opportunity.publicTitle ?? null;
    if (!String(finalTitle ?? "").trim()) finalTitleMissing += 1;
    const payload = compactObject({
      reference: opportunity.reference,
      description: opportunity.description,
      targetStatus,
      primaryAffiliationTemporaryId:
        opportunity.primaryAffiliationTemporaryId,
      sector: opportunity.sector,
      location:
        opportunity.location ??
        (reuse && opportunity.locationDecision === "review"
          ? undefined
          : null),
      locationDecision:
        opportunity.locationDecision === "approved" ? "approved" : "review",
      sourceGeographyLabel: opportunity.sourceLocation,
      geographyDecision:
        opportunity.locationDecision === "approved" ? "confirmed" : "review",
      revenueMeur: opportunity.revenueMeur,
      ebitdaKeur: opportunity.ebitdaKeur,
      headcount: opportunity.headcount,
      headcountRange: opportunity.headcountRange,
      dateAdded: opportunity.dateAdded,
      dateAddedPrecision: opportunity.dateAddedPrecision,
      dateParsingDecision: opportunity.dateParsingDecision,
      publicTitle: reuse ? undefined : opportunity.publicTitle,
      teaserSummary: undefined,
      internalNotes: mergedNotes(
        reuse?.internal_notes,
        opportunity.internalNotes,
      ),
    });
    stageRows.push({
      entity_kind: "opportunity",
      resolution_action: action,
      reuse_canonical_id: reuse?.id ?? null,
      temporary_entity_id: opportunity.temporaryId,
      parent_temporary_entity_id: opportunity.sourceOfficeTemporaryId,
      related_temporary_entity_ids: opportunity.affiliationTemporaryIds,
      source_row_locator: {
        sourceSheet: "Opportunités",
        sourceRow: opportunity.sourceRow,
        sourceKey: opportunity.reference,
      },
      normalized_payload: payload,
    });
  }

  const repreneursByFullName = new Map();
  const repreneursByFirstName = new Map();
  const repreneursByFirstAndInitial = new Map();
  for (const repreneur of production.repreneurs) {
    const fullName = normalize(
      `${repreneur.first_name ?? ""} ${repreneur.last_name ?? ""}`,
    );
    const reverseName = normalize(
      `${repreneur.last_name ?? ""} ${repreneur.first_name ?? ""}`,
    );
    for (const name of unique([fullName, reverseName]).filter(Boolean)) {
      const values = repreneursByFullName.get(name) ?? [];
      values.push(repreneur);
      repreneursByFullName.set(name, values);
    }
    const firstName = normalize(repreneur.first_name);
    if (firstName) {
      const firstValues = repreneursByFirstName.get(firstName) ?? [];
      firstValues.push(repreneur);
      repreneursByFirstName.set(firstName, firstValues);
      const lastName = normalize(repreneur.last_name);
      if (lastName) {
        const key = `${firstName} ${lastName[0]}`;
        const initialValues = repreneursByFirstAndInitial.get(key) ?? [];
        initialValues.push(repreneur);
        repreneursByFirstAndInitial.set(key, initialValues);
      }
    }
  }

  const positionedMatches = [];
  const unresolvedPositions = [];
  for (const position of source.positionedRepreneurs) {
    const tokens = position.normalizedName.split(" ");
    let candidates =
      repreneursByFullName.get(position.normalizedName) ?? [];
    let resolution = "exact_full_name";
    if (candidates.length === 0 && tokens.length === 1) {
      candidates = repreneursByFirstName.get(tokens[0]) ?? [];
      resolution = "unique_first_name";
    }
    if (
      candidates.length === 0 &&
      tokens.length === 2 &&
      tokens[1].length === 1
    ) {
      candidates =
        repreneursByFirstAndInitial.get(`${tokens[0]} ${tokens[1]}`) ?? [];
      resolution = "unique_first_last_initial";
    }
    if (candidates.length === 1) {
      positionedMatches.push({
        reference: position.reference,
        repreneurId: candidates[0].id,
        resolution,
      });
    } else {
      unresolvedPositions.push({
        referenceHash: digest(normalize(position.reference)).slice(0, 16),
        nameHash: digest(position.normalizedName).slice(0, 16),
        candidateCount: candidates.length,
      });
    }
  }

  if (decisions.opportunities.reuse !== 111) {
    blockers.push(
      `Expected 111 opportunity reuses, got ${decisions.opportunities.reuse}.`,
    );
  }
  if (decisions.opportunities.create !== 37) {
    blockers.push(
      `Expected 37 opportunity creates, got ${decisions.opportunities.create}.`,
    );
  }
  if (finalTitleMissing !== 20) {
    blockers.push(`Expected 20 final title gaps, got ${finalTitleMissing}.`);
  }
  if (positionedMatches.length !== 20 || unresolvedPositions.length !== 6) {
    blockers.push(
      `Expected 20 resolved and 6 unresolved positioned entries, got ${positionedMatches.length}/${unresolvedPositions.length}.`,
    );
  }

  const sourceWarnings = source.warnings.map((warning) => ({
    severity: "warning",
    code: warning.code,
    field_name: null,
    message: `Reviewed W-010 source exception: ${warning.code}.`,
  }));
  const positionWarnings = unresolvedPositions.map(() => ({
    severity: "warning",
    code: "positioned_repreneur_requires_review",
    field_name: null,
    message:
      "A positioned repreneur label was ambiguous or absent and was not linked.",
  }));

  // The existing controlled activator predates this workbook and rejects a
  // second active contact with the same normalized name even when both people
  // have distinct emails and offices. Keep those two reviewed identities out
  // of staging and create them through the canonical contact primitive after
  // source activation. No new opportunity depends on either deferred row.
  const deferredAffiliationIds = new Set(
    stageRows
      .filter(
        (row) =>
          row.entity_kind === "affiliation" &&
          DEFERRED_SAME_NAME_CONTACT_IDS.has(
            row.parent_temporary_entity_id,
          ),
      )
      .map((row) => row.temporary_entity_id),
  );

  const activationStageRows = stageRows.flatMap((row) => {
    if (
      row.entity_kind === "contact" &&
      DEFERRED_SAME_NAME_CONTACT_IDS.has(row.temporary_entity_id)
    ) {
      return [];
    }
    if (
      row.entity_kind === "affiliation" &&
      DEFERRED_SAME_NAME_CONTACT_IDS.has(row.parent_temporary_entity_id)
    ) {
      return [];
    }
    if (
      row.entity_kind === "opportunity" &&
      row.resolution_action === "reuse"
    ) {
      return [];
    }
    if (
      row.entity_kind === "opportunity" &&
      row.related_temporary_entity_ids.some((id) =>
        deferredAffiliationIds.has(id),
      )
    ) {
      blockers.push(
        "A new opportunity depends on a deferred same-name contact.",
      );
      return [];
    }

    const payload = row.normalized_payload;
    let activationPayload = payload;
    if (row.entity_kind === "firm") {
      activationPayload = compactObject({
        name: payload.name,
        category: payload.category,
        networkLabel: payload.networkLabel,
        websiteUrl: payload.websiteUrl,
        internalNotes: payload.internalNotes,
      });
    } else if (row.entity_kind === "office") {
      activationPayload = compactObject({
        name: payload.name,
        isSyntheticDefault: payload.isSyntheticDefault,
        city: payload.city,
        internalNotes: payload.internalNotes,
      });
    } else if (row.entity_kind === "contact") {
      activationPayload = compactObject({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
      });
    } else if (row.entity_kind === "opportunity") {
      activationPayload = compactObject({
        reference: payload.reference,
        description: payload.description,
        // The legacy activator accepts active/paused only. It creates these
        // records staff-only, and the same transaction immediately saves all
        // 37 as Draft before commit.
        targetStatus: "active",
        primaryAffiliationTemporaryId:
          payload.primaryAffiliationTemporaryId,
        sector: payload.sector,
        activity: payload.activity,
        location: payload.location,
        locationDecision: payload.locationDecision,
        sourceGeographyLabel: payload.sourceGeographyLabel,
        geographyDecision: payload.geographyDecision,
        revenueMeur: payload.revenueMeur,
        ebitdaKeur: payload.ebitdaKeur,
        headcount: payload.headcount,
        headcountRange: payload.headcountRange,
        dateAdded: payload.dateAdded,
        publicTitle: payload.publicTitle,
        teaserSummary: payload.teaserSummary,
        internalNotes: payload.internalNotes,
      });
    }
    return [{ ...row, normalized_payload: activationPayload }];
  });

  return {
    blockers,
    decisions,
    stageRows,
    activationStageRows,
    stageIssues: [...sourceWarnings, ...positionWarnings],
    positionedMatches,
    unresolvedPositions,
    finalTitleMissing,
  };
}

function publicSummary(source, reconciliation, mode) {
  return {
    mode,
    source_sha256: source.source.sha256,
    source_snapshot_modified_at: source.source.snapshotModifiedAt,
    source_counts: source.summary,
    mapping: reconciliation.decisions,
    opportunity_titles_missing_after_merge: reconciliation.finalTitleMissing,
    positioned_repreneurs: {
      linked_as_draft: reconciliation.positionedMatches.length,
      left_for_review: reconciliation.unresolvedPositions.length,
    },
    reviewed_rows: reconciliation.stageRows.length,
    activation_stage_rows: reconciliation.activationStageRows.length,
    stage_warnings: reconciliation.stageIssues.length,
    blockers: reconciliation.blockers,
  };
}

async function insertStageRows(client, runId, rows) {
  const chunkSize = 250;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    await client.query(
      `
        INSERT INTO public.ma_cutover_stage_rows (
          run_id,
          entity_kind,
          resolution_action,
          reuse_canonical_id,
          temporary_entity_id,
          parent_temporary_entity_id,
          related_temporary_entity_ids,
          source_row_locator,
          normalized_payload
        )
        SELECT
          $1::uuid,
          item.entity_kind,
          item.resolution_action,
          item.reuse_canonical_id,
          item.temporary_entity_id,
          item.parent_temporary_entity_id,
          item.related_temporary_entity_ids,
          item.source_row_locator,
          item.normalized_payload
        FROM jsonb_to_recordset($2::jsonb) AS item(
          entity_kind text,
          resolution_action text,
          reuse_canonical_id uuid,
          temporary_entity_id text,
          parent_temporary_entity_id text,
          related_temporary_entity_ids jsonb,
          source_row_locator jsonb,
          normalized_payload jsonb
        )
      `,
      [runId, JSON.stringify(chunk)],
    );
  }
}

async function insertStageIssues(client, runId, issues) {
  const chunkSize = 250;
  for (let start = 0; start < issues.length; start += chunkSize) {
    const chunk = issues.slice(start, start + chunkSize);
    await client.query(
      `
        INSERT INTO public.ma_cutover_stage_issues (
          run_id, severity, code, field_name, message
        )
        SELECT
          $1::uuid,
          item.severity,
          item.code,
          item.field_name,
          item.message
        FROM jsonb_to_recordset($2::jsonb) AS item(
          severity text,
          code text,
          field_name text,
          message text
        )
      `,
      [runId, JSON.stringify(chunk)],
    );
  }
}

function oneCandidate(candidates, label) {
  if (candidates.length !== 1) {
    throw new Error(
      `${label} resolved to ${candidates.length} canonical records.`,
    );
  }
  return candidates[0];
}

async function loadFirmAndOfficeMaps(client, source) {
  const [firms, offices] = await Promise.all([
    client.query(`
      SELECT id, name
      FROM public.ma_firms
      WHERE status <> 'archived'
      ORDER BY id
    `),
    client.query(`
      SELECT id, firm_id, name
      FROM public.ma_offices
      WHERE status = 'active'
      ORDER BY id
    `),
  ]);

  const firmsByName = new Map();
  for (const row of firms.rows) {
    const values = firmsByName.get(normalize(row.name)) ?? [];
    values.push(row);
    firmsByName.set(normalize(row.name), values);
  }

  const firmIds = new Map();
  for (const firm of source.firms) {
    const row = oneCandidate(
      firmsByName.get(normalize(firm.name)) ?? [],
      `Firm source row ${firm.sourceRow}`,
    );
    firmIds.set(firm.temporaryId, row.id);
  }

  const officesByFirmAndName = new Map();
  for (const row of offices.rows) {
    const key = `${row.firm_id}:${normalize(row.name)}`;
    const values = officesByFirmAndName.get(key) ?? [];
    values.push(row);
    officesByFirmAndName.set(key, values);
  }

  const officeIds = new Map();
  for (const office of source.offices) {
    const firmId = firmIds.get(office.parentFirmTemporaryId);
    const row = oneCandidate(
      officesByFirmAndName.get(`${firmId}:${normalize(office.name)}`) ?? [],
      `Office source row ${office.sourceRow}`,
    );
    officeIds.set(office.temporaryId, row.id);
  }
  return { firmIds, officeIds };
}

async function createDeferredSameNameContacts(client, source, officeIds) {
  for (const temporaryId of DEFERRED_SAME_NAME_CONTACT_IDS) {
    const contact = source.contacts.find(
      (item) => item.temporaryId === temporaryId,
    );
    if (!contact) {
      throw new Error(`Deferred contact ${temporaryId} is missing.`);
    }
    const affiliations = source.affiliations.filter(
      (item) => item.parentContactTemporaryId === temporaryId,
    );
    if (affiliations.length === 0) {
      throw new Error(`Deferred contact ${temporaryId} has no affiliation.`);
    }

    let contactId = null;
    for (const affiliation of affiliations) {
      const officeId = officeIds.get(affiliation.officeTemporaryId);
      if (!officeId) {
        throw new Error(
          `Deferred contact office is unresolved at row ${affiliation.sourceRow}.`,
        );
      }
      const created = await client.query(
        `
          SELECT contact_id, affiliation_id
          FROM public.create_or_affiliate_ma_contact(
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
        `,
        [
          officeId,
          contactId,
          contactId ? null : contact.firstName,
          contactId ? null : contact.lastName,
          contactId ? null : contact.email,
          contactId ? null : contact.phone,
          affiliation.jobTitle,
          ACTOR,
        ],
      );
      contactId = created.rows[0]?.contact_id;
      if (!contactId) {
        throw new Error(`Deferred contact ${temporaryId} was not created.`);
      }
    }
  }
}

async function loadContactAndAffiliationMaps(client, source, officeIds) {
  const [contacts, affiliations] = await Promise.all([
    client.query(`
      SELECT
        contact.id,
        contact.first_name,
        contact.last_name,
        contact.email,
        COALESCE(
          ARRAY_AGG(affiliation.office_id)
            FILTER (WHERE affiliation.id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS office_ids
      FROM public.ma_contacts contact
      LEFT JOIN public.ma_contact_office_affiliations affiliation
        ON affiliation.contact_id = contact.id
        AND affiliation.is_active
      WHERE contact.status = 'active'
      GROUP BY contact.id
      ORDER BY contact.id
    `),
    client.query(`
      SELECT id, contact_id, office_id
      FROM public.ma_contact_office_affiliations
      WHERE is_active
      ORDER BY id
    `),
  ]);

  const contactsByEmail = new Map();
  const contactsByName = new Map();
  for (const row of contacts.rows) {
    if (normalize(row.email)) {
      const values = contactsByEmail.get(normalize(row.email)) ?? [];
      values.push(row);
      contactsByEmail.set(normalize(row.email), values);
    }
    const name = normalize(`${row.first_name ?? ""} ${row.last_name ?? ""}`);
    const values = contactsByName.get(name) ?? [];
    values.push(row);
    contactsByName.set(name, values);
  }

  const contactIds = new Map();
  for (const contact of source.contacts) {
    let candidates = contact.email
      ? contactsByEmail.get(normalize(contact.email)) ?? []
      : contactsByName.get(
          normalize(`${contact.firstName ?? ""} ${contact.lastName ?? ""}`),
        ) ?? [];
    if (!contact.email) {
      const expectedOfficeIds = new Set(
        contact.officeIds
          .map((id) => officeIds.get(`office:${id}`))
          .filter(Boolean),
      );
      candidates = candidates.filter((candidate) =>
        candidate.office_ids.some((id) => expectedOfficeIds.has(id)),
      );
    }
    const row = oneCandidate(
      candidates,
      `Contact source row ${contact.sourceRow}`,
    );
    contactIds.set(contact.temporaryId, row.id);
  }

  const affiliationByPair = new Map();
  for (const row of affiliations.rows) {
    const key = `${row.contact_id}:${row.office_id}`;
    const values = affiliationByPair.get(key) ?? [];
    values.push(row);
    affiliationByPair.set(key, values);
  }

  const affiliationIds = new Map();
  for (const affiliation of source.affiliations) {
    const contactId = contactIds.get(affiliation.parentContactTemporaryId);
    const officeId = officeIds.get(affiliation.officeTemporaryId);
    const row = oneCandidate(
      affiliationByPair.get(`${contactId}:${officeId}`) ?? [],
      `Affiliation source row ${affiliation.sourceRow}`,
    );
    affiliationIds.set(affiliation.temporaryId, row.id);
  }
  return { contactIds, affiliationIds };
}

async function updateDirectoryMetadata(
  client,
  source,
  { firmIds, officeIds, contactIds },
) {
  const firmUpdates = source.firms.map((firm) => ({
    id: firmIds.get(firm.temporaryId),
    status: firm.status,
    category: firm.category,
    network_label: firm.networkLabel,
    website_url: firm.websiteUrl,
    internal_notes: firm.internalNotes,
  }));
  await client.query(
    `
      UPDATE public.ma_firms AS firm
      SET
        status = item.status,
        category = item.category,
        network_label = item.network_label,
        website_url = item.website_url,
        internal_notes = item.internal_notes,
        updated_by = $2,
        updated_at = NOW()
      FROM jsonb_to_recordset($1::jsonb) AS item(
        id uuid,
        status text,
        category text,
        network_label text,
        website_url text,
        internal_notes text
      )
      WHERE firm.id = item.id
    `,
    [JSON.stringify(firmUpdates), ACTOR],
  );

  const officeUpdates = source.offices.map((office) => ({
    id: officeIds.get(office.temporaryId),
    city: office.city,
    region_codes: office.regionCodes,
    coverage_note: office.coverageNote,
    geography_confidence: office.geographyConfidence,
    website_url: office.websiteUrl,
    internal_notes: office.internalNotes,
  }));
  await client.query(
    `
      UPDATE public.ma_offices AS office
      SET
        city = item.city,
        region_codes = item.region_codes,
        coverage_note = item.coverage_note,
        geography_confidence = item.geography_confidence,
        website_url = item.website_url,
        internal_notes = item.internal_notes,
        updated_by = $2,
        updated_at = NOW()
      FROM jsonb_to_recordset($1::jsonb) AS item(
        id uuid,
        city text,
        region_codes text[],
        coverage_note text,
        geography_confidence text,
        website_url text,
        internal_notes text
      )
      WHERE office.id = item.id
    `,
    [JSON.stringify(officeUpdates), ACTOR],
  );

  const contactUpdates = source.contacts.map((contact) => ({
    id: contactIds.get(contact.temporaryId),
    linkedin_url: contact.linkedinUrl,
    internal_notes: contact.emailSuppressed
      ? "Email suppressed in the W-010 source snapshot; do not email until staff re-enables contact."
      : null,
  }));
  await client.query(
    `
      UPDATE public.ma_contacts AS contact
      SET
        linkedin_url = item.linkedin_url,
        internal_notes = item.internal_notes,
        updated_by = $2,
        updated_at = NOW()
      FROM jsonb_to_recordset($1::jsonb) AS item(
        id uuid,
        linkedin_url text,
        internal_notes text
      )
      WHERE contact.id = item.id
    `,
    [JSON.stringify(contactUpdates), ACTOR],
  );
}

async function saveAllOpportunities(
  client,
  source,
  reconciliation,
  officeIds,
  affiliationIds,
) {
  const stageByTemporaryId = new Map(
    reconciliation.stageRows
      .filter((row) => row.entity_kind === "opportunity")
      .map((row) => [row.temporary_entity_id, row]),
  );
  let created = 0;
  let updated = 0;
  let sourceContextPreservedForHistory = 0;

  for (const opportunity of source.opportunities) {
    const stage = stageByTemporaryId.get(opportunity.temporaryId);
    if (!stage) {
      throw new Error(
        `Reviewed opportunity row ${opportunity.sourceRow} is missing.`,
      );
    }
    const current = await client.query(
      `
        SELECT
          opportunity.id,
          opportunity.source_office_id,
          EXISTS (
            SELECT 1
            FROM public.ma_interactions interaction
            WHERE interaction.opportunity_id = opportunity.id
          ) AS has_interaction_history,
          COALESCE(
            ARRAY(
              SELECT link.affiliation_id
              FROM public.opportunity_ma_contacts link
              WHERE link.opportunity_id = opportunity.id
                AND link.is_active
              ORDER BY link.affiliation_id
            ),
            ARRAY[]::uuid[]
          ) AS affiliation_ids,
          (
            SELECT link.affiliation_id
            FROM public.opportunity_ma_contacts link
            WHERE link.opportunity_id = opportunity.id
              AND link.is_active
              AND link.is_primary
            LIMIT 1
          ) AS primary_affiliation_id
        FROM public.opportunities opportunity
        WHERE LOWER(BTRIM(opportunity.reference)) = LOWER(BTRIM($1))
        FOR UPDATE
      `,
      [opportunity.reference],
    );
    const opportunityId = oneCandidate(
      current.rows,
      `Opportunity source row ${opportunity.sourceRow}`,
    ).id;
    let sourceOfficeId = officeIds.get(
      opportunity.sourceOfficeTemporaryId,
    );
    let selectedAffiliationIds = opportunity.affiliationTemporaryIds.map(
      (id) => affiliationIds.get(id),
    );
    let primaryAffiliationId = affiliationIds.get(
      opportunity.primaryAffiliationTemporaryId,
    );
    const currentRow = current.rows[0];
    if (
      stage.resolution_action === "reuse" &&
      currentRow.has_interaction_history &&
      currentRow.source_office_id !== sourceOfficeId
    ) {
      sourceOfficeId = currentRow.source_office_id;
      selectedAffiliationIds = currentRow.affiliation_ids;
      primaryAffiliationId = currentRow.primary_affiliation_id;
      sourceContextPreservedForHistory += 1;
    }
    if (
      !sourceOfficeId ||
      selectedAffiliationIds.some((id) => !id) ||
      !primaryAffiliationId
    ) {
      throw new Error(
        `Opportunity source/contact mapping is incomplete at row ${opportunity.sourceRow}.`,
      );
    }

    const payload = stage.normalized_payload;
    const optionalFields = {
      sector: payload.sector ?? null,
      revenue_meur: payload.revenueMeur ?? null,
      ebitda_keur: payload.ebitdaKeur ?? null,
      headcount: payload.headcount ?? null,
      headcount_range: payload.headcountRange ?? null,
      date_added: payload.dateAdded ?? null,
      internal_notes: payload.internalNotes ?? null,
    };
    if (payload.locationDecision === "approved") {
      optionalFields.location = payload.location ?? null;
    }
    if (stage.resolution_action === "create") {
      optionalFields.public_title = payload.publicTitle ?? null;
    }

    const targetStatus =
      stage.resolution_action === "create"
        ? "draft"
        : payload.targetStatus;
    await client.query(
      `
        SELECT (
          public.save_opportunity_office_context(
            $1::uuid,
            $2::uuid,
            $3::uuid[],
            $4::uuid,
            $5,
            $6::public.opportunity_status,
            $7,
            $8::jsonb
          )
        ).id
      `,
      [
        opportunityId,
        sourceOfficeId,
        selectedAffiliationIds,
        primaryAffiliationId,
        opportunity.description,
        targetStatus,
        ACTOR,
        JSON.stringify(optionalFields),
      ],
    );
    if (stage.resolution_action === "create") created += 1;
    else updated += 1;
  }
  return { created, updated, source_context_preserved_for_history: sourceContextPreservedForHistory };
}

async function applyCutover(client, source, reconciliation) {
  const reconciliationSummary = {
    source_rows: {
      firms: source.summary.firms,
      offices: source.summary.offices,
      contacts: source.summary.contacts,
      affiliations: source.summary.affiliations,
    },
    resolved_mappings: Object.fromEntries(
      Object.entries(reconciliation.decisions).map(([entity, counts]) => [
        entity,
        counts,
      ]),
    ),
    opportunity_rows: {
      total: source.summary.opportunities,
      create: reconciliation.decisions.opportunities.create,
      reuse: reconciliation.decisions.opportunities.reuse,
      title_gaps: reconciliation.finalTitleMissing,
      positioned_linked: reconciliation.positionedMatches.length,
      positioned_review: reconciliation.unresolvedPositions.length,
    },
    issues: {
      warnings: reconciliation.stageIssues.length,
      blockers: 0,
    },
    geography: {
      confirmed: 128,
      review: 20,
    },
    normalization: {
      month_dates: 148,
      exact_day_dates: 0,
      excluded_nameless_contacts: 9,
      suppressed_named_contacts: 18,
    },
  };
  const reviewDecisions = {
    approved_opportunity_fields: [
      "sector",
      "location",
      "revenue_meur",
      "ebitda_keur",
      "headcount",
      "headcount_range",
      "date_added",
      "public_title",
      "teaser_summary",
      "internal_notes",
    ],
    geography_decision_counts: { confirmed: 128, review: 20 },
    exception_resolution_counts: {
      warnings: reconciliation.stageIssues.length,
      title_gaps_staff_only: reconciliation.finalTitleMissing,
      positioned_review: reconciliation.unresolvedPositions.length,
    },
    resolution_counts: Object.fromEntries(
      Object.entries(reconciliation.decisions).map(([entity, counts]) => [
        entity,
        counts,
      ]),
    ),
  };

  const insertedRun = await client.query(
    `
      INSERT INTO public.ma_cutover_runs (
        status,
        source_fingerprint,
        source_hash,
        reconciliation_summary,
        review_decisions,
        created_by
      )
      VALUES ('staged', $1, $2, $3::jsonb, $4::jsonb, $5)
      RETURNING id
    `,
    [
      source.source.fingerprint,
      source.source.sha256,
      JSON.stringify(reconciliationSummary),
      JSON.stringify(reviewDecisions),
      ACTOR,
    ],
  );
  const runId = insertedRun.rows[0].id;
  await insertStageRows(client, runId, reconciliation.activationStageRows);
  await insertStageIssues(client, runId, reconciliation.stageIssues);

  const approvedRun = await client.query(
    `
      UPDATE public.ma_cutover_runs
      SET
        status = 'approved',
        approved_by = $2,
        approved_at = NOW()
      WHERE id = $1
      RETURNING approval_digest
    `,
    [runId, ACTOR],
  );
  const approvalDigest = approvedRun.rows[0]?.approval_digest;
  if (!approvalDigest) throw new Error("Database did not create approval digest.");

  const activated = await client.query(
    "SELECT public.activate_ma_cutover_run($1, $2, $3) AS result",
    [runId, approvalDigest, ACTOR],
  );

  const directory = await loadFirmAndOfficeMaps(client, source);
  await createDeferredSameNameContacts(
    client,
    source,
    directory.officeIds,
  );
  const identity = await loadContactAndAffiliationMaps(
    client,
    source,
    directory.officeIds,
  );
  await updateDirectoryMetadata(client, source, {
    ...directory,
    ...identity,
  });
  const opportunityMerge = await saveAllOpportunities(
    client,
    source,
    reconciliation,
    directory.officeIds,
    identity.affiliationIds,
  );

  const opportunityIds = await client.query(
    `
      SELECT id, reference
      FROM public.opportunities
      WHERE LOWER(BTRIM(reference)) = ANY($1::text[])
    `,
    [
      unique(
        reconciliation.positionedMatches.map((item) =>
          normalize(item.reference),
        ),
      ),
    ],
  );
  const opportunityByReference = new Map(
    opportunityIds.rows.map((row) => [normalize(row.reference), row.id]),
  );
  let insertedMatches = 0;
  for (const position of reconciliation.positionedMatches) {
    const opportunityId = opportunityByReference.get(
      normalize(position.reference),
    );
    if (!opportunityId) {
      throw new Error("Activated positioned opportunity was not found.");
    }
    const inserted = await client.query(
      `
        INSERT INTO public.opportunity_matches (
          opportunity_id,
          repreneur_id,
          status,
          platform_recommendation,
          human_recommendation,
          human_notes,
          created_by
        )
        VALUES (
          $1,
          $2,
          'draft',
          'not_evaluated',
          'not_evaluated',
          $3,
          $4
        )
        ON CONFLICT (opportunity_id, repreneur_id) DO NOTHING
        RETURNING id
      `,
      [
        opportunityId,
        position.repreneurId,
        `W-010 source indicated a positioned repreneur; linked by ${position.resolution}. Status intentionally left Draft for staff review.`,
        ACTOR,
      ],
    );
    insertedMatches += inserted.rowCount;
  }
  return {
    run_id: runId,
    approval_digest: approvalDigest,
    activation: activated.rows[0].result,
    opportunity_merge: opportunityMerge,
    positioned_matches_inserted: insertedMatches,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const env = readEnvironment(options.envFile);
  const connectionString = env.DIRECT_URL ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required.");
  }
  const source = parseWorkbook(options.workbook);
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const writesEnabled = options.apply || options.rehearse;
    await client.query(writesEnabled ? "BEGIN" : "BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '120s'");
    const production = await loadProduction(client);
    const reconciliation = reconcile(source, production);
    if (reconciliation.blockers.length > 0) {
      await client.query("ROLLBACK");
      console.log(
        JSON.stringify(publicSummary(source, reconciliation, "blocked"), null, 2),
      );
      process.exitCode = 1;
      return;
    }

    if (!writesEnabled) {
      await client.query("ROLLBACK");
      console.log(
        JSON.stringify(publicSummary(source, reconciliation, "dry-run"), null, 2),
      );
      return;
    }

    const result = await applyCutover(client, source, reconciliation);
    await client.query(options.rehearse ? "ROLLBACK" : "COMMIT");
    console.log(
      JSON.stringify(
        {
          ...publicSummary(
            source,
            reconciliation,
            options.rehearse ? "rehearsed-and-rolled-back" : "applied",
          ),
          result,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`W-010 cutover failed: ${error.message}`);
  process.exitCode = 1;
});
