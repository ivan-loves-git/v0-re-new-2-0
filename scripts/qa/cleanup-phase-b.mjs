#!/usr/bin/env node
import { isDeepStrictEqual } from "node:util"
import { MANIFEST_FILE, RUNTIME_FIXTURES_FILE, RUN_DIR, SINGLETON_BEFORE_FILE, assertLeaseAuthority, assertQaMutationTriggersEnabled, databaseClient, readJson, recordRuntimeFixtures, removeRunnerSecrets, setProvisionalIdentityTriggers, storageClient, writePrivateJson } from "./phase-b-common.mjs"

function safeDatabaseToken(error) {
  const constraint = String(error?.constraint ?? "").replace(/[^a-z0-9_]/gi, "_")
  if (constraint) return `constraint_${constraint}`
  const code = String(error?.code ?? "").replace(/[^a-z0-9_]/gi, "_")
  if (code) return `postgres_${code}`
  return "postgres_unknown"
}

let database
try {
  const manifest = await readJson(MANIFEST_FILE)
  database = await databaseClient()
  const leaseState = await assertLeaseAuthority(database)
  const storage = storageClient()
  const runtime = await readJson(RUNTIME_FIXTURES_FILE).catch(() => ({}))
  const singletonBefore = await readJson(SINGLETON_BEFORE_FILE)
  if (!leaseState || !isDeepStrictEqual(leaseState.manifest?.fixtureManifest, manifest) || !isDeepStrictEqual(leaseState.manifest?.runtime ?? {}, runtime) || !isDeepStrictEqual(leaseState.singleton_before, singletonBefore)) {
    throw new Error("Phase B cleanup failed: server-manifest-mismatch")
  }
  await assertQaMutationTriggersEnabled(database)
  if (singletonBefore.maProvisionalSourceContext !== null) throw new Error("Phase B cleanup failed: ambiguous-provisional-singleton")
  const currentContext = (await database.query("SELECT firm_id, office_id, contact_id, affiliation_id FROM public.ma_provisional_source_contexts WHERE context_key=$1", [manifest.ids.provisionalContext])).rows[0]
  if (currentContext && (
    currentContext.firm_id !== manifest.ids.provisionalFirm ||
    currentContext.office_id !== manifest.ids.provisionalOffice ||
    currentContext.contact_id !== manifest.ids.provisionalContextContact ||
    currentContext.affiliation_id !== manifest.ids.provisionalAffiliation
  )) throw new Error("Phase B cleanup failed: provisional-singleton-ownership")
  const currentSettings = (await database.query("SELECT enabled, updated_at, updated_by FROM public.wave_journey_settings WHERE singleton=true")).rows[0]
  if (currentSettings && currentSettings.updated_by !== manifest.actors.staff.userId) {
    const before = singletonBefore.waveJourneySettings
    if (!before || currentSettings.enabled !== before.enabled || new Date(currentSettings.updated_at).toISOString() !== new Date(before.updated_at).toISOString() || currentSettings.updated_by !== before.updated_by) {
      throw new Error("Phase B cleanup failed: journey-singleton-ownership")
    }
  }
  const emailCountBefore = singletonBefore.emailDailyCount
  const emailCountDate = singletonBefore.emailCountDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(emailCountDate || "")) throw new Error("Phase B cleanup failed: email-count-date")
  const rateLimitBefore = singletonBefore.rateLimitRows
  if (!Array.isArray(rateLimitBefore)) throw new Error("Phase B cleanup failed: rate-limit-snapshot")
  const authIdentityIds = [...manifest.betterAuthIdentities, manifest.ids.provisionalContextUser]
  const recordedRepreneurIds = [runtime.p1RepreneurId, runtime.p2RepreneurId, manifest.ids.portalRepreneur, manifest.ids.lockedRepreneur].filter(Boolean)
  let scopedRepreneurs = await database.query("SELECT id, email, source, cv_url FROM public.repreneurs WHERE id = ANY($1::uuid[])", [recordedRepreneurIds])
  if (!runtime.p1RepreneurId || !runtime.p2RepreneurId) {
    const recovered = await database.query("SELECT id, email, source, cv_url FROM public.repreneurs WHERE lower(email) IN (lower($1), lower($2))", [manifest.actors.applicant.email, manifest.actors.staffCreated.email])
    scopedRepreneurs = { rows: [...scopedRepreneurs.rows, ...recovered.rows.filter((candidate) => !scopedRepreneurs.rows.some((row) => row.id === candidate.id))] }
  }
  for (const row of scopedRepreneurs.rows) {
    const expected = row.id === manifest.ids.portalRepreneur
      || row.id === manifest.ids.lockedRepreneur
      || (row.email === manifest.actors.applicant.email && row.source === "intake_v2")
      || (row.email === manifest.actors.staffCreated.email && row.source === "staff_manual")
    if (!expected) throw new Error("Phase B cleanup failed: repreneur-scope")
  }
  const p3DealIds = runtime.p3DealIds ?? {}
  const recordedOpportunityIds = [p3DealIds.declinedOpportunityId, p3DealIds.droppedOpportunityId].filter((value) => typeof value === "string")
  const recordedMatchIds = [p3DealIds.lockedMatchId, p3DealIds.declinedMatchId, p3DealIds.droppedMatchId].filter((value) => typeof value === "string")
  const primaryOpportunities = await database.query("SELECT id FROM public.opportunities WHERE public_title=$1 AND created_by=$2", [`${manifest.fixturePrefix} opportunity`, manifest.actors.staff.userId])
  const recordedDeals = recordedOpportunityIds.length > 0
    ? await database.query("SELECT id FROM public.opportunities WHERE id = ANY($1::uuid[]) AND created_by=$2 AND public_title IN ($3, $4)", [recordedOpportunityIds, manifest.actors.staff.userId, `${manifest.fixturePrefix} deals-declined`, `${manifest.fixturePrefix} deals-dropped`])
    : { rows: [] }
  if (recordedDeals.rows.length !== recordedOpportunityIds.length) throw new Error("Phase B cleanup failed: recorded-deal-ownership")
  const recordedMatches = recordedMatchIds.length > 0
    ? await database.query("SELECT id FROM public.opportunity_matches WHERE id = ANY($1::uuid[]) AND opportunity_id = ANY($2::uuid[]) AND repreneur_id = ANY($3::uuid[])", [recordedMatchIds, recordedOpportunityIds, [manifest.ids.portalRepreneur, manifest.ids.lockedRepreneur]])
    : { rows: [] }
  if (recordedMatches.rows.length !== recordedMatchIds.length) throw new Error("Phase B cleanup failed: recorded-match-ownership")
  const scopedOpportunities = { rows: [...primaryOpportunities.rows, ...recordedDeals.rows.filter((row) => !primaryOpportunities.rows.some((candidate) => candidate.id === row.id))] }
  if (scopedOpportunities.rows.length > 3) throw new Error("Phase B cleanup failed: opportunity-scope")
  const scopedOpportunityProbes = runtime.opportunityProbeId
    ? await database.query("SELECT id FROM public.opportunities WHERE id=$1 AND public_title=$2 AND created_by=$3", [runtime.opportunityProbeId, `${manifest.fixturePrefix} opportunity probe`, manifest.actors.staff.userId])
    : await database.query("SELECT id FROM public.opportunities WHERE public_title=$1 AND created_by=$2", [`${manifest.fixturePrefix} opportunity probe`, manifest.actors.staff.userId])
  if (scopedOpportunityProbes.rows.length > 1) throw new Error("Phase B cleanup failed: opportunity-probe-scope")
  const repreneurIds = [...new Set([manifest.ids.portalRepreneur, manifest.ids.lockedRepreneur, ...scopedRepreneurs.rows.map((row) => row.id)])]
  const opportunityIds = scopedOpportunities.rows.map((row) => row.id)
  const opportunityProbeIds = scopedOpportunityProbes.rows.map((row) => row.id)
  const allOpportunityIds = [...new Set([...opportunityIds, ...opportunityProbeIds])]
  const scopedMatches = opportunityIds.length > 0
    ? await database.query("SELECT id FROM public.opportunity_matches WHERE opportunity_id = ANY($1::uuid[])", [opportunityIds])
    : { rows: [] }
  const matchIds = scopedMatches.rows.map((row) => row.id)

  const scopedEvidence = matchIds.length > 0
    ? await database.query("SELECT id FROM public.opportunity_pursuit_evidence WHERE match_id = ANY($1::uuid[])", [matchIds])
    : { rows: [] }
  const evidenceIds = scopedEvidence.rows.map((row) => row.id)

  const objectNames = [...new Set([...manifest.storageObjects, ...(runtime.storageObjects ?? []), ...scopedRepreneurs.rows.map((row) => row.cv_url).filter(Boolean)])]
  await recordRuntimeFixtures({
    ...runtime,
    repreneurIds,
    opportunityIds,
    opportunityProbeIds,
    matchIds,
    evidenceIds,
    storageObjects: objectNames,
  })
  if (objectNames.length > 0) {
    const { error } = await storage.storage.from("cvs").remove(objectNames)
    if (error) throw new Error("Phase B cleanup failed: storage-delete")
  }

  await database.query("BEGIN")
  await database.query("ALTER TABLE public.opportunity_pursuit_evidence DISABLE TRIGGER opportunity_pursuit_evidence_immutable")
  await setProvisionalIdentityTriggers(database, false)
  if (opportunityProbeIds.length > 0) {
    await database.query("DELETE FROM public.opportunity_ma_contacts WHERE opportunity_id = ANY($1::uuid[])", [opportunityProbeIds])
    await database.query("DELETE FROM public.opportunities WHERE id = ANY($1::uuid[])", [opportunityProbeIds])
  }
  if (opportunityIds.length > 0) {
    if (evidenceIds.length > 0) await database.query("DELETE FROM public.opportunity_pursuit_evidence WHERE id = ANY($1::uuid[])", [evidenceIds])
    await database.query("DELETE FROM public.opportunity_pursuit_events WHERE opportunity_id = ANY($1::uuid[])", [opportunityIds])
    await database.query("DELETE FROM public.opportunity_ma_contacts WHERE opportunity_id = ANY($1::uuid[])", [opportunityIds])
    if (matchIds.length > 0) await database.query("DELETE FROM public.opportunity_matches WHERE id = ANY($1::uuid[])", [matchIds])
    await database.query("DELETE FROM public.opportunities WHERE id = ANY($1::uuid[])", [opportunityIds])
  }
  await database.query("DELETE FROM public.email_logs WHERE repreneur_id = ANY($1::uuid[])", [repreneurIds])
  await database.query("DELETE FROM public.repreneurs WHERE id = ANY($1::uuid[])", [repreneurIds])
  await database.query("DELETE FROM public.ma_provisional_source_contexts WHERE context_key=$1", [manifest.ids.provisionalContext])
  await database.query("DELETE FROM public.ma_contact_office_affiliations WHERE id=$1", [manifest.ids.provisionalAffiliation])
  await database.query("DELETE FROM public.ma_contacts WHERE id = ANY($1::uuid[])", [[manifest.ids.provisionalCountContact, manifest.ids.provisionalContextContact]])
  await database.query("DELETE FROM public.ma_offices WHERE id=$1", [manifest.ids.provisionalOffice])
  await database.query("DELETE FROM public.ma_firms WHERE id=$1", [manifest.ids.provisionalFirm])

  await database.query("DELETE FROM public.ma_contact_office_affiliations WHERE id=$1", [manifest.ids.affiliation])
  await database.query("DELETE FROM public.ma_contacts WHERE id=$1", [manifest.ids.contact])
  await database.query("DELETE FROM public.ma_offices WHERE id=$1", [manifest.ids.office])
  await database.query("DELETE FROM public.ma_firms WHERE id=$1", [manifest.ids.firm])
  await database.query("DELETE FROM public.opportunity_mandate_reference_counters WHERE reference_code=$1", [manifest.referenceCode])
  await database.query("DELETE FROM public.geography_nodes WHERE id=$1", [manifest.ids.geography])
  await database.query("DELETE FROM public.wave_journey_settings WHERE singleton=true AND updated_by=$1", [manifest.actors.staff.userId])
  if (singletonBefore.waveJourneySettings) {
    await database.query(`INSERT INTO public.wave_journey_settings (singleton, enabled, updated_at, updated_by)
      VALUES (true, $1, $2, $3)
      ON CONFLICT (singleton) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=EXCLUDED.updated_at, updated_by=EXCLUDED.updated_by`, [
      singletonBefore.waveJourneySettings.enabled,
      singletonBefore.waveJourneySettings.updated_at,
      singletonBefore.waveJourneySettings.updated_by,
    ])
  }
  if (emailCountBefore) {
    await database.query(`INSERT INTO public.email_daily_counts (date, count)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET count=EXCLUDED.count`, [emailCountBefore.date, emailCountBefore.count])
  } else {
    await database.query("DELETE FROM public.email_daily_counts WHERE date=$1", [emailCountDate])
  }
  await database.query("DELETE FROM public.app_user_roles WHERE user_id = ANY($1::text[])", [authIdentityIds])
  await database.query('DELETE FROM public."session" WHERE "userId" = ANY($1::text[])', [authIdentityIds])
  await database.query('DELETE FROM public."account" WHERE "userId" = ANY($1::text[])', [authIdentityIds])
  await database.query('DELETE FROM public."user" WHERE id = ANY($1::text[])', [authIdentityIds])
  await database.query('DELETE FROM public."rateLimit"')
  if (rateLimitBefore.length > 0) {
    await database.query(`INSERT INTO public."rateLimit" ("key", count, "lastRequest", id)
      SELECT "key", count, "lastRequest", id
      FROM jsonb_to_recordset($1::jsonb) AS restored("key" text, count integer, "lastRequest" bigint, id text)`, [JSON.stringify(rateLimitBefore)])
  }
  await database.query("SET CONSTRAINTS ALL IMMEDIATE")
  await setProvisionalIdentityTriggers(database, true)
  await database.query("ALTER TABLE public.opportunity_pursuit_evidence ENABLE TRIGGER opportunity_pursuit_evidence_immutable")
  await database.query("COMMIT")

  const residue = await database.query(`SELECT
    (SELECT count(*)::int FROM public.repreneurs WHERE id = ANY($1::uuid[])) + (SELECT count(*)::int FROM public.email_logs WHERE repreneur_id = ANY($1::uuid[])) AS repreneurs,
    (SELECT count(*)::int FROM public.opportunities WHERE id = ANY($2::uuid[])) + (SELECT count(*)::int FROM public.opportunity_ma_contacts WHERE opportunity_id = ANY($2::uuid[])) AS opportunities,
    (SELECT count(*)::int FROM public.opportunity_matches WHERE id = ANY($3::uuid[])) + (SELECT count(*)::int FROM public.opportunity_pursuit_evidence WHERE id = ANY($4::uuid[])) AS journey_rows,
    (SELECT count(*)::int FROM public.ma_firms WHERE id = ANY($5::uuid[])) + (SELECT count(*)::int FROM public.ma_offices WHERE id = ANY($6::uuid[])) + (SELECT count(*)::int FROM public.ma_contacts WHERE id = ANY($7::uuid[])) + (SELECT count(*)::int FROM public.ma_contact_office_affiliations WHERE id = ANY($8::uuid[])) + (SELECT count(*)::int FROM public.ma_provisional_source_contexts WHERE context_key=$9) + (SELECT count(*)::int FROM public.wave_journey_settings WHERE singleton=true AND updated_by=$10) AS ma_rows,
    (SELECT count(*)::int FROM public."user" WHERE id = ANY($11::text[])) + (SELECT count(*)::int FROM public."account" WHERE "userId" = ANY($11::text[])) + (SELECT count(*)::int FROM public."session" WHERE "userId" = ANY($11::text[])) + (SELECT count(*)::int FROM public.app_user_roles WHERE user_id = ANY($11::text[])) AS auth_rows,
    (SELECT count(*)::int FROM storage.objects WHERE bucket_id='cvs' AND name = ANY($12::text[])) AS storage_objects`, [repreneurIds, allOpportunityIds, matchIds, evidenceIds, [manifest.ids.firm, manifest.ids.provisionalFirm], [manifest.ids.office, manifest.ids.provisionalOffice], [manifest.ids.contact, manifest.ids.provisionalCountContact, manifest.ids.provisionalContextContact], [manifest.ids.affiliation, manifest.ids.provisionalAffiliation], manifest.ids.provisionalContext, manifest.actors.staff.userId, authIdentityIds, objectNames])
  const values = residue.rows[0]
  const total = Object.values(values).reduce((sum, value) => sum + Number(value), 0)
  if (total !== 0) throw new Error("Phase B cleanup failed: residue")
  const restoredEmailCount = (await database.query("SELECT date::text, count FROM public.email_daily_counts WHERE date=$1", [emailCountDate])).rows[0] ?? null
  if (JSON.stringify(restoredEmailCount) !== JSON.stringify(emailCountBefore)) throw new Error("Phase B cleanup failed: email-count-restore")
  const restoredRateLimits = (await database.query('SELECT coalesce(jsonb_agg(to_jsonb(limits) ORDER BY "key", id), \'[]\'::jsonb) AS value FROM public."rateLimit" limits')).rows[0].value
  if (JSON.stringify(restoredRateLimits) !== JSON.stringify(rateLimitBefore)) throw new Error("Phase B cleanup failed: rate-limit-restore")
  await writePrivateJson(`${RUN_DIR}/cleanup-readback.json`, { runId: manifest.runId, databaseResidue: 0, authResidue: 0, storageResidue: 0, exactIdsChecked: manifest.databaseRows.length + repreneurIds.length + allOpportunityIds.length + matchIds.length + evidenceIds.length, dynamicObjectsChecked: objectNames.length, runtimeFixtureIds: { repreneurIds, opportunityIds, opportunityProbeIds, matchIds, evidenceIds } })
  await removeRunnerSecrets()
  console.log(JSON.stringify({ ok: true, runId: manifest.runId, databaseResidue: 0, authResidue: 0, storageResidue: 0 }))
} catch (error) {
  if (database) await database.query("ROLLBACK").catch(() => {})
  if (database) await setProvisionalIdentityTriggers(database, true).catch(() => {})
  if (database) await database.query("ALTER TABLE public.opportunity_pursuit_evidence ENABLE TRIGGER opportunity_pursuit_evidence_immutable").catch(() => {})
  await removeRunnerSecrets().catch(() => {})
  console.error(error instanceof Error && error.message.startsWith("Phase B cleanup failed:") ? error.message : `Phase B cleanup failed: database-${safeDatabaseToken(error)}`)
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
