import { createHash } from 'node:crypto';

export const SOURCE_SHA = 'f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3';
export const BATCH_ID = 'v4-source-clarification-2026-09-16';
export const EXPECTED_KINDS = new Map([
  ...[5, 6, 7, 8, 9, 12, 20].map(row => [row, 'closed_history']),
  ...[67, 69, 72].map(row => [row, 'external_history']),
  [71, 'confidential_history'], ...[41, 54, 55, 74].map(row => [row, 'linked_history']), [21, 'reopened'],
]);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const fingerprint = alias => `encode(sha256(convert_to(to_jsonb(${alias})::text,'UTF8')),'hex')`;
function requireThat(condition, code) { if (!condition) throw new Error(`Clarification: ${code}`); }

export function validatePlan(plan) {
  requireThat(plan && /^https:\/\/re-newplatform\.slack\.com\/archives\/C0BRS8B1NF4\/p\d+(?:\?.*)?$/.test(plan.sourceReference), 'source_reference_required');
  requireThat(Array.isArray(plan.rows) && plan.rows.length === 16, 'complete_16_row_plan_required');
  requireThat(new Set(plan.rows.map(r => r.sourceRow)).size === 16, 'duplicate_source_row');
  for (const row of plan.rows) {
    requireThat(EXPECTED_KINDS.get(row.sourceRow) === row.kind, 'unexpected_row_or_treatment');
    requireThat(row.kind === 'linked_history' || row.kind === 'reopened' ? typeof row.targetReference === 'string' && row.targetReference.length > 0 : row.targetReference == null, 'target_reference_invalid');
  }
}

export async function prepareClarifications(client, plan) {
  validatePlan(plan);
  const source = await client.query(`SELECT h.*, ${fingerprint('h')} AS fingerprint
    FROM public.historical_pursuit_import_rows h WHERE source_sha256=$1 ORDER BY source_row`, [SOURCE_SHA]);
  requireThat(source.rowCount === 72, 'complete_v4_source_required');
  const rows = [];
  for (const requested of [...plan.rows].sort((a,b) => a.sourceRow-b.sourceRow)) {
    const h = source.rows.find(r => r.source_row === requested.sourceRow);
    requireThat(h && h.source_sheet === 'Synthese' && h.repreneur_id, 'source_identity_missing');
    const buyer = await client.query(`SELECT r.id,r.is_demo,${fingerprint('r')} AS fingerprint FROM public.repreneurs r WHERE id=$1`, [h.repreneur_id]);
    requireThat(buyer.rowCount === 1, 'buyer_missing');
    let opportunity = null, match = null;
    if (requested.targetReference) {
      const opportunities = await client.query(`SELECT o.id,o.reference,o.status,o.is_demo,${fingerprint('o')} AS fingerprint
        FROM public.opportunities o WHERE reference=$1`, [requested.targetReference]);
      requireThat(opportunities.rowCount === 1, 'target_not_unique');
      opportunity = opportunities.rows[0];
      requireThat(opportunity.status === 'active' && opportunity.is_demo === buyer.rows[0].is_demo, 'target_ineligible');
      const matches = await client.query(`SELECT m.*,${fingerprint('m')} AS fingerprint FROM public.opportunity_matches m WHERE opportunity_id=$1 AND repreneur_id=$2`, [opportunity.id,h.repreneur_id]);
      requireThat(matches.rowCount <= 1, 'duplicate_match');
      match = matches.rows[0] ?? null;
    }
    if (requested.kind === 'linked_history') {
      requireThat(!h.match_id && !h.opportunity_id && !match && h.apply_outcome === 'external_or_missing', 'new_link_is_not_pristine');
      requireThat(h.source_terminal === (requested.sourceRow !== 41), 'terminal_source_changed');
      requireThat(!h.source_terminal || Boolean(h.raw_drop_reason?.trim()), 'terminal_reason_missing');
    } else if (requested.kind === 'reopened') {
      requireThat(!h.source_terminal && match?.status === 'dropped' && h.match_id === match.id && h.opportunity_id === opportunity.id, 'reopen_target_changed');
      const footprint = await client.query(`SELECT
        (SELECT count(*)::int FROM public.opportunity_pursuit_confidential_grants WHERE match_id=$1 AND revoked_at IS NULL) AS grants,
        (SELECT count(*)::int FROM public.opportunity_pursuit_evidence WHERE match_id=$1) AS evidence`, [match.id]);
      requireThat(footprint.rows[0].grants === 0 && footprint.rows[0].evidence === 0, 'reopen_has_new_workflow_evidence');
    } else {
      requireThat(!h.match_id && !h.opportunity_id && h.apply_outcome === 'external_or_missing', 'history_only_row_already_linked');
      if (requested.kind === 'closed_history') requireThat(h.source_terminal, 'closed_history_not_terminal');
    }
    rows.push({ ...requested, ledgerId:h.id, ledgerFingerprint:h.fingerprint, repreneurId:h.repreneur_id,
      repreneurFingerprint:buyer.rows[0].fingerprint, opportunityId:opportunity?.id ?? null,
      opportunityFingerprint:opportunity?.fingerprint ?? null, matchId:match?.id ?? null,
      matchFingerprint:match?.fingerprint ?? null });
  }
  const ledger = await client.query(`SELECT encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(h)::text,'|' ORDER BY h.id),''),'UTF8')),'hex') AS fingerprint FROM public.historical_pursuit_import_rows h`);
  return { version:1, sourceReference:plan.sourceReference, sourceSha:SOURCE_SHA, ledgerFingerprint:ledger.rows[0].fingerprint, rows };
}

