import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test"
import { seedCurrentExternalLdc } from "./seed-external-ldc"
import { verifyPassword } from "better-auth/crypto"
import { Client } from "pg"
import { assertOpeningReadinessFixtureEnvironment, OPENING_READINESS_FIXTURE } from "../../lib/opening-readiness-fixture"

const fixture = OPENING_READINESS_FIXTURE
const password = process.env.OPENING_FIXTURE_PASSWORD
const runnerTemp = process.env.RUNNER_TEMP
if (!password || !runnerTemp) throw new Error("Paused history requires the protected disposable fixture.")
const { databaseUrl } = assertOpeningReadinessFixtureEnvironment(process.env)
const ids = {
  relation: "25600000-0000-4000-8000-000000000021", visit: "25600000-0000-4000-8000-000000000022",
  ended: "25600000-0000-4000-8000-000000000023", other: "25600000-0000-4000-8000-000000000024",
  unopened: "25600000-0000-4000-8000-000000000025", internal: "25600000-0000-4000-8000-000000000026",
  wrongMode: "25600000-0000-4000-8000-000000000027", active: "25600000-0000-4000-8000-000000000028",
  match: "25600000-0000-4000-8000-000000000031", endedMatch: "25600000-0000-4000-8000-000000000033",
  internalMatch: "25600000-0000-4000-8000-000000000036",
}
const title = (kind: string) => `QA PAUSED ${kind.toUpperCase()} — SYNTHETIC`

async function activateHistoryControl(control: Locator, size: "mobile" | "desktop") {
  if (size === "mobile") await control.tap({ timeout: 10_000 })
  else {
    await control.focus({ timeout: 10_000 })
    await control.press("Enter", { timeout: 10_000 })
  }
}

async function waitForHistoryCapture(page: Page, scope: Locator, language: "en" | "fr", kind: "visit" | "relation") {
  const selectedLanguage = page.getByRole("group", { name: /^(Interface language|Langue de l’interface)$/ })
    .getByRole("button", { name: language === "en" ? "English" : "Français", exact: true })
  await expect(selectedLanguage).toHaveAttribute("aria-pressed", "true")
  await expect(selectedLanguage).toBeEnabled()
  await expect.poll(() => scope.evaluate(element => element.closest("[lang]")?.getAttribute("lang"))).toBe(language)
  const required = [
    scope.getByRole("heading", { name: title(kind), exact: true }),
    scope.locator('[data-slot="badge"]').filter({ hasText: language === "en" ? /^Paused$/ : /^En pause$/ }),
    scope.getByText(language === "en"
      ? "This opportunity is temporarily paused. Its retained history is read-only; responses and confidential documents are unavailable."
      : "Cette opportunité est temporairement en pause. Son historique reste en lecture seule ; les réponses et les documents confidentiels sont indisponibles.", { exact: true }),
    ...(kind === "relation" ? [
      scope.getByText(language === "en" ? "Previous relationship: Active pursuit" : "Relation précédente : Dossier de reprise actif", { exact: true }),
      scope.getByText(language === "en" ? "Previous stage: Interest" : "Étape précédente : Intérêt confirmé", { exact: true }),
    ] : []),
  ]
  for (const control of required) await expect(control).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  // Wait for the actual dev render/compile transition; never hide its overlay.
  await expect(page.locator("nextjs-portal").getByText(/^(Rendering|Compiling)\b/)).toHaveCount(0)
  const geometry = () => Promise.all(required.map(control => control.evaluate(element => {
    const box = element.getBoundingClientRect()
    let left = 0, right = window.innerWidth
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(parent).overflowX)) {
        const bounds = parent.getBoundingClientRect()
        left = Math.max(left, bounds.left)
        right = Math.min(right, bounds.right)
      }
    }
    const range = document.createRange()
    range.selectNodeContents(element)
    const readable = element.scrollWidth <= element.clientWidth + 1
      && [...range.getClientRects()].every(bounds => bounds.left >= left - 1 && bounds.right <= right + 1)
    return { x: box.x, y: box.y, width: box.width, height: box.height, readable }
  })))
  await expect.poll(async () => {
    const before = await geometry()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const after = await geometry()
    return after.every(bounds => bounds.readable) && JSON.stringify(before) === JSON.stringify(after)
  }).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function login(page: Page, db: Client, userId: string, email: string) {
  // Reset only the two known loopback sign-in buckets consumed by earlier
  // independent auth scenarios. The actual endpoint and policies remain in use.
  const buckets = await db.query<{ key: string }>(`SELECT "key" FROM public."rateLimit"
    WHERE "key" LIKE '%|/sign-in/email' OR "key" LIKE 'auth:/api/auth/sign-in/email:%'`)
  for (const { key } of buckets.rows) {
    expect(key).toMatch(/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)\|\/sign-in\/email$|^auth:\/api\/auth\/sign-in\/email:[A-Za-z0-9_-]{43}$/)
  }
  if (buckets.rows.length) await db.query('DELETE FROM public."rateLimit" WHERE "key"=ANY($1::text[])', [buckets.rows.map(row => row.key)])
  const credential = await db.query<{ password: string }>('SELECT password FROM public."account" WHERE "userId"=$1 AND "providerId"=\'credential\'', [userId])
  let currentPassword: string | undefined
  for (const candidate of [password!, `${password}-reset`]) {
    if (await verifyPassword({ hash: credential.rows[0]!.password, password: candidate })) currentPassword = candidate
  }
  if (!currentPassword) throw new Error("Synthetic fixture password changed unexpectedly.")
  await page.goto("/auth/login")
  await page.getByRole("button", { name: "English", exact: true }).click()
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(currentPassword)
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await expect(page).toHaveURL(/\/(dashboard_re|portal\/deals)/)
}

