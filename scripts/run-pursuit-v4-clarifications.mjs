#!/usr/bin/env node
import fs from 'node:fs';
import pg from 'pg';
import { prepareClarifications, applyClarifications, readbackClarifications, digest } from './pursuit-v4-clarifications.mjs';

const [mode,envFile,inputFile,outputOrDigest,actor,...extra] = process.argv.slice(2);
if (!['--prepare','--check','--apply','--readback'].includes(mode) || !envFile || !inputFile || extra.length
  || (mode === '--prepare' && (!outputOrDigest || actor))
  || (mode === '--apply' && (!outputOrDigest || !actor))
  || (['--check','--readback'].includes(mode) && (outputOrDigest || actor))) {
  throw new Error('Usage: --prepare env plan.json new-private-manifest.json | --check|--readback env manifest.json | --apply env manifest.json approved-digest staff-id');
}
const env = Object.fromEntries(fs.readFileSync(envFile,'utf8').split(/\r?\n/).map(line => line.match(/^([^#=\s]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/)).filter(Boolean).map(m => [m[1],m[2]??m[3]??m[4]??'']));
const url = new URL(env.DATABASE_URL);
if (url.hostname !== 'db.iiuqcdnmxhtyispnykgf.supabase.co' && !(url.hostname.endsWith('.pooler.supabase.com') && url.username === 'postgres.iiuqcdnmxhtyispnykgf')) throw new Error('Only the approved WAVE database is supported.');
const client = new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
try {
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  await client.query(mode === '--apply' ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='5s'");
  const input = JSON.parse(fs.readFileSync(inputFile,'utf8'));
  let result;
  if (mode === '--prepare') {
    const manifest = await prepareClarifications(client,input);
    fs.writeFileSync(outputOrDigest,`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx',mode:0o600});
    result = {prepared:manifest.rows.length,approvedDigest:digest(manifest)};
  } else if (mode === '--check') {
    const current = await prepareClarifications(client,{sourceReference:input.sourceReference,rows:input.rows.map(({sourceRow,kind,targetReference}) => ({sourceRow,kind,targetReference}))});
    if (digest(current) !== digest(input)) throw new Error('Clarification: live_state_or_plan_changed');
    result = {unchanged:true,rows:input.rows.length,approvedDigest:digest(input)};
  } else if (mode === '--readback') result = await readbackClarifications(client,input,digest(input));
  else result = await applyClarifications(client,input,outputOrDigest,actor);
  await client.query('COMMIT');
  console.log(JSON.stringify({mode,...result}));
} catch(error) {
  try { await client.query('ROLLBACK'); } catch { /* no connection */ }
  console.error(error instanceof Error && error.message.startsWith('Clarification:') ? error.message : 'Clarification operation failed; no successful apply is confirmed. Private values were not logged.');
  process.exitCode = 1;
} finally { await client.end(); }