async function unchangedDomain(client, excludedMatches = []) {
  const result = await client.query(`SELECT
    (SELECT encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(h)::text,'|' ORDER BY h.id),''),'UTF8')),'hex') FROM public.historical_pursuit_import_rows h) AS ledger,
    (SELECT encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(o)::text,'|' ORDER BY o.id),''),'UTF8')),'hex') FROM public.opportunities o) AS opportunities,
    (SELECT encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(m)::text,'|' ORDER BY m.id),''),'UTF8')),'hex') FROM public.opportunity_matches m WHERE NOT(m.id=ANY($1::uuid[]))) AS matches,
    (SELECT count(*) FROM public.opportunity_pursuit_confidential_grants) AS grants,
    (SELECT count(*) FROM public.opportunity_nda_artifacts) AS artifacts,
    (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications) AS notifications,
    (SELECT count(*) FROM public.opportunity_pursuit_events) AS stage_events,
    (SELECT count(*) FROM public.opportunity_pursuit_evidence) AS evidence`, [excludedMatches]);
  return result.rows[0];
}

export async function readbackClarifications(client, manifest, manifestDigest) {
  const batch = await client.query('SELECT * FROM public.pursuit_v4_clarification_batches WHERE id=$1', [BATCH_ID]);
  requireThat(batch.rowCount === 1 && batch.rows[0].manifest_sha256 === manifestDigest && digest(batch.rows[0].manifest) === digest(manifest), 'batch_evidence_mismatch');
  const corrections = await client.query('SELECT * FROM public.pursuit_v4_clarifications WHERE batch_id=$1 ORDER BY ledger_id', [BATCH_ID]);
  requireThat(corrections.rowCount === 16, 'incomplete_readback');
  const now = await unchangedDomain(client);
  requireThat(now.ledger === manifest.ledgerFingerprint, 'original_ledger_changed');
  for (const row of manifest.rows) {
    const c = corrections.rows.find(item => item.ledger_id === row.ledgerId);
    requireThat(c && c.outcome === row.kind && c.opportunity_id === row.opportunityId, 'resolution_readback_mismatch');
    if (!c.match_id) continue;
    const result = await client.query(`SELECT m.*,${fingerprint('m')} AS fingerprint FROM public.opportunity_matches m WHERE id=$1`, [c.match_id]);
    const m = result.rows[0];
    requireThat(m && m.fingerprint === c.after_match_sha256 && m.repreneur_id === row.repreneurId && m.opportunity_id === row.opportunityId, 'match_readback_drift');
    const expectedStatus = row.kind === 'reopened' ? 'interested' : row.sourceRow === 41 ? 'draft' : 'dropped';
    requireThat(m.status === expectedStatus && m.pursuit_stage == null, 'unexpected_current_stage');
    if (row.kind === 'reopened') {
      const evidence = await client.query('SELECT event_type,match_id FROM public.opportunity_pursuit_evidence WHERE id=$1',[c.reopen_evidence_id]);
      requireThat(evidence.rows[0]?.event_type === 'reopened' && evidence.rows[0].match_id === m.id, 'reopen_evidence_missing');
    } else requireThat(m.nda_status === 'not_required' && !m.interest_expressed_at && !m.recommendation_published_at && !m.nda_document_id, 'fabricated_workflow');
  }
  return { resolved:16, linked:4, historyOnly:11, reopened:1, originalLedgerUnchanged:true };
}

