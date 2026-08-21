#!/usr/bin/env node
import { MANIFEST_FILE, RESULT_FILE, RUNTIME_FIXTURES_FILE, databaseClient, readJson, writePrivateJson } from "./phase-b-common.mjs"

let database
try {
  const manifest = await readJson(MANIFEST_FILE)
  const runtimeFixtures = await readJson(RUNTIME_FIXTURES_FILE)
  database = await databaseClient()
  const p1 = await database.query("SELECT id, email, source, cv_url FROM public.repreneurs WHERE lower(email)=lower($1)", [manifest.actors.applicant.email])
  const p2 = await database.query("SELECT id, email, lifecycle_status, source, created_by FROM public.repreneurs WHERE lower(email)=lower($1)", [manifest.actors.staffCreated.email])
  const p3 = await database.query(`SELECT opportunity.id AS opportunity_id, opportunity.reference, opportunity.public_title, match.id AS match_id, match.status, match.pursuit_stage,
      (SELECT count(*)::int FROM public.opportunity_matches active WHERE active.opportunity_id=opportunity.id AND active.status='active_pursuit') AS active_pursuits,
      (SELECT count(*)::int FROM public.opportunity_pursuit_evidence evidence WHERE evidence.match_id=match.id AND evidence.event_type='mutual_interest_validated') AS validation_events
    FROM public.opportunities opportunity
    JOIN public.opportunity_matches match ON match.opportunity_id=opportunity.id
    WHERE opportunity.public_title=$1 AND match.repreneur_id=$2`, [`${manifest.fixturePrefix} opportunity`, manifest.ids.portalRepreneur])
  const p1Storage = p1.rows[0]?.cv_url ? await database.query("SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id='cvs' AND name=$1", [p1.rows[0].cv_url]) : { rows: [{ count: 0 }] }
  const result = {
    runId: manifest.runId,
    fixturePrefix: manifest.fixturePrefix,
    cases: {
      planned: 3,
      executed: Number(p1.rows.length === 1) + Number(p2.rows.length === 1) + Number(p3.rows.length === 1),
      passed: Number(p1.rows.length === 1 && p1.rows[0].source === "intake_v2" && p1Storage.rows[0].count === 1) + Number(p2.rows.length === 1 && p2.rows[0].lifecycle_status === "lead" && p2.rows[0].source === "staff_manual" && p2.rows[0].created_by === manifest.actors.staff.userId) + Number(p3.rows.length === 1 && p3.rows[0].status === "active_pursuit" && p3.rows[0].pursuit_stage === "interest" && p3.rows[0].active_pursuits === 1 && p3.rows[0].validation_events === 1),
      failed: 0,
    },
    persisted: {
      p1: p1.rows[0] ? { ...p1.rows[0], storageObjects: p1Storage.rows[0].count } : null,
      p2: p2.rows[0] || null,
      p3: p3.rows[0] || null,
    },
    fixtureIds: { seeded: manifest.databaseRows, runtime: runtimeFixtures },
  }
  result.cases.failed = result.cases.executed - result.cases.passed
  if (result.cases.executed !== 3 || result.cases.passed !== 3) throw new Error("Phase B readback failed: acceptance-state")
  await writePrivateJson(RESULT_FILE, result)
  console.log(JSON.stringify({ ok: true, runId: manifest.runId, planned: 3, executed: 3, passed: 3, failed: 0 }))
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("Phase B readback failed:") ? error.message : "Phase B readback failed: unknown")
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
