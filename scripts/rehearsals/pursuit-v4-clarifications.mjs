import assert from 'node:assert/strict';
import pg from 'pg';
import { SOURCE_SHA, EXPECTED_KINDS, prepareClarifications, applyClarifications, readbackClarifications, digest } from '../pursuit-v4-clarifications.mjs';

const port = Number(process.argv[2]);
assert(Number.isInteger(port) && port > 1024);
const client = new pg.Client({host:'127.0.0.1',port,database:'clarification_test',user:'renew_test'});
const uuid = (prefix,row) => `${prefix}000000-0000-4000-8000-${String(row).padStart(12,'0')}`;
const plan = {sourceReference:'https://re-newplatform.slack.com/archives/C0BRS8B1NF4/p1234567890',rows:[...EXPECTED_KINDS].map(([sourceRow,kind]) => ({sourceRow,kind,...(['linked_history','reopened'].includes(kind)?{targetReference:`Synthetic target ${sourceRow}`}:{})}))};
async function rejectTransaction(action, pattern) {
  await client.query('BEGIN');
  try { await assert.rejects(action,pattern); } finally { await client.query('ROLLBACK'); }
}
try {
  await client.connect(); await client.query("SET TIME ZONE 'UTC'");
  // Fixture loading alone bypasses imported snapshot guards. Every tested action
  // below runs with normal triggers, role privileges and RLS enabled.
  await client.query("BEGIN; SET LOCAL session_replication_role=replica");
  await client.query("INSERT INTO public.app_user_roles(user_id,email,role) VALUES('clarification-test-staff','staff@example.invalid','staff')");
  await client.query('INSERT INTO public.wave_journey_settings(singleton,enabled) VALUES(true,true) ON CONFLICT(singleton) DO UPDATE SET enabled=true');
  await client.query("INSERT INTO public.ma_firms(id,name,status,created_by) VALUES('24000000-0000-4000-8000-000000000001','Synthetic firm','active','fixture'); INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES('24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','Synthetic office','active',false,'fixture')");
  for(let row=3;row<=74;row++) {
    const buyer=uuid('a1',row), opportunity=uuid('a2',row), match=uuid('a3',row);
    await client.query("INSERT INTO public.repreneurs(id,first_name,last_name,email,is_demo,created_by) VALUES($1,'Synthetic',$2,$3,false,'fixture')",[buyer,`Buyer ${row}`,`synthetic-${row}@example.invalid`]);
    if([21,41,54,55,74].includes(row)) await client.query("INSERT INTO public.opportunities(id,reference,status,is_demo,description,source_office_id,created_by) VALUES($1,$2,'active',false,'Synthetic original','24000000-0000-4000-8000-000000000002','fixture')",[opportunity,`Synthetic target ${row}`]);
    if(row===21) await client.query("INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by,human_notes,decline_reason_categories,decline_reason_text) VALUES($1,$2,$3,'dropped','fixture','Preserve the staff note',ARRAY['other'],'Prior reason retained')",[match,opportunity,buyer]);
    const terminal=![21,41,67,69,71,72].includes(row);
    await client.query(`INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_opportunity_reference,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,repreneur_id,opportunity_id,match_id,last_reported_source_stage,source_terminal,raw_drop_reason,apply_outcome,mapped_match_status,applied_by,resolution_blockers,review_flags)
      VALUES($1,'Synthese',$2,$3,$4,'{}',repeat('a',64),repeat('b',64),repeat('c',64),$5,$6,$7,'seller_meeting',$8,$9,$10,$11,'fixture',$12,$13)`,[SOURCE_SHA,row,`Synthetic Buyer ${row}`,`Original reference ${row}`,buyer,row===21?opportunity:null,row===21?match:null,terminal,terminal?'Synthetic withdrawal':null,row===21?'merged':'external_or_missing',row===21?'dropped':null,row===21?[]:['opportunity_not_found'],row===21?['source_active_current_dropped']:[]]);
  }
  await client.query("INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,last_reported_source_stage,source_terminal,apply_outcome,applied_by) VALUES(repeat('3',64),'V3',3,'Old source','{}',repeat('a',64),repeat('b',64),repeat('c',64),'none',false,'external_or_missing','fixture')");
  await client.query('COMMIT');
  const manifest = await prepareClarifications(client,plan), approved = digest(manifest);
  await rejectTransaction(()=>applyClarifications(client,manifest,approved,'not-staff'),/staff_required/);
  await rejectTransaction(()=>applyClarifications(client,manifest,'0'.repeat(64),'clarification-test-staff'),/approved_digest_mismatch/);
  await rejectTransaction(async()=>{
    await client.query("UPDATE public.opportunity_matches SET human_notes='Later staff edit' WHERE id=$1",[uuid('a3',21)]);
    await applyClarifications(client,manifest,approved,'clarification-test-staff');
  },/live_state_or_plan_changed/);
  await rejectTransaction(async()=>{
    await client.query('UPDATE public.opportunities SET is_demo=true WHERE id=$1',[uuid('a2',41)]);
    await applyClarifications(client,manifest,approved,'clarification-test-staff');
  },/target_ineligible/);
  await rejectTransaction(async()=>{
    await client.query("CREATE FUNCTION public.synthetic_fail_late() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.outcome='confidential_history' THEN RAISE EXCEPTION 'synthetic_late_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_fail_late BEFORE INSERT ON public.pursuit_v4_clarifications FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_late()");
    await applyClarifications(client,manifest,approved,'clarification-test-staff');
  },/synthetic_late_failure/);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.pursuit_v4_clarification_batches')).rows[0].n,0);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.opportunity_matches')).rows[0].n,1);
  await client.query('BEGIN');
  assert.deepEqual(await applyClarifications(client,manifest,approved,'clarification-test-staff'),{resolved:16,linked:4,historyOnly:11,reopened:1,originalLedgerUnchanged:true});
  await client.query('COMMIT');
  await readbackClarifications(client,manifest,approved);
  await client.query('BEGIN');
  assert.equal((await applyClarifications(client,manifest,approved,'clarification-test-staff')).replay,true);
  await client.query('COMMIT');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM public.opportunity_pursuit_evidence')).rows[0].n,1);
  const reopened=(await client.query('SELECT * FROM public.opportunity_matches WHERE id=$1',[uuid('a3',21)])).rows[0];
  assert.equal(reopened.human_notes,'Preserve the staff note'); assert.equal(reopened.decline_reason_text,'Prior reason retained');
  for(const role of ['anon','authenticated','service_role']) {
    await rejectTransaction(async()=>{await client.query(`SET LOCAL ROLE ${role}`); await client.query('SELECT * FROM public.pursuit_v4_clarifications');},/permission denied/);
  }
  for(const role of ['anon','authenticated']) await rejectTransaction(async()=>{await client.query(`SET LOCAL ROLE ${role}`); await client.query('SELECT * FROM public.historical_pursuit_resolved_rows_for_staff(NULL)');},/permission denied/);
  for(const role of ['anon','authenticated']) await rejectTransaction(async()=>{await client.query(`SET LOCAL ROLE ${role}`); await client.query('SELECT * FROM public.historical_pursuit_resolved_rows');},/permission denied/);
  await client.query('SET ROLE service_role');
  const projected=(await client.query('SELECT * FROM public.historical_pursuit_resolved_rows_for_staff(NULL)')).rows;
  assert.equal(projected.length,73);
  assert.equal('clarification_source' in projected[0],false);
  assert.equal('manifest' in projected[0],false);
  assert.equal('before_match' in projected[0],false);
  const link=projected.find(r=>r.source_row===41);
  assert.equal(link.source_opportunity_reference,'Original reference 41'); assert.equal(link.resolved_reference,'Synthetic target 41'); assert.equal(link.mapped_match_status,'draft'); assert.deepEqual(link.resolution_blockers,[]);
  const confidential=projected.find(r=>r.source_row===71); assert.equal(confidential.clarification_outcome,'confidential_history'); assert.equal(confidential.match_id,null);
  assert.deepEqual(projected.find(r=>r.source_row===21).review_flags,[]);
  await client.query('RESET ROLE');
  for(const table of ['pursuit_v4_clarifications','pursuit_v4_clarification_batches']) await rejectTransaction(()=>client.query(`DELETE FROM public.${table}`),/immutable/);
  console.log('Clarification rehearsal passed: full apply/readback, unchanged source, retry, drift, namespace, atomic failure, prior reason retention, staff projection and browser-role denial.');
} finally {await client.end();}