/** Caller owns BEGIN/COMMIT, retained private manifest and final approval digest. */
export async function applyClarifications(client, manifest, manifestDigest, actor) {
  requireThat(digest(manifest) === manifestDigest, 'approved_digest_mismatch');
  const staff = await client.query("SELECT user_id FROM public.app_user_roles WHERE user_id=$1 AND role='staff'",[actor]);
  requireThat(staff.rowCount === 1, 'staff_required');
  await client.query('LOCK TABLE public.pursuit_v4_clarification_batches, public.pursuit_v4_clarifications, public.opportunity_matches IN SHARE ROW EXCLUSIVE MODE');
  const existing = await client.query('SELECT manifest_sha256 FROM public.pursuit_v4_clarification_batches WHERE id=$1',[BATCH_ID]);
  if (existing.rowCount) return { ...await readbackClarifications(client,manifest,manifestDigest), replay:true };
  // Lock every referenced identity before re-deriving the complete private plan.
  await client.query('SELECT id FROM public.repreneurs WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[manifest.rows.map(r => r.repreneurId)]);
  await client.query('SELECT id FROM public.opportunities WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[manifest.rows.map(r => r.opportunityId).filter(Boolean)]);
  const fresh = await prepareClarifications(client,{sourceReference:manifest.sourceReference,rows:manifest.rows.map(({sourceRow,kind,targetReference}) => ({sourceRow,kind,targetReference}))});
  requireThat(digest(fresh) === manifestDigest, 'live_state_or_plan_changed');
  const oldMatchIds = manifest.rows.map(r => r.matchId).filter(Boolean);
  const before = await unchangedDomain(client,oldMatchIds);
  await client.query('INSERT INTO public.pursuit_v4_clarification_batches(id,manifest_sha256,manifest,source_reference,applied_by) VALUES($1,$2,$3,$4,$5)',[BATCH_ID,manifestDigest,manifest,manifest.sourceReference,actor]);
  const changedMatchIds = [...oldMatchIds];
  for (const row of manifest.rows) {
    let matchId = row.matchId, beforeMatch = null, evidenceId = null;
    if (row.kind === 'linked_history') {
      const inserted = await client.query(`INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by,decline_reason_categories,decline_reason_text)
        SELECT $1,$2,CASE WHEN source_terminal THEN 'dropped'::public.opportunity_match_status ELSE 'draft'::public.opportunity_match_status END,$3,
        CASE WHEN source_terminal THEN ARRAY['other']::text[] ELSE ARRAY[]::text[] END,CASE WHEN source_terminal THEN raw_drop_reason ELSE NULL END
        FROM public.historical_pursuit_import_rows WHERE id=$4 RETURNING id`,[row.opportunityId,row.repreneurId,actor,row.ledgerId]);
      matchId = inserted.rows[0].id; changedMatchIds.push(matchId);
    } else if (row.kind === 'reopened') {
      beforeMatch = (await client.query('SELECT to_jsonb(m) AS value FROM public.opportunity_matches m WHERE id=$1',[matchId])).rows[0].value;
      evidenceId = (await client.query("SELECT public.journey_transition_terminal($1,'reopen',$2,$3,NULL) AS id",[matchId,actor,`${BATCH_ID}:${row.ledgerId}`])).rows[0].id;
    }
    const after = matchId ? (await client.query(`SELECT status,${fingerprint('m')} AS fingerprint FROM public.opportunity_matches m WHERE id=$1`,[matchId])).rows[0] : null;
    await client.query(`INSERT INTO public.pursuit_v4_clarifications(ledger_id,batch_id,outcome,opportunity_id,match_id,resolved_reference,before_match,after_match_sha256,mapped_match_status,reopen_evidence_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[row.ledgerId,BATCH_ID,row.kind,row.opportunityId,matchId,row.targetReference??null,beforeMatch,after?.fingerprint??null,after?.status??null,evidenceId]);
  }
  const after = await unchangedDomain(client,changedMatchIds);
  requireThat(BigInt(after.evidence) === BigInt(before.evidence)+1n,'unexpected_evidence_change');
  delete before.evidence; delete after.evidence;
  requireThat(JSON.stringify(before) === JSON.stringify(after),'unrelated_domain_changed');
  return readbackClarifications(client,manifest,manifestDigest);
}
