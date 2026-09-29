#!/usr/bin/env node
import fs from 'node:fs';
import pg from 'pg';
import { preparePursuitProgressCatchup, applyPursuitProgressCatchup, readbackPursuitProgressCatchup, compensatePursuitProgressCatchup, postgresManifestDigest } from './pursuit-progress-catchup.mjs';

const [mode, envFile, manifestFile, actor, reason, ...extra] = process.argv.slice(2);
const usage = 'Usage: --prepare env-file new-private-manifest.json | --check|--readback env-file manifest.json | --apply env-file manifest.json staff-id | --compensate env-file staff-id reason';
const compensation = mode === '--compensate' ? {actor:manifestFile,reason:actor} : null;
if (!['--prepare','--check','--readback','--apply','--compensate'].includes(mode) || !envFile || extra.length
  || (mode === '--prepare' && (!manifestFile || actor || reason))
  || (['--check','--readback'].includes(mode) && (!manifestFile || actor || reason))
  || (mode === '--apply' && (!manifestFile || !actor || reason))
  || (mode === '--compensate' && (!compensation?.actor || !compensation.reason || reason))) throw new Error(usage);
const env = Object.fromEntries(fs.readFileSync(envFile,'utf8').split(/\r?\n/).map(line => line.match(/^([^#=\s]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/)).filter(Boolean).map(m => [m[1],m[2]??m[3]??m[4]??'']));
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required in the approved private environment file.');
const url = new URL(env.DATABASE_URL);
if (url.hostname !== 'db.iiuqcdnmxhtyispnykgf.supabase.co' && !(url.hostname.endsWith('.pooler.supabase.com') && url.username === 'postgres.iiuqcdnmxhtyispnykgf')) throw new Error('Only the approved WAVE database is supported.');
const client = new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
try {
  await client.connect(); await client.query("SET TIME ZONE 'UTC'");
  const identity = (await client.query('SELECT session_user,current_user')).rows[0];
  if (identity.session_user !== 'postgres' || identity.current_user !== 'postgres') throw new Error('The private correction runner requires the PostgreSQL owner connection, not a service or application role.');
  await client.query(mode === '--apply' || mode === '--compensate' ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='5s'");
  let result;
  if (mode === '--prepare') {
    const manifest = await preparePursuitProgressCatchup(client);
    fs.writeFileSync(manifestFile,`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx',mode:0o600});
    result = {prepared:18,manifestDigest:await postgresManifestDigest(client,manifest)};
  } else if (mode === '--compensate') result = await compensatePursuitProgressCatchup(client,compensation.actor,compensation.reason);
  else {
    const manifest = JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    if (mode === '--check') {
      const fresh = await preparePursuitProgressCatchup(client);
      if (JSON.stringify(fresh) !== JSON.stringify(manifest)) throw new Error('Pursuit progress catch-up: live_state_or_plan_changed');
      result = {unchanged:true,rows:18,manifestDigest:await postgresManifestDigest(client,manifest)};
    } else if (mode === '--readback') result = await readbackPursuitProgressCatchup(client,manifest);
    else result = await applyPursuitProgressCatchup(client,manifest,actor);
  }
  await client.query('COMMIT'); console.log(JSON.stringify({mode,...result}));
} catch (error) {
  try { await client.query('ROLLBACK'); } catch { /* no successful transaction */ }
  console.error(error instanceof Error && error.message.startsWith('Pursuit progress catch-up:') ? error.message : 'Pursuit progress catch-up operation failed; no successful write is confirmed. Private values were not logged.');
  process.exitCode=1;
} finally { await client.end(); }