async function snapshot(db: Client) {
  const result: Record<string, unknown> = {}
  // Complete retained rows stay only in this process; published evidence below
  // contains fixed booleans, never private marker dates, actors or request data.
  for (const table of ["opportunities", "opportunity_matches", "opportunity_pause_history", "repreneur_opportunity_review_state",
    "opportunity_pursuit_evidence", "opportunity_pursuit_confidential_grants", "opportunity_pursuit_external_handoffs",
    "opportunity_pursuit_handoff_deliveries", "opportunity_documents", "opportunity_nda_artifacts", "staff_email_reviews"]) {
    const parent = table === "opportunities" ? "record.id=ANY($1::uuid[])"
      : table === "opportunity_pursuit_handoff_deliveries"
        ? "record.match_id IN (SELECT id FROM public.opportunity_matches WHERE opportunity_id=ANY($1::uuid[]))"
        : "record.opportunity_id=ANY($1::uuid[])"
    const rows = await db.query(`SELECT to_jsonb(record) AS record FROM public.${table} record WHERE ${parent} ORDER BY to_jsonb(record)::text`, [Object.values(ids).filter(id => ![ids.match, ids.endedMatch, ids.internalMatch, ids.active].includes(id))])
    result[table] = rows.rows.map(row => row.record)
  }
  const pausedIds = Object.values(ids).filter(id => ![ids.match, ids.endedMatch, ids.internalMatch, ids.active].includes(id))
  result.pursuit_ldc_staging = (await db.query("SELECT to_jsonb(stage) AS record FROM public.pursuit_ldc_staging stage JOIN public.opportunity_matches m ON m.id=stage.match_id WHERE m.opportunity_id=ANY($1::uuid[]) ORDER BY stage.id", [pausedIds])).rows.map(row => row.record)
  result.pursuit_external_ldc_receipts = (await db.query("SELECT to_jsonb(link) AS record FROM public.pursuit_external_ldc_receipts link JOIN public.opportunity_pursuit_external_handoffs receipt ON receipt.id=link.receipt_id WHERE receipt.opportunity_id=ANY($1::uuid[]) ORDER BY link.receipt_id", [pausedIds])).rows.map(row => row.record)
  result.pursuit_ldc_versions = (await db.query("SELECT DISTINCT to_jsonb(version) AS record FROM public.pursuit_ldc_versions version JOIN public.pursuit_external_ldc_receipts link ON link.version_id=version.id JOIN public.opportunity_pursuit_external_handoffs receipt ON receipt.id=link.receipt_id WHERE receipt.opportunity_id=ANY($1::uuid[]) ORDER BY record::text", [pausedIds])).rows.map(row => row.record)
  for (const table of ["opportunity_interest_events", "opportunity_interest_notification_deliveries", "staff_email_review_events", "ma_source_email_send_reservations", "ma_contact_email_policy_events", "ma_interactions", "email_logs"]) {
    result[table] = (await db.query(`SELECT to_jsonb(record) AS record FROM public.${table} record ORDER BY to_jsonb(record)::text`)).rows.map(row => row.record)
  }
  return result
}

