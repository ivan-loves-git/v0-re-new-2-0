import crypto from "node:crypto";

export const HISTORICAL_PURSUIT_MANIFEST_VERSION = 1;

export function normalizeIdentity(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}

export function normalizedReference(value) {
  const tokens = normalizeIdentity(value).split(" ").filter(Boolean);
  if (tokens.length !== 4 || tokens[0] !== "re" || tokens[1] !== "new") return null;
  const [region, sequence] = tokens.slice(2);
  if (!/^[a-z]{2,3}$/.test(region) || !/^\d{1,3}$/.test(sequence)) return null;
  return `re-new-${region}-${sequence.padStart(3, "0")}`;
}

function indexUnique(items, key) {
  const index = new Map();
  for (const item of items ?? []) {
    const itemKey = key(item);
    if (!itemKey) continue;
    const entries = index.get(itemKey) ?? [];
    entries.push(item);
    index.set(itemKey, entries);
  }
  return index;
}

function historicalDisposition(row) {
  const hasTerminalMarker = row.notApplicableSourceStages.length > 0;
  if (row.dropReason && hasTerminalMarker) return "historical_dropped_or_closed";
  if (row.dropReason) return "review_reason_without_terminal_marker";
  if (hasTerminalMarker) return "review_terminal_marker_without_reason";
  return "historical_open_or_unknown";
}

export function reconcileHistoricalPursuits(source, snapshot) {
  if (!Array.isArray(source?.rows) || source.rows.length !== 60) {
    throw new Error("Source must contain exactly 60 historical pursuit rows.");
  }
  if (!Array.isArray(snapshot?.repreneurs) || !Array.isArray(snapshot?.opportunities) || !Array.isArray(snapshot?.matches)) {
    throw new Error("Snapshot must contain repreneurs[], opportunities[] and matches[].");
  }

  const buyers = indexUnique(snapshot.repreneurs, (buyer) =>
    normalizeIdentity(`${buyer.first_name ?? ""} ${buyer.last_name ?? ""}`),
  );
  const opportunities = indexUnique(snapshot.opportunities, (opportunity) =>
    normalizedReference(opportunity.reference),
  );
  const currentMatches = new Set(
    snapshot.matches.map((match) => `${match.opportunity_id}:${match.repreneur_id}`),
  );
  const canonicalSourceRows = source.rows.filter((row) => normalizedReference(row.opportunityReference));
  if (canonicalSourceRows.length !== 46 || source.rows.length - canonicalSourceRows.length !== 14) {
    throw new Error("Approved workbook shape changed: expected 46 Re-New references and 14 external or missing references.");
  }
  const records = [];
  const reviewQueue = [];

  for (const row of source.rows) {
    const buyerCandidates = buyers.get(normalizeIdentity(row.repreneurName)) ?? [];
    const sourceReferenceKey = normalizedReference(row.opportunityReference);
    const opportunityCandidates = sourceReferenceKey
      ? opportunities.get(sourceReferenceKey) ?? []
      : [];
    const blockers = [];
    const reviewFlags = [];
    if (!sourceReferenceKey) blockers.push("external_or_missing_opportunity_reference");
    if (buyerCandidates.length !== 1) blockers.push(
      buyerCandidates.length === 0 ? "buyer_not_found" : "buyer_identity_ambiguous",
    );
    if (sourceReferenceKey && opportunityCandidates.length !== 1) blockers.push(
      opportunityCandidates.length === 0 ? "opportunity_not_found" : "opportunity_reference_ambiguous",
    );
    const disposition = historicalDisposition(row);
    if (disposition.startsWith("review_")) reviewFlags.push(disposition);

    const resolved = blockers.length === 0;
    const pairKey = resolved ? `${opportunityCandidates[0].id}:${buyerCandidates[0].id}` : null;
    const proposedApply = !resolved
      ? { allowed: false, action: "none" }
      : currentMatches.has(pairKey)
        ? { allowed: true, action: "merge_historical_staff_note", currentMatchExists: true }
        : { allowed: true, action: "create_draft_match_with_historical_staff_note", currentMatchExists: false, status: "draft" };
    const record = {
      sourceRow: row.sourceRow,
      sourceFingerprint: crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"),
      resolution: resolved ? "resolved_for_staff_review" : "unresolved_fail_closed",
      blockers,
      reviewFlags,
      buyer: resolved ? { id: buyerCandidates[0].id, name: row.repreneurName } : null,
      opportunity: resolved ? { id: opportunityCandidates[0].id, reference: opportunityCandidates[0].reference } : null,
      historicalProposal: {
        opportunityReference: row.opportunityReference ?? null,
        offerLabel: row.offerLabel ?? null,
        disposition,
        completedSourceStages: row.completedSourceStages,
        notApplicableSourceStages: row.notApplicableSourceStages,
        dropReason: row.dropReason ?? null,
      },
      // This intentionally contains no field that can be passed directly to
      // active_pursuit, NDA/artifact, memo, disclosure or opportunity closure APIs.
      laterApply: proposedApply,
    };
    records.push(record);
    if (!resolved || reviewFlags.length > 0) reviewQueue.push(record);
  }

  const summary = records.reduce((counts, record) => {
    counts[record.resolution] = (counts[record.resolution] ?? 0) + 1;
    return counts;
  }, {});
  const safeApplySummary = records.reduce((counts, record) => {
    const action = record.laterApply.action;
    counts[action] = (counts[action] ?? 0) + 1;
    return counts;
  }, {});
  if (
    summary.resolved_for_staff_review !== 46 ||
    summary.unresolved_fail_closed !== 14 ||
    safeApplySummary.create_draft_match_with_historical_staff_note !== 33 ||
    safeApplySummary.merge_historical_staff_note !== 13
  ) {
    throw new Error(
      `Live mapping drift: expected 46 resolved (33 create, 13 merge) and 14 unresolved; got ${JSON.stringify({ summary, safeApplySummary })}`,
    );
  }
  return {
    manifestVersion: HISTORICAL_PURSUIT_MANIFEST_VERSION,
    source: source.source,
    snapshotDigest: crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    generatedAt: new Date().toISOString(),
    summary,
    safeApplySummary,
    records,
    reviewQueue,
  };
}
