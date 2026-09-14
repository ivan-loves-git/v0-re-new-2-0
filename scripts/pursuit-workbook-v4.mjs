import crypto from "node:crypto";
import { normalizeIdentity, normalizedReference } from "./historical-pursuit-manifest.mjs";

export const V4_SOURCE_SHA = "f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3";
export const V4_STAGES = ["interest_confirmed", "nda_received", "nda_signed", "info_memo_received", "qa_with_ma_firm", "seller_meeting", "valuation", "loi_issued", "audits", "financing", "closing"];
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
// Released historical-import safety predicate plus current notification/window fields.
// SQL identifiers are fixed; this is never built from user-supplied input.
export const V4_PRISTINE_MATCH_SQL = `m.pursuit_stage IS NULL AND m.nda_status='not_required' AND m.nda_document_id IS NULL
  AND m.nda_received_at IS NULL AND m.nda_signed_at IS NULL AND m.nda_waived_at IS NULL
  AND m.pursuit_stage_notes IS NULL AND m.pursuit_stage_updated_by IS NULL AND m.pursuit_stage_updated_at IS NULL
  AND m.nda_notes IS NULL AND m.nda_updated_by IS NULL AND m.nda_updated_at IS NULL AND m.nda_waived_by IS NULL
  AND m.interest_expressed_at IS NULL AND m.interest_notification_sent_at IS NULL
  AND COALESCE(cardinality(m.decline_reason_categories),0)=0 AND m.decline_reason_text IS NULL
  AND m.human_recommendation='not_evaluated' AND m.reviewed_by IS NULL AND m.reviewed_at IS NULL
  AND m.recommendation_published_at IS NULL AND m.recommendation_expires_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence e WHERE e.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts a WHERE a.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_events e WHERE e.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_recommendation_assignment_notifications n WHERE n.match_id=m.id)`;

const lengthPrefixed = (value) => value == null ? "-1:" : `${Buffer.byteLength(value, "utf8")}:${value}`;
const fieldDigest = (fields) => sha256(fields.map(([key, value]) => `${lengthPrefixed(key)}${lengthPrefixed(value)}`).join(""));

/** The frozen V3 digest format is reused, not its source binding or apply endpoint. */
export function v4ApplyRows(manifest, source) {
  return manifest.records.map((record, index) => {
    const row = source.rows[index];
    if (row.sourceRow !== record.sourceRow || sha256(JSON.stringify(row)) !== record.sourceFingerprint) throw new Error("Manifest source row changed.");
    const payloadDigest = fieldDigest([
      ["repreneur_name", row.repreneurName], ["offer_label", row.offerLabel], ["opportunity_reference", row.opportunityReference],
      ["completed_source_stages", JSON.stringify(row.completedSourceStages)], ["not_applicable_source_stages", JSON.stringify(row.notApplicableSourceStages)], ["raw_drop_reason", row.dropReason],
      ...V4_STAGES.map((stage) => [`source_cells.${stage}`, row.sourceCells[stage]]),
    ]);
    const approvalDigest = fieldDigest([["fingerprint", record.sourceFingerprint], ["source_payload_digest", payloadDigest],
      ["repreneur", record.buyer?.id ?? null], ["opportunity", record.opportunity?.id ?? null],
      ["blockers", JSON.stringify(record.blockers)], ["flags", JSON.stringify(record.reviewFlags)]]);
    return { ...row, repreneurId: record.buyer?.id ?? null, opportunityId: record.opportunity?.id ?? null,
      fingerprint: record.sourceFingerprint, payloadDigest, approvalDigest, blockers: record.blockers, flags: record.reviewFlags,
      expectedMatchExists: record.expectedMatchExists, expectedMatchFingerprint: record.expectedMatchFingerprint };
  });
}

