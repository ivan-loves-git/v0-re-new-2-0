import { createHash, randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type BrowserContext, type Locator } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { Client } from "pg"
import { syntheticPdfBytes } from "../../lib/__tests__/fixtures/synthetic-pdf"
import { assertOpeningReadinessFixtureEnvironment, OPENING_READINESS_FIXTURE } from "../../lib/opening-readiness-fixture"

const fixture = OPENING_READINESS_FIXTURE
const { databaseUrl, apiUrl } = assertOpeningReadinessFixtureEnvironment(process.env)
const password = process.env.OPENING_FIXTURE_PASSWORD
const runnerTemp = process.env.RUNNER_TEMP
const storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!password || !runnerTemp || !storageKey) throw new Error("External memo proof requires the protected synthetic fixture.")
const storage = createClient(apiUrl.toString(), storageKey, { auth: { persistSession: false } }).storage

async function activate(control: Locator, mobile: boolean) {
  if (mobile) await control.tap()
  else { await control.focus(); await control.press("Enter") }
}

async function seedEligibleMemo(db: Client, index: number) {
  const opportunityId = `25500000-0000-4000-8000-${String(100 + index).padStart(12, "0")}`
  const matchId = `25500000-0000-4000-8000-${String(200 + index).padStart(12, "0")}`
  const documentId = `25500000-0000-4000-8000-${String(300 + index).padStart(12, "0")}`
  await db.query(`INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,public_title,description,created_by)
    VALUES($1,$2,'active',false,$3,'QA EXTERNAL MEMO — SYNTHETIC','Synthetic exact grant notice proof',$4)`, [opportunityId, `QA-255-${index}`, fixture.ids.realOffice, fixture.authIds.staffUser])
  await db.query(`INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
    VALUES($1,$2,'Synthetic source contact',true,$3)`, [opportunityId, fixture.ids.realAffiliation, fixture.authIds.staffUser])
  await db.query(`INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES($1,$2,$3,'interested',$4)`, [matchId, opportunityId, fixture.ids.realNonOwnerRepreneur, fixture.authIds.staffUser])
  await db.query("SELECT public.journey_start_pursuit($1,$2,$3)", [matchId, fixture.staff.email, `qa-255-cycle-${index}`])
  const record = async (phase: "e4" | "e6" | "e7") => db.query(`SELECT public.journey_record_external_handoff($1,public.journey_external_handoff_context($1,$2),$3,current_date-1,NULL,'email','Synthetic prerequisite exchange',$4,$5)`, [matchId, phase, randomUUID(), fixture.authIds.staffUser, fixture.staff.email])
  const evidence = async (event: string, artifactId: string | null = null) => db.query("SELECT public.journey_record_evidence($1,$2,$3,$4,$5)", [matchId, event, fixture.staff.email, `qa-255-${index}-${event}`, artifactId])
  await record("e4")
  await evidence("intermediary_qualified")
  let signedCount = 0
  for (const role of ["blank_template", "renew_signed_copy", "repreneur_signed_copy"] as const) {
    const bytes = Buffer.from(syntheticPdfBytes(1))
    const path = `${opportunityId}/nda-artifacts/${role}/${randomUUID()}-synthetic.pdf`
    const upload = await storage.from("opportunity-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false })
    expect(upload.error).toBeNull()
    const registered = await db.query<{ artifact_id: string }>("SELECT * FROM public.register_opportunity_nda_artifact($1,$2,$3,$4,$5,'synthetic.pdf',$6,$7,$8)", [opportunityId, role === "blank_template" ? null : matchId, role, `Synthetic ${role}`, path, bytes.byteLength, createHash("sha256").update(bytes).digest("hex"), fixture.staff.email])
    if (role === "blank_template") {
      await evidence("template_validated", registered.rows[0]!.artifact_id)
      await evidence("gate_1_passed")
      await record("e6")
    } else {
      await evidence(role === "renew_signed_copy" ? "renew_signed_copy_validated" : "repreneur_signed_copy_validated", registered.rows[0]!.artifact_id)
      signedCount++
    }
  }
  expect(signedCount).toBe(2)
  await evidence("gate_2_passed")
  await record("e7")
  const memoBytes = Buffer.from(syntheticPdfBytes(2))
  const memoPath = `${opportunityId}/${randomUUID()}-memo.pdf`
  expect((await storage.from("opportunity-documents").upload(memoPath, memoBytes, { contentType: "application/pdf", upsert: false })).error).toBeNull()
  await db.query(`INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,mime_type,size_bytes,uploaded_by)
    VALUES($1,$2,'Synthetic retained IM','deal_book','staff_only','opportunity-documents',$3,'memo.pdf','application/pdf',$4,$5)`, [documentId, opportunityId, memoPath, memoBytes.byteLength, fixture.authIds.staffUser])
  return { opportunityId, matchId, documentId, memoBytes }
}

test("staff atomically approves exact memo access with an external notice in FR/EN desktop/mobile and no send", async ({ page, browser }) => {
  test.setTimeout(300_000)
  const db = new Client({ connectionString: databaseUrl.toString() })
  await db.connect()
  const contexts: BrowserContext[] = []
  const priorJourney = (await db.query<{ enabled: boolean }>("SELECT enabled FROM public.wave_journey_settings WHERE singleton")).rows[0]!
  let primaryFailure: unknown
  let failed = false
  try {
    await db.query("UPDATE public.wave_journey_settings SET enabled=true WHERE singleton")
    await page.goto("/auth/login")
    await page.getByRole("button", { name: "English", exact: true }).click()
    await page.locator("#email").fill(fixture.staff.email)
    await page.locator("#password").fill(password)
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard_re/)
    const session = await page.context().storageState()
    const evidenceDirectory = join(runnerTemp, "opening-readiness-evidence")
    await mkdir(evidenceDirectory, { recursive: true })
    let index = 0
    for (const size of ["desktop", "mobile"] as const) for (const language of ["en", "fr"] as const) {
      const mobile = size === "mobile"
      const context = await browser.newContext({ storageState: session, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mobile })
      contexts.push(context)
      const staff = await context.newPage()
      const dossier = await seedEligibleMemo(db, ++index)
      const before = (await db.query("SELECT (SELECT count(*) FROM public.email_logs) AS logs,(SELECT count(*) FROM public.staff_email_reviews) AS reviews,(SELECT count(*) FROM public.opportunity_memo_grant_attempts) AS attempts")).rows[0]
      await staff.goto(`/opportunities/${dossier.opportunityId}?tab=pursuit`, { waitUntil: "domcontentloaded", timeout: 30_000 })
      await staff.locator("#journey-im").selectOption(dossier.documentId)
      await staff.locator("#journey-nda-expiry").fill("2027-10-07T12:00")
      await activate(staff.getByRole("button", { name: "Approve with external notice", exact: true }), mobile)
      const dialog = staff.getByRole("dialog")
      await expect(dialog).toBeVisible()
      await activate(dialog.getByRole("button", { name: language === "fr" ? "Français" : "English", exact: true }), mobile)
      await expect(dialog.getByRole("heading", { name: language === "fr" ? "Approuver l’accès au mémo et enregistrer l’avis externe" : "Approve memo access and record the external notice", exact: true })).toBeVisible()
      await dialog.getByLabel(language === "fr" ? "Date réelle de l’échange" : "Actual exchange date", { exact: true }).fill(new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
      await dialog.getByLabel(language === "fr" ? "Canal" : "Channel", { exact: true }).selectOption("meeting")
      await dialog.getByLabel(language === "fr" ? "Référence explicite" : "Meaningful reference", { exact: true }).fill("Synthetic completed memo notice")
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await dialog.screenshot({ path: join(evidenceDirectory, `external-memo-${language}-${size}.png`) })
      await activate(dialog.getByRole("button", { name: language === "fr" ? "Approuver l’accès et enregistrer l’avis externe" : "Approve access and record external notice", exact: true }), mobile)
      await expect(dialog).toHaveCount(0)
      await expect(staff.getByText(language === "fr" ? "Accès au mémo approuvé ; avis communiqué hors WAVE" : "Memo access approved; notice completed outside WAVE", { exact: true })).toBeVisible()
      const saved = (await db.query(`SELECT x.grant_evidence_id,x.memo_sha256,x.exchange_time,x.staff_user_id,n.state,
        (SELECT count(*)::int FROM public.opportunity_pursuit_evidence e WHERE e.match_id=s.match_id AND e.event_type IN ('memo_approved','confidential_access_granted','e8_memo_enabled_completed')) AS effects
        FROM public.opportunity_memo_external_notices x JOIN public.opportunity_memo_grant_snapshots s USING(grant_evidence_id) JOIN public.opportunity_memo_grant_notices n USING(grant_evidence_id) WHERE s.match_id=$1`, [dossier.matchId])).rows
      expect(saved).toHaveLength(1)
      expect(saved[0]).toMatchObject({ memo_sha256: createHash("sha256").update(dossier.memoBytes).digest("hex"), exchange_time: null, staff_user_id: fixture.authIds.staffUser, state: "external", effects: 3 })
      expect((await db.query("SELECT * FROM public.claim_opportunity_memo_notification($1,$2,now())", [dossier.opportunityId, dossier.matchId])).rows).toHaveLength(0)
      expect((await db.query("SELECT * FROM public.claim_opportunity_memo_grant_notice($1,$2,$3,now())", [dossier.opportunityId, dossier.matchId, saved[0].grant_evidence_id])).rows).toHaveLength(0)
      expect((await db.query("SELECT (SELECT count(*) FROM public.email_logs) AS logs,(SELECT count(*) FROM public.staff_email_reviews) AS reviews,(SELECT count(*) FROM public.opportunity_memo_grant_attempts) AS attempts")).rows[0]).toEqual(before)
      expect((await db.query("SELECT public.journey_repreneur_can_access_confidential($1,$2,$3) AS allowed", [dossier.matchId, fixture.ids.realNonOwnerRepreneur, dossier.documentId])).rows[0].allowed).toBe(true)
      expect((await db.query("SELECT public.journey_repreneur_can_access_confidential($1,$2,$3) AS allowed", [dossier.matchId, fixture.ids.realRepreneur, dossier.documentId])).rows[0].allowed).toBe(false)
      await db.query("SELECT public.pause_opportunity_with_reason($1,'seller_paused_sale',$2,NULL)", [dossier.opportunityId, fixture.authIds.staffUser])
      expect((await db.query("SELECT public.journey_repreneur_can_access_confidential($1,$2,$3) AS allowed", [dossier.matchId, fixture.ids.realNonOwnerRepreneur, dossier.documentId])).rows[0].allowed).toBe(false)
      // Canonical Pause denies old access while preserving this exact private receipt.
    }
    await writeFile(join(evidenceDirectory, "external-memo-notice.json"), JSON.stringify({ atomicFourEffects: true, retainedMemoBytes: true, exactStaff: true, noDispatch: true, exactGrantSuppression: true, ownerAccessBoundaries: true, frenchEnglishDesktopMobile: true }) + "\n")
  } catch (error) { failed = true; primaryFailure = error }
  finally {
    const cleanup = Promise.allSettled([...contexts.map(context => context.close()), (async () => {
      try { await db.query("UPDATE public.wave_journey_settings SET enabled=$1 WHERE singleton", [priorJourney.enabled]) }
      finally { await db.end() }
    })()])
    let cleanupFailed = false
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined
    try {
      const results = await Promise.race([cleanup, new Promise<never>((_, reject) => {
        cleanupTimer = setTimeout(() => reject(new Error("Synthetic external memo cleanup exceeded 5 seconds.")), 5_000)
      })])
      cleanupFailed = results.some(result => result.status === "rejected")
    } catch { cleanupFailed = true }
    finally { if (cleanupTimer) clearTimeout(cleanupTimer) }
    if (failed) {
      if (cleanupFailed) console.error("Synthetic external memo cleanup failed; whole-stack teardown is required.")
      throw primaryFailure
    }
    if (cleanupFailed) throw new Error("Synthetic external memo cleanup failed; whole-stack teardown is required.")
  }
})
