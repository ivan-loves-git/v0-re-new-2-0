import { createHash } from 'node:crypto';

export const SOURCE_SHA = 'f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3';
export const BATCH_ID = 'v4-ongoing-pursuit-progress-2026-09-18';
export const EXPECTED_STAGES = new Map([
  [11, 'info_memo_received'], [14, 'qa_with_ma_firm'], [21, 'seller_meeting'], [33, 'loi_issued'],
  [34, 'seller_meeting'], [36, 'info_memo_received'], [38, 'interest_confirmed'], [39, 'interest_confirmed'],
  [40, 'info_memo_received'], [41, 'info_memo_received'], [50, 'qa_with_ma_firm'], [57, 'nda_signed'],
  [58, 'interest_confirmed'], [61, 'qa_with_ma_firm'], [62, 'nda_signed'], [65, 'qa_with_ma_firm'],
  [68, 'loi_issued'], [73, 'loi_issued'],
]);
const requireThat = (condition, code) => { if (!condition) throw new Error(`Pursuit progress catch-up: ${code}`) };
const fingerprint = alias => `encode(sha256(convert_to(to_jsonb(${alias})::text,'UTF8')),'hex')`;

export async function preparePursuitProgressCatchup(client) {
  const source = await client.query(`SELECT h.id AS ledger_id,h.source_row,h.last_reported_source_stage,h.source_terminal,h.match_id,
      m.status::text AS status,m.opportunity_id,${fingerprint('m')} AS match_fingerprint,
      o.status::text AS opportunity_status,o.is_demo AS opportunity_demo,r.is_demo AS repreneur_demo,
      (SELECT count(*) FROM public.opportunity_matches x WHERE x.opportunity_id=m.opportunity_id AND x.status='active_pursuit' AND x.id<>m.id) AS other_active,
      (SELECT count(*) FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=m.id AND g.revoked_at IS NULL) AS live_grants,
      public.pursuit_progress_catchup_children_sha(m.id) AS children_fingerprint
    FROM public.historical_pursuit_resolved_rows h JOIN public.opportunity_matches m ON m.id=h.match_id
    JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.repreneurs r ON r.id=m.repreneur_id
    WHERE h.source_sha256=$1 AND h.source_row=ANY($2::int[]) ORDER BY h.source_row`, [SOURCE_SHA, [...EXPECTED_STAGES.keys()]]);
  requireThat(source.rowCount === 18, 'exact_target_rows_required');
  const opportunityIds = new Set();
  const rows = source.rows.map(row => {
    requireThat(EXPECTED_STAGES.get(row.source_row) === row.last_reported_source_stage && !row.source_terminal, 'source_stage_changed');
    requireThat(['draft','interested','active_pursuit'].includes(row.status), 'unexpected_status');
    requireThat(row.opportunity_status === 'active' && row.opportunity_demo === false && row.repreneur_demo === false, 'target_ineligible');
    requireThat(Number(row.other_active) === 0 && Number(row.live_grants) === 0, 'live_conflict');
    requireThat(!opportunityIds.has(row.opportunity_id), 'duplicate_opportunity'); opportunityIds.add(row.opportunity_id);
    return { sourceRow: row.source_row, sourceStage: row.last_reported_source_stage, ledgerId: row.ledger_id,
      matchId: row.match_id, opportunityId: row.opportunity_id, expectedStatus: row.status,
      matchFingerprint: row.match_fingerprint, childrenFingerprint: row.children_fingerprint };
  });
  return { version: 1, batchId: BATCH_ID, sourceSha: SOURCE_SHA, rows };
}

export async function postgresManifestDigest(client, manifest) {
  const result = await client.query("SELECT encode(extensions.digest(convert_to($1::jsonb::text,'UTF8'),'sha256'),'hex') AS digest", [JSON.stringify(manifest)]);
  return result.rows[0].digest;
}

export async function applyPursuitProgressCatchup(client, manifest, actor) {
  // A successful prior batch is an idempotent replay path: its retained
  // after-image (not a freshly preparable pre-image) is the authoritative
  // proof. The SQL operator validates the supplied immutable manifest.
  const existing = await client.query('SELECT 1 FROM public.pursuit_progress_catchup_batches WHERE id=$1', [BATCH_ID]);
  if (!existing.rowCount) {
    const fresh = await preparePursuitProgressCatchup(client);
    requireThat(JSON.stringify(fresh) === JSON.stringify(manifest), 'live_state_or_plan_changed');
  }
  const result = await client.query('SELECT public.apply_pursuit_progress_catchup($1::jsonb,$2) AS result', [JSON.stringify(manifest), actor]);
  await readbackPursuitProgressCatchup(client, manifest);
  return result.rows[0].result;
}

export async function readbackPursuitProgressCatchup(client, manifest) {
  const result = await client.query(`SELECT r.source_row,r.ledger_id::text,r.match_id::text,r.opportunity_id::text,r.source_stage,r.target_stage::text,
      r.after_match_sha256,r.after_children_sha256,public.pursuit_progress_catchup_children_sha(r.match_id) AS children_sha,
      encode(sha256(convert_to(to_jsonb(m)::text,'UTF8')),'hex') AS match_sha,
      m.status::text,m.pursuit_stage::text,m.pursuit_stage_provenance,h.source_sha256,h.source_terminal,h.last_reported_source_stage
    FROM public.pursuit_progress_catchup_receipts r
    JOIN public.opportunity_matches m ON m.id=r.match_id
    JOIN public.historical_pursuit_import_rows h ON h.id=r.ledger_id
    WHERE r.batch_id=$1 ORDER BY r.source_row`, [BATCH_ID]);
  requireThat(result.rowCount === 18, 'receipt_count_changed');
  for (const row of result.rows) {
    const expected = manifest.rows.find(candidate => candidate.sourceRow === row.source_row);
    requireThat(Boolean(expected), 'unexpected_receipt');
    requireThat(row.ledger_id === expected.ledgerId && row.match_id === expected.matchId && row.opportunity_id === expected.opportunityId, 'receipt_identity_changed');
    requireThat(row.source_sha256 === SOURCE_SHA && row.source_terminal === false && row.last_reported_source_stage === expected.sourceStage, 'source_ledger_changed');
    requireThat(row.status === 'active_pursuit' && row.pursuit_stage === ({
      interest_confirmed:'interest', nda_signed:'nda_signed', info_memo_received:'info_memo_received', qa_with_ma_firm:'qa_with_ma_firm', seller_meeting:'seller_meeting', loi_issued:'loi',
    })[expected.sourceStage] && row.pursuit_stage_provenance === 'staff_confirmed_history', 'current_projection_changed');
    requireThat(row.match_sha === row.after_match_sha256 && row.children_sha === row.after_children_sha256, 'after_image_changed');
  }
  return {readback:true,rows:18};
}

export async function compensatePursuitProgressCatchup(client, actor, reason) {
  const result = await client.query('SELECT public.compensate_pursuit_progress_catchup($1,$2) AS result', [actor, reason]);
  return result.rows[0].result;
}