export function reconcilePursuitWorkbookV4(source, snapshot) {
  if (source?.source?.sha256 !== V4_SOURCE_SHA || source.source.sheet !== "Synthese"
    || source.rows?.length !== 72 || source.rows.some((row, index) => row.sourceRow !== index + 3)) {
    throw new Error("Expected the exact V4 source, Synthese rows 3–74.");
  }
  if (![snapshot?.repreneurs, snapshot?.opportunities, snapshot?.matches].every(Array.isArray)) throw new Error("Incomplete read-only WAVE snapshot.");
  const sourcePairs = new Set();
  const records = source.rows.map((row) => {
    if (!row.repreneurName?.trim()) throw new Error(`Missing repreneur at source row ${row.sourceRow}.`);
    const cells = V4_STAGES.map((stage) => String(row.sourceCells?.[stage] ?? "").trim().toLowerCase());
    const firstTail = cells.findIndex((value) => value !== "oui");
    const tail = firstTail === -1 ? [] : cells.slice(firstTail);
    const terminal = tail[0] === "n/a";
    const completed = V4_STAGES.filter((_, index) => cells[index] === "oui");
    const unavailable = V4_STAGES.filter((_, index) => cells[index] === "n/a");
    if (tail.some((value) => value !== (terminal ? "n/a" : ""))
      || JSON.stringify(completed) !== JSON.stringify(row.completedSourceStages)
      || JSON.stringify(unavailable) !== JSON.stringify(row.notApplicableSourceStages)) {
      throw new Error(`Invalid V4 stage sequence at source row ${row.sourceRow}.`);
    }
    if (terminal !== Boolean(row.dropReason?.trim())) throw new Error(`V4 terminal/reason mismatch at source row ${row.sourceRow}.`);
    const sourcePair = `${normalizeIdentity(row.repreneurName)}:${normalizeIdentity(row.opportunityReference)}`;
    if (sourcePairs.has(sourcePair)) throw new Error(`Duplicate source pair at row ${row.sourceRow}.`);
    sourcePairs.add(sourcePair);
    const buyers = snapshot.repreneurs.filter((buyer) => normalizeIdentity(`${buyer.first_name} ${buyer.last_name}`) === normalizeIdentity(row.repreneurName));
    const reference = normalizedReference(row.opportunityReference);
    const opportunities = reference ? snapshot.opportunities.filter((opportunity) => normalizedReference(opportunity.reference) === reference) : [];
    const blockers = [];
    const reviewFlags = [];
    if (buyers.length !== 1) blockers.push(buyers.length ? "buyer_identity_ambiguous" : "buyer_not_found");
    if (!reference) blockers.push("external_or_missing_opportunity_reference");
    else if (opportunities.length !== 1) blockers.push(opportunities.length ? "opportunity_reference_ambiguous" : "opportunity_not_found");
    const buyer = buyers.length === 1 ? buyers[0] : null;
    const opportunity = opportunities.length === 1 ? opportunities[0] : null;
    if (buyer && opportunity && buyer.is_demo !== opportunity.is_demo) blockers.push("namespace_mismatch");
    const pairs = buyer && opportunity ? snapshot.matches.filter((match) => match.repreneur_id === buyer.id && match.opportunity_id === opportunity.id) : [];
    if (pairs.length > 1) blockers.push("pair_ambiguous");
    const existing = pairs.length === 1 ? pairs[0] : null;
    if (opportunity && opportunity.status !== "active") {
      if (existing) reviewFlags.push("historical_opportunity_status_preserved");
      else blockers.push("opportunity_not_active");
    }
    if (existing?.status === "draft" && terminal && (!existing.pristine || opportunity?.status !== "active")) reviewFlags.push("existing_draft_workflow_preserved");
    if (existing?.status === "dropped" && !terminal) reviewFlags.push("source_active_current_dropped");
    if (opportunity && snapshot.matches.some((match) => match.opportunity_id === opportunity.id && match.repreneur_id !== buyer?.id)) reviewFlags.push("other_repreneur_pair_preserved");
    if (existing && existing.status !== "draft") reviewFlags.push("current_status_preserved");
    const permitted = blockers.length === 0;
    return {
      sourceRow: row.sourceRow, sourceFingerprint: sha256(JSON.stringify(row)), blockers, reviewFlags,
      buyer: buyer ? { id: buyer.id, name: row.repreneurName } : null,
      // A blocked target remains a locator in the source facts, never an apply ID.
      opportunity: permitted ? { id: opportunity.id, reference: opportunity.reference } : null,
      expectedMatchFingerprint: permitted ? existing?.fingerprint ?? null : null,
      expectedMatchExists: permitted && Boolean(existing),
      historicalProposal: { offerLabel: row.offerLabel, opportunityReference: row.opportunityReference,
        completedSourceStages: row.completedSourceStages, notApplicableSourceStages: row.notApplicableSourceStages, dropReason: row.dropReason },
      laterApply: !permitted ? { action: "none" } : { action: existing ? "merge_historical_match" : "create_historical_match", desiredStatus: terminal ? "dropped" : "draft" },
      changesExistingStatus: permitted && terminal && existing?.status === "draft" && existing.pristine === true && opportunity?.status === "active",
    };
  });
  return { manifestVersion: 4, source: source.source, manifestDigest: sha256(JSON.stringify(source.rows)), records,
    summary: records.reduce((totals, row) => { totals[row.laterApply.action] = (totals[row.laterApply.action] ?? 0) + 1; return totals; }, {}),
    existingDraftDrops: records.filter((row) => row.changesExistingStatus).length,
  };
}