test("ordinary Paused history preserves genuine own openings and relationships without private preview or writes", async ({ page: staff, browser }) => {
  test.setTimeout(300_000)
  const db = new Client({ connectionString: databaseUrl.toString() })
  await db.connect()
  const ownerContext = await browser.newContext()
  const historyContexts: BrowserContext[] = []
  const owner = await ownerContext.newPage()
  const priorJourney = (await db.query<{ enabled: boolean }>("SELECT enabled FROM public.wave_journey_settings WHERE singleton")).rows[0]!
  const priorLanguage = (await db.query<{ language: string }>("SELECT language FROM public.repreneur_ui_preferences WHERE user_id=$1", [fixture.authIds.realUser])).rows
  let primaryFailure: unknown
  let failedBeforeCleanup = false
  try {
    await db.query("BEGIN")
    await db.query("SET LOCAL session_replication_role=replica")
    await db.query("UPDATE public.wave_journey_settings SET enabled=true WHERE singleton")
    for (const [kind, id] of Object.entries(ids).filter(([kind]) => !kind.toLowerCase().includes("match"))) {
      const isDemo = kind === "wrongMode"
      await db.query(`INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,public_title,description,created_by)
        VALUES($1,$2,'active',$3,$4,$5,'Synthetic disposable description',$6)`, [id, `QA-256-${kind}`, isDemo, isDemo ? fixture.ids.demoOffice : fixture.ids.realOffice, title(kind), fixture.authIds.staffUser])
      await db.query(`INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
        VALUES($1,$2,'Synthetic source contact',true,$3)`, [id, isDemo ? fixture.ids.demoAffiliation : fixture.ids.realAffiliation, fixture.authIds.staffUser])
    }
    await db.query(`INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES
      ($1,$2,$3,'proposed',$4),($5,$6,$3,'active_pursuit',$4),($7,$8,$3,'draft',$4)`,
      [ids.match, ids.relation, fixture.ids.realRepreneur, fixture.authIds.staffUser, ids.endedMatch, ids.ended, ids.internalMatch, ids.internal])
    await db.query(`INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,metadata)
      VALUES($1,$2,$3,'mutual_interest_validated',$4,'qa-256-ended-cycle','{}')`, [ids.endedMatch, ids.ended, fixture.ids.realRepreneur, fixture.authIds.staffUser])
    await db.query("COMMIT")
    await login(owner, db, fixture.authIds.realUser, fixture.repreneurs.real.email)
    await owner.getByRole("group", { name: /^(Interface language|Langue de l’interface)$/ }).getByRole("button", { name: "English", exact: true }).click()
    await owner.goto(`/portal/deals/${ids.visit}`)
    await expect(owner.getByRole("heading", { name: title("visit"), exact: true })).toBeVisible()
    await expect.poll(async () => (await db.query("SELECT count(*)::int AS count FROM public.repreneur_opportunity_review_state WHERE repreneur_id=$1 AND opportunity_id=$2", [fixture.ids.realRepreneur, ids.visit])).rows[0].count).toBe(1)
    await expect(owner.getByRole("button", { name: "Mark as reviewed", exact: true })).toBeEnabled()
    const reviewRequest = owner.waitForRequest(request => request.method() === "POST" && Boolean(request.headers()["next-action"]) && new URL(request.url()).pathname === `/portal/deals/${ids.visit}`)
    await owner.getByRole("button", { name: "Mark as reviewed", exact: true }).click()
    const staleReview = await reviewRequest
    await expect.poll(async () => (await db.query("SELECT reviewed FROM public.repreneur_opportunity_review_state WHERE repreneur_id=$1 AND opportunity_id=$2", [fixture.ids.realRepreneur, ids.visit])).rows[0]?.reviewed).toBe(true)
    await owner.goto(`/portal/deals/${ids.match}`)
    await expect(owner.getByRole("button", { name: "I'm interested", exact: true })).toBeVisible()
    await expect.poll(async () => (await db.query("SELECT count(*)::int AS count FROM public.repreneur_opportunity_review_state WHERE repreneur_id=$1 AND opportunity_id=$2", [fixture.ids.realRepreneur, ids.relation])).rows[0].count).toBe(1)
    // The detail also records a personal opening on this URL. Capture the
    // clicked response's bound match, rather than a concurrent opening POST.
    const interestRequest = owner.waitForRequest(request => request.method() === "POST" && Boolean(request.headers()["next-action"]) && new URL(request.url()).pathname === `/portal/deals/${ids.match}` && Boolean(request.postData()?.includes(JSON.stringify(ids.match))))
    await owner.locator('form[data-wave-action="express_interest"]').getByRole("button", { name: "I'm interested", exact: true }).click()
    const staleInterest = await interestRequest
    await expect(owner).toHaveURL(/\/portal\/deals$/)
    await login(staff, db, fixture.authIds.staffUser, fixture.staff.email)
    await staff.goto(`/opportunities/${ids.relation}?tab=recommendations`)
    await staff.getByRole("row").filter({ hasText: fixture.repreneurs.real.email }).getByRole("button", { name: "Validate", exact: true }).click()
    await expect.poll(async () => (await db.query("SELECT status::text FROM public.opportunity_matches WHERE id=$1", [ids.match])).rows[0].status).toBe("active_pursuit")
    // Conditional CTA disposition: the released rule is already correct after
    // actual staff validation, including list, refresh and the direct detail.
    await owner.goto("/portal/deals")
    await expect(owner.getByText(title("relation"), { exact: true })).toBeVisible()
    const validatedCard = owner.locator('[data-slot="card"]').filter({ hasText: title("relation") })
    await expect(validatedCard.getByText("Active pursuit", { exact: true })).toBeVisible()
    await expect(validatedCard.getByRole("button", { name: "I'm interested", exact: true })).toHaveCount(0)
    await owner.goto(`/portal/deals/${ids.match}`)
    await owner.reload()
    await expect(owner.getByRole("button", { name: "I'm interested", exact: true })).toHaveCount(0)
    await expect(owner.getByText("Re-New has validated this opportunity as an active pursuit. The next available action is shown in the documents area below.", { exact: true })).toBeVisible()

    // Actual E6 authorization gives this owner a real old NDA URL. No grant or
    // provider receipt is fabricated; the native memo positive control is SQL.
    const currentLdc = await seedCurrentExternalLdc(db, fixture.ids.realRepreneur)
    await staff.goto(`/opportunities/${ids.relation}?tab=pursuit`)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const external = async (reference: string) => {
      await staff.getByRole("button", { name: /^(Record as done outside WAVE|Enregistrer comme réalisé hors WAVE)$/ }).click()
      const dialog = staff.getByRole("dialog")
      await dialog.getByRole("button", { name: "English", exact: true }).click()
      await dialog.getByLabel("Actual exchange date", { exact: true }).fill(yesterday)
      await dialog.getByLabel("Channel", { exact: true }).selectOption("phone")
      await dialog.getByLabel("Meaningful reference", { exact: true }).fill(reference)
      await dialog.getByRole("button", { name: "Record completed exchange", exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
    await expect(staff.locator("[data-external-ldc-version]")).toHaveCount(0)
    await external("Synthetic prior qualification request")
    const e4Receipt = (await db.query("SELECT id,context FROM public.opportunity_pursuit_external_handoffs WHERE match_id=$1 AND handoff_type='e4'", [ids.match])).rows[0]
    expect(e4Receipt.context.ldc.content_sha256).toBe(currentLdc.sha256)
    const manifest = JSON.parse(await readFile(join(runnerTemp!, "opening-readiness-inputs", "manifest.json"), "utf8")) as { files: { blankNda: { path: string; sha256: string; bytes: number } } }
    const blank = staff.getByRole("heading", { name: "Blank NDA template", exact: true }).locator("xpath=ancestor::section")
    await blank.locator("#blank_template-title").fill("QA PAUSED BLANK NDA — SYNTHETIC")
    await blank.locator("#blank_template-file").setInputFiles(manifest.files.blankNda.path)
    await blank.getByRole("button", { name: "Record version", exact: true }).click()
    await expect(blank.getByText("Version 1 recorded.")).toBeVisible()
    await staff.getByRole("button", { name: "Record intermediary qualification", exact: true }).click()
    await expect(staff.getByRole("button", { name: "Validate blank template", exact: true })).toBeEnabled()
    await staff.getByRole("button", { name: "Validate blank template", exact: true }).click()
    await staff.getByRole("button", { name: "Pass Gate 1", exact: true }).click()
    await expect(staff.getByRole("button", { name: "Prepare NDA-ready notice", exact: true })).toBeVisible()
    await external("Synthetic prior NDA-ready exchange")
    const oldNdaUrl = `/portal/deals/${ids.match}/nda-template`
    const authorizedNda = await owner.request.get(oldNdaUrl)
    expect(authorizedNda.status()).toBe(200)
    expect(authorizedNda.headers()["cache-control"]).toBe("private, no-store")
    const ndaBytes = await authorizedNda.body()
    expect(ndaBytes.byteLength).toBe(manifest.files.blankNda.bytes)
    expect(createHash("sha256").update(ndaBytes).digest("hex")).toBe(manifest.files.blankNda.sha256)
    await db.query("SELECT * FROM public.record_repreneur_opportunity_review($1,$2)", [fixture.ids.realNonOwnerRepreneur, ids.other])
    await db.query("SELECT public.journey_transition_terminal($1,'drop',$2,'qa-256-drop','buyer_search_paused')", [ids.endedMatch, fixture.authIds.staffUser])
    for (const id of [ids.relation, ids.visit, ids.ended, ids.other, ids.unopened, ids.internal, ids.wrongMode]) {
      await db.query("SELECT public.pause_opportunity_with_reason($1,'seller_paused_sale',$2,NULL)", [id, fixture.authIds.staffUser])
    }
    const before = await snapshot(db)
    const pausedLdc = await owner.request.get(`/api/pursuit-handoffs/${e4Receipt.id}/ldc?download`)
    expect(pausedLdc.status()).toBe(404)
    expect(pausedLdc.headers()["cache-control"]).toBe("private, no-store")
    expect(await snapshot(db)).toEqual(before)
    const replayReview = await owner.request.post(staleReview.url(), { data: staleReview.postDataBuffer()!, headers: {
      "next-action": staleReview.headers()["next-action"]!, "content-type": staleReview.headers()["content-type"]!,
      origin: "http://127.0.0.1:3000",
    } })
    expect(replayReview.status()).toBe(200)
    expect(await replayReview.text()).toContain("Your review status could not be saved. Please try again.")
    const replay = await owner.request.post(staleInterest.url(), { data: staleInterest.postDataBuffer()!, headers: {
      "next-action": staleInterest.headers()["next-action"]!, "content-type": staleInterest.headers()["content-type"]!,
      accept: staleInterest.headers()["accept"]!,
      origin: "http://127.0.0.1:3000",
    } })
    expect(replay.status()).toBe(500)
    expect(replay.headers()["content-type"]).toMatch(/^text\/x-component(?:;|$)/)
    expect(replay.headers()["x-action-redirect"]).toBeUndefined()
    const flight = (await replay.text()).split("\n")
    const rootRecord = flight.find(line => line.startsWith("0:"))
    expect(rootRecord).toBeDefined()
    const actionResult = (JSON.parse(rootRecord!.slice(2)) as { a: string }).a
    expect(actionResult).toMatch(/^\$@[0-9a-f]+$/)
    const errorRecord = flight.find(line => line.startsWith(`${actionResult.slice(2)}:E`))
    expect(errorRecord).toBeDefined()
    expect(JSON.parse(errorRecord!.slice(errorRecord!.indexOf(":E") + 2))).toMatchObject({ message: "This opportunity is no longer available for your response." })
    expect(await snapshot(db)).toEqual(before)
    expect((await owner.request.get(oldNdaUrl)).status()).toBe(404)
    expect((await owner.request.get(`/portal/deals/${ids.match}/documents/25600000-0000-4000-8000-000000000099`)).status()).toBe(404)
    const evidenceDirectory = join(runnerTemp!, "opening-readiness-evidence")
    await mkdir(evidenceDirectory, { recursive: true })
    const mobileOwnerContext = await browser.newContext({ storageState: await ownerContext.storageState(), hasTouch: true })
    historyContexts.push(mobileOwnerContext)
    const mobileOwner = await mobileOwnerContext.newPage()
    for (const [size, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
      const historyOwner = size === "mobile" ? mobileOwner : owner
      await historyOwner.setViewportSize({ width, height })
      for (const language of ["en", "fr"] as const) {
        await historyOwner.goto("/portal/deals")
        const languageButton = historyOwner.getByRole("group", { name: /^(Interface language|Langue de l’interface)$/ }).getByRole("button", { name: language === "en" ? "English" : "Français", exact: true })
        await activateHistoryControl(languageButton, size)
        const search = historyOwner.getByRole("textbox", { name: language === "en" ? "Search deal flow" : "Rechercher parmi les opportunités" })
        await search.fill("QA PAUSED")
        for (const kind of ["relation", "visit", "ended", "active"]) await expect(historyOwner.getByText(title(kind), { exact: true })).toBeVisible()
        for (const kind of ["other", "unopened", "internal", "wrongMode"]) await expect(historyOwner.getByText(title(kind), { exact: true })).toHaveCount(0)
        const cards = historyOwner.locator('[data-slot="card"]').filter({ hasText: title("visit") })
        await expect(cards).toHaveCount(1)
        await expect(cards.getByText(language === "en" ? "Paused" : "En pause", { exact: true })).toBeVisible()
        await expect(cards.getByText(/^(Viewed|Reviewed|Vue|Examinée)$/)).toHaveCount(0)
        const detail = cards.getByRole("link", { name: language === "en" ? "View detail" : "Voir le détail", exact: true })
        await expect(detail).toHaveAttribute("href", `/portal/deals/${ids.visit}`)
        await activateHistoryControl(detail, size)
        await expect(historyOwner.getByRole("heading", { name: title("visit"), exact: true })).toBeVisible()
        await expect(historyOwner.getByRole("button", { name: /^(I'm interested|Je suis intéressé|Mark as reviewed|Marquer comme examinée|Undo reviewed)$/ })).toHaveCount(0)
        await expect(historyOwner.locator('input[type="file"]')).toHaveCount(0)
        await expect(historyOwner.getByText(language === "en" ? "This opportunity is temporarily paused. Its retained history is read-only; responses and confidential documents are unavailable." : "Cette opportunité est temporairement en pause. Son historique reste en lecture seule ; les réponses et les documents confidentiels sont indisponibles.", { exact: true })).toBeVisible()
        await historyOwner.reload()
        const ownerWorkspace = historyOwner.locator('[data-wave-workspace="pursuit"]').filter({ visible: true })
        await waitForHistoryCapture(historyOwner, ownerWorkspace, language, "visit")
        await historyOwner.screenshot({ path: join(evidenceDirectory, `paused-history-${language}-${size}.png`), fullPage: true })
        await historyOwner.goBack()
        await historyOwner.goForward()
        await expect(historyOwner.getByRole("heading", { name: title("visit"), exact: true })).toBeVisible()
        await historyOwner.goto(`/portal/deals/${ids.match}`)
        await expect(historyOwner.getByText(language === "en" ? "Previous relationship: Active pursuit" : "Relation précédente : Dossier de reprise actif", { exact: true })).toBeVisible()
        await waitForHistoryCapture(historyOwner, ownerWorkspace, language, "relation")
        const documents = historyOwner.getByRole("tab", { name: "Documents", exact: true })
        await activateHistoryControl(documents, size)
        await expect(historyOwner.locator('a[href*="nda-template"],a[href*="/documents/"]')).toHaveCount(0)
      }
    }
    await owner.goto(`/portal/deals/${ids.endedMatch}`)
    await owner.getByRole("group", { name: /^(Interface language|Langue de l’interface)$/ }).getByRole("button", { name: "English", exact: true }).click()
    await expect(owner.getByRole("heading", { name: title("ended"), exact: true })).toBeVisible()
    await expect(owner.getByText("Previous relationship: Dropped", { exact: true })).toBeVisible()
    await expect(owner.getByRole("button", { name: "Reconsider this opportunity", exact: true })).toHaveCount(0)
    const ownerPreferenceBeforePreview = (await db.query("SELECT to_jsonb(preference) AS record FROM public.repreneur_ui_preferences preference WHERE user_id=$1", [fixture.authIds.realUser])).rows
    for (const [size, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
      const previewContext = await browser.newContext({ storageState: await staff.context().storageState(),
        viewport: { width, height }, hasTouch: size === "mobile" })
      historyContexts.push(previewContext)
      const preview = await previewContext.newPage()
      for (const language of ["en", "fr"] as const) {
        await preview.goto(`/portal-preview?repreneurId=${fixture.ids.realRepreneur}`)
        const languageButton = preview.getByRole("group", { name: /^(Interface language|Langue de l’interface)$/ }).getByRole("button", { name: language === "en" ? "English" : "Français", exact: true })
        await activateHistoryControl(languageButton, size)
        await expect(preview.getByRole("heading", { name: "Portal preview", exact: true })).toBeVisible()
        await expect(preview.getByText("Staff only", { exact: true })).toBeVisible()
        await expect(preview.locator("html")).toHaveAttribute("lang", "en")
        const list = preview.getByRole("tabpanel", { name: "Deals", exact: true }).filter({ visible: true })
        await list.getByRole("textbox", { name: language === "en" ? "Search deal flow" : "Rechercher parmi les opportunités" }).fill("QA PAUSED")
        for (const kind of ["relation", "ended", "active"]) await expect(list.getByText(title(kind), { exact: true })).toBeVisible()
        for (const kind of ["visit", "other", "unopened", "internal", "wrongMode"]) await expect(list.getByText(title(kind), { exact: true })).toHaveCount(0)
        await expect(list.getByText(/^(Viewed|Reviewed|Not yet viewed|Vue|Examinée|Pas encore vue)$/)).toHaveCount(0)
        const card = list.locator('[data-slot="card"]').filter({ has: preview.getByText(title("relation"), { exact: true }) })
        await expect(card.getByText(language === "en" ? "Paused" : "En pause", { exact: true })).toBeVisible()
        await expect(card.getByText(language === "en" ? "Read-only history" : "Historique en lecture seule", { exact: true })).toBeVisible()
        await expect(card.getByRole("button", { name: /interest|intérêt|review|examin|reconsider/i })).toHaveCount(0)
        const detail = card.getByRole("link", { name: language === "en" ? "Preview detail" : "Voir l’aperçu détaillé", exact: true })
        await activateHistoryControl(detail, size)
        const workspace = preview.locator('[data-wave-workspace="pursuit"]').filter({ visible: true })
        await expect(workspace.getByRole("heading", { name: title("relation"), exact: true })).toBeVisible()
        await expect(workspace.getByText(language === "en" ? "Previous relationship: Active pursuit" : "Relation précédente : Dossier de reprise actif", { exact: true })).toBeVisible()
        await expect(workspace.getByText(language === "en" ? "This opportunity is temporarily paused. Its retained history is read-only; responses and confidential documents are unavailable." : "Cette opportunité est temporairement en pause. Son historique reste en lecture seule ; les réponses et les documents confidentiels sont indisponibles.", { exact: true })).toBeVisible()
        await expect(workspace.getByRole("button", { name: /interest|intérêt|review|examin|reconsider|resume|reprendre|sign|advance|upload|record|enregistrer/i })).toHaveCount(0)
        await expect(workspace.getByText(/^(Viewed|Reviewed|Not yet viewed|Vue|Examinée|Pas encore vue)$/)).toHaveCount(0)
        await expect(workspace.locator('input[type="file"],a[href*="nda-template"],a[href*="/documents/"]')).toHaveCount(0)
        await waitForHistoryCapture(preview, workspace, language, "relation")
        await preview.screenshot({ path: join(evidenceDirectory, `paused-preview-${language}-${size}.png`), fullPage: true })
        const documents = workspace.getByRole("tab", { name: "Documents", exact: true })
        await activateHistoryControl(documents, size)
        await expect(workspace.getByRole("tabpanel", { name: "Documents", exact: true })).toBeVisible()
        await expect(workspace.locator('input[type="file"],a[href*="nda-template"],a[href*="/documents/"]')).toHaveCount(0)
        const journey = workspace.getByRole("tab", { name: language === "en" ? "Journey" : "Parcours", exact: true })
        await activateHistoryControl(journey, size)
        await expect(workspace.getByRole("heading", { name: language === "en" ? "Read-only history" : "Historique en lecture seule", exact: true })).toBeVisible()
        await expect(preview.getByText(title("visit"), { exact: true })).toHaveCount(0)
        // Preserve the real workspace binding when probing a private visit ID.
        const deniedUrl = new URL(preview.url())
        deniedUrl.searchParams.set("dealId", ids.visit)
        await preview.goto(deniedUrl.toString())
        await expect(preview.getByText("Deal not visible in portal preview", { exact: true })).toBeVisible()
        await expect(preview.getByRole("heading", { name: title("visit"), exact: true })).toHaveCount(0)
        await expect(preview.locator('[data-wave-workspace="pursuit"],input[type="file"],a[href*="nda-template"],a[href*="/documents/"]')).toHaveCount(0)
        await expect(preview.getByText("Staff only", { exact: true })).toBeVisible()
        expect(await snapshot(db)).toEqual(before)
      }
    }
    expect((await db.query("SELECT to_jsonb(preference) AS record FROM public.repreneur_ui_preferences preference WHERE user_id=$1", [fixture.authIds.realUser])).rows).toEqual(ownerPreferenceBeforePreview)
    expect(await snapshot(db)).toEqual(before)
    // Mixed-list preservation: a new Active opening/review remains usable even
    // when this owner's same ordinary list also contains read-only history.
    await owner.goto(`/portal/deals/${ids.active}`)
    await owner.getByRole("group", { name: /^(Interface language|Langue de l’interface)$/ }).getByRole("button", { name: "English", exact: true }).click()
    await expect(owner.getByRole("button", { name: "Mark as reviewed", exact: true })).toBeEnabled()
    await owner.getByRole("button", { name: "Mark as reviewed", exact: true }).click()
    await expect.poll(async () => (await db.query("SELECT reviewed FROM public.repreneur_opportunity_review_state WHERE repreneur_id=$1 AND opportunity_id=$2", [fixture.ids.realRepreneur, ids.active])).rows[0]?.reviewed).toBe(true)
    await owner.goto("/portal/deals")
    const activeCard = owner.locator('[data-slot="card"]').filter({ hasText: title("active") })
    await expect(activeCard.getByRole("button", { name: "Undo reviewed", exact: true })).toBeVisible()
    expect(await snapshot(db)).toEqual(before)
    expect((await db.query("SELECT count(*)::int AS count FROM public.opportunity_matches WHERE opportunity_id=$1", [ids.visit])).rows[0].count).toBe(0)
    await writeFile(join(evidenceDirectory, "paused-history.json"), JSON.stringify({ genuineOwnOpening: true, authenticRelationships: true,
      deduplicated: true, exclusions: true, previewPrivateBoundary: true, pausedReadsUnchanged: true, staleCommandDenied: true,
      oldNdaLinkDenied: true, validatedInterestAlreadyCorrect: true, frenchEnglishDesktopMobile: true,
      previewFrenchEnglishDesktopMobile: true, navigationCoherent: true }))
  } catch (error) {
    primaryFailure = error
    failedBeforeCleanup = true
  } finally {
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined
    let cleanupFailed = false
    const cleanup = Promise.allSettled([
      ...[...historyContexts, ownerContext].map(context => context.close()),
      (async () => {
        try {
          const restored = await Promise.allSettled([
            db.query("UPDATE public.wave_journey_settings SET enabled=$1 WHERE singleton", [priorJourney.enabled]),
            priorLanguage.length
              ? db.query("UPDATE public.repreneur_ui_preferences SET language=$1 WHERE user_id=$2", [priorLanguage[0]!.language, fixture.authIds.realUser])
              : db.query("DELETE FROM public.repreneur_ui_preferences WHERE user_id=$1", [fixture.authIds.realUser]),
          ])
          if (restored.some(result => result.status === "rejected")) throw new Error("Synthetic Paused settings restoration failed.")
        } finally { await db.end() }
      })(),
    ])
    try {
      const results = await Promise.race([cleanup, new Promise<never>((_, reject) => {
        cleanupTimer = setTimeout(() => reject(new Error("Synthetic Paused cleanup exceeded 5 seconds.")), 5_000)
      })])
      cleanupFailed = results.some(result => result.status === "rejected")
    } catch { cleanupFailed = true }
    finally { if (cleanupTimer) clearTimeout(cleanupTimer) }
    if (failedBeforeCleanup) {
      if (cleanupFailed) console.error("Synthetic Paused cleanup was incomplete; the original failure is preserved and whole-stack teardown is required.")
      throw primaryFailure
    }
    if (cleanupFailed) throw new Error("Synthetic Paused resource cleanup failed; whole-stack teardown is required.")
  }
})
