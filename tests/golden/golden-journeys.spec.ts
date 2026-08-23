import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { RUNTIME_FIXTURES_FILE, RUN_DIR, databaseClient, readJson, recordRuntimeFixtures, storageClient } from "../../scripts/qa/phase-b-common.mjs"

let manifest: any

const protectedContext = {
  baseURL: process.env.QA_BROWSER_BASE_URL,
}

async function protectValidationOrigin(context: BrowserContext) {
  const origin = new URL(process.env.QA_BROWSER_BASE_URL!).origin
  await context.route(`${origin}/**`, async (route) => {
    await route.continue({ headers: {
      ...route.request().headers(),
      "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
      "x-vercel-set-bypass-cookie": "true",
    } })
  })
  return context
}

async function staffContext(browser: any): Promise<BrowserContext> {
  return protectValidationOrigin(await browser.newContext({ ...protectedContext, storageState: `${RUN_DIR}/auth/staff.json` }))
}

async function portalContext(browser: any): Promise<BrowserContext> {
  return protectValidationOrigin(await browser.newContext({ ...protectedContext, storageState: `${RUN_DIR}/auth/portal.json` }))
}

async function mobileStaffContext(browser: any): Promise<BrowserContext> {
  return protectValidationOrigin(await browser.newContext({
    ...protectedContext,
    viewport: { width: 390, height: 844 },
    storageState: `${RUN_DIR}/auth/staff.json`,
  }))
}

async function choose(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByLabel(label).click()
  await page.getByRole("option", { name: option }).click()
}

async function clickChoice(page: Page, id: string) {
  await page.locator(`[id="${id.replaceAll('"', '\\"')}"]`).locator("..").evaluate((element) => (element as HTMLElement).click())
}

async function fillStaffRepreneur(page: Page, email: string, firstName = "Pilot") {
  await page.getByLabel("First name").fill(firstName)
  await page.getByLabel("Last name").fill(manifest.fixturePrefix)
  await page.locator("#email").fill(email)
}

function sectionFor(page: Page, title: string) {
  return page.locator("section", { has: page.getByRole("heading", { name: title, exact: true }) })
}

async function createManifestOwnedDeal(database: any, suffix: string) {
  const fields = {
    geography_node_id: manifest.ids.geography,
    sector: "Tech & Digital",
    location: "Paris",
    revenue_meur: 2.4,
    ebitda_keur: 420,
    headcount: 24,
    headcount_range: "10-50",
    date_added: "2026-08-01",
    date_added_precision: "day",
    public_title: `${manifest.fixturePrefix} ${suffix}`,
    teaser_summary: `${manifest.fixturePrefix} safe ${suffix}`,
    internal_notes: null,
  }
  const created = await database.query(`SELECT (public.create_opportunity_with_office_context(
    $1::text, $2::uuid, $3::uuid[], $4::uuid, $5::text, $6::public.opportunity_status, $7::text, $8::jsonb
  )).id AS id`, ["", manifest.ids.office, [manifest.ids.affiliation], manifest.ids.affiliation, `${manifest.fixturePrefix} ${suffix} internal`, "active", manifest.actors.staff.userId, JSON.stringify(fields)])
  const id = created.rows[0]?.id
  if (typeof id !== "string") throw new Error("Golden P3 failed: additional-opportunity-id")
  return id
}

async function maFixtureCounts(database: any) {
  const result = await database.query(`SELECT
    (SELECT count(*)::int FROM public.ma_firms WHERE id = ANY($1::uuid[])) AS firms,
    (SELECT count(*)::int FROM public.ma_offices WHERE id = ANY($2::uuid[])) AS offices,
    (SELECT count(*)::int FROM public.ma_contacts WHERE id = ANY($3::uuid[])) AS contacts,
    (SELECT count(*)::int FROM public.ma_contact_office_affiliations WHERE id = ANY($4::uuid[])) AS affiliations`, [
    [manifest.ids.firm, manifest.ids.provisionalFirm],
    [manifest.ids.office, manifest.ids.provisionalOffice],
    [manifest.ids.contact, manifest.ids.provisionalCountContact, manifest.ids.provisionalContextContact],
    [manifest.ids.affiliation, manifest.ids.provisionalAffiliation],
  ])
  return result.rows[0]
}

async function recordW127FirstOnlyContact(database: any, firstOnlyName: string) {
  const firstOnly = await database.query(`SELECT f.id AS firm_id, o.id AS office_id, c.id AS contact_id, a.id AS affiliation_id
    FROM public.ma_firms f
    JOIN public.ma_offices o ON o.firm_id=f.id
    JOIN public.ma_contact_office_affiliations a ON a.office_id=o.id
    JOIN public.ma_contacts c ON c.id=a.contact_id
    WHERE f.name=$1 AND c.first_name=$2 AND c.last_name IS NULL AND f.created_by=$3`, [
    `${manifest.fixturePrefix} W127 first-only firm`, firstOnlyName, manifest.actors.staff.userId,
  ])
  expect(firstOnly.rows).toHaveLength(1)
  const fixture = {
    firmId: firstOnly.rows[0].firm_id,
    officeId: firstOnly.rows[0].office_id,
    contactIds: [firstOnly.rows[0].contact_id],
    affiliationIds: [firstOnly.rows[0].affiliation_id],
  }
  await recordRuntimeFixtures({ w127FixtureIds: fixture })
  return fixture
}

async function recordW127LastOnlyContact(database: any, fixture: any, lastOnlyName: string) {
  const lastOnly = await database.query(`SELECT c.id AS contact_id, a.id AS affiliation_id
    FROM public.ma_contact_office_affiliations a
    JOIN public.ma_contacts c ON c.id=a.contact_id
    WHERE a.office_id=$1 AND c.first_name IS NULL AND c.last_name=$2 AND c.created_by=$3`, [
    fixture.officeId, lastOnlyName, manifest.actors.staff.userId,
  ])
  expect(lastOnly.rows).toHaveLength(1)
  await recordRuntimeFixtures({
    w127FixtureIds: {
      ...fixture,
      contactIds: [...fixture.contactIds, lastOnly.rows[0].contact_id],
      affiliationIds: [...fixture.affiliationIds, lastOnly.rows[0].affiliation_id],
    },
  })
}

function captureClientErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`)
  })
}

test.beforeAll(async () => {
  manifest = await readJson(`${RUN_DIR}/manifest.json`)
})

test.describe.serial("Golden journeys", () => {
  test("P1 public application persists one profile and one CV", async ({ browser }) => {
    const priorRuntime = await readJson(RUNTIME_FIXTURES_FILE).catch(() => ({}))
    if (priorRuntime.storageObjects?.length) await storageClient().storage.from("cvs").remove(priorRuntime.storageObjects)
    if (priorRuntime.p1RepreneurId) {
      const retryDatabase = await databaseClient()
      await retryDatabase.query("DELETE FROM public.repreneurs WHERE id=$1", [priorRuntime.p1RepreneurId])
      await retryDatabase.end()
    }
    await recordRuntimeFixtures({ storageObjects: [], p1RepreneurId: null })
    const context = await protectValidationOrigin(await browser.newContext(protectedContext))
    const page = await context.newPage()
    await page.goto("/intake-v2")
    await page.getByRole("button", { name: "English" }).click()

    const next = page.getByRole("button", { name: "Continue" })
    await expect(next).toBeDisabled()
    await page.getByLabel(/Resume/).setInputFiles({ name: `${manifest.fixturePrefix}.txt`, mimeType: "text/plain", buffer: Buffer.from(manifest.fixturePrefix) })
    await expect(page.getByText(/Invalid format.*PDF, DOC or DOCX/i)).toBeVisible()

    const beforeStorage = await databaseClient()
    const invalidCount = await beforeStorage.query("SELECT count(*)::int AS count FROM storage.objects")
    await beforeStorage.end()
    expect(invalidCount.rows[0].count).toBe(1)

    await page.getByLabel("First name").fill("Applicant")
    await page.getByLabel("Last name").fill(manifest.fixturePrefix)
    await page.getByLabel("Email").fill(manifest.actors.applicant.email)
    await page.getByLabel("Phone").fill("+33 6 00 00 00 00")
    const uploadResponse = page.waitForResponse((response) => response.url().includes("/api/upload-cv") && response.request().method() === "POST")
    await page.getByLabel(/Resume/).setInputFiles(`${RUN_DIR}/pilot.pdf`)
    const uploaded = await (await uploadResponse).json()
    await recordRuntimeFixtures({ storageObjects: [uploaded.path] })
    await expect(page.getByText(/uploaded/i)).toBeVisible()
    await next.click()

    for (const id of ["q05-entrepreneur", "q06-more_than_20", "q07-general_management", "q08-multiple", "q09-both", "q10-financial"]) await clickChoice(page, id)
    await page.getByRole("button", { name: "Continue" }).click()

    await clickChoice(page, "q11-priority-preferred")
    await clickChoice(page, "q11-framed")
    await page.getByRole("button", { name: "Continue" }).click()

    for (const id of ["q12-all-france", "q13-Tech & Digital", "q14-1-3M", "q15-majority_without_fund", "q16-251-350"]) await clickChoice(page, id)
    await page.getByRole("button", { name: "Continue" }).click()

    await clickChoice(page, "q17-deal_access")
    await clickChoice(page, "marketing_consent")
    await page.getByRole("button", { name: "Review" }).click()
    await page.getByRole("button", { name: "Submit my application" }).click()
    await page.waitForURL(/\/intake-v2\/success/)
    await page.reload()
    await expect(page).toHaveURL(/\/intake-v2\/success/)
    await expect(page.getByRole("heading", { name: "Thank you for your application!" })).toBeVisible()
    await page.screenshot({ path: `${RUN_DIR}/test-results/p1-public-success.png` })

    const database = await databaseClient()
    const result = await database.query("SELECT id, source, cv_url FROM public.repreneurs WHERE lower(email)=lower($1)", [manifest.actors.applicant.email])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].source).toBe("intake_v2")
    expect(result.rows[0].cv_url).toMatch(/^cvs\//)
    await recordRuntimeFixtures({ p1RepreneurId: result.rows[0].id, storageObjects: [result.rows[0].cv_url] })
    const object = await database.query("SELECT count(*)::int AS count FROM storage.objects WHERE bucket_id='cvs' AND name=$1", [result.rows[0].cv_url])
    expect(object.rows[0].count).toBe(1)
    await database.end()

    const staff = await staffContext(browser)
    const staffPage = await staff.newPage()
    await staffPage.goto(`/repreneurs/${result.rows[0].id}`)
    await expect(staffPage.getByText(manifest.actors.applicant.email)).toBeVisible()
    await staffPage.screenshot({ path: `${RUN_DIR}/test-results/p1-staff-readback.png` })
    await staff.close()
    await context.close()
  })

  test("P2 staff validation and two-tab retry persist one normalized profile", async ({ browser }) => {
    const retryDatabase = await databaseClient()
    await retryDatabase.query("DELETE FROM public.repreneurs WHERE lower(email)=lower($1) AND source='staff_manual'", [manifest.actors.staffCreated.email])
    await retryDatabase.end()
    await recordRuntimeFixtures({ p2RepreneurId: null })
    const context = await staffContext(browser)
    const first = await context.newPage()
    await first.goto("/repreneurs/new")
    await expect(first).toHaveURL(/\/repreneurs\/new/)
    await first.getByLabel("Last name").fill(manifest.fixturePrefix)
    await first.locator("#email").fill(manifest.actors.staffCreated.email.toUpperCase())
    await first.getByRole("button", { name: "Create Repreneur" }).click()
    await expect(first.getByText(/Check this field:/)).toBeVisible()
    await expect(first.getByRole("link", { name: "First name" })).toBeVisible()
    await expect(first.getByText("Enter a first name.", { exact: true })).toHaveCount(1)

    const second = await context.newPage()
    await second.goto("/repreneurs/new")
    await fillStaffRepreneur(first, manifest.actors.staffCreated.email.toUpperCase())
    const firstSubmit = first.getByRole("button", { name: "Create Repreneur" })
    await Promise.allSettled([
      firstSubmit.click(),
      firstSubmit.click({ force: true }),
    ])
    await first.waitForURL(/\/repreneurs\/[0-9a-f-]+/)
    await first.reload()
    await expect(first.getByText(manifest.actors.staffCreated.email)).toBeVisible()
    await first.screenshot({ path: `${RUN_DIR}/test-results/p2-successful-profile.png` })
    await fillStaffRepreneur(second, manifest.actors.staffCreated.email)
    await second.getByRole("button", { name: "Create Repreneur" }).click()
    await expect(second.getByText(/already belongs to another Repreneur/i)).toBeVisible()
    await second.screenshot({ path: `${RUN_DIR}/test-results/p2-duplicate-rejection.png` })

    const database = await databaseClient()
    const rows = await database.query("SELECT id, email, lifecycle_status, source, created_by FROM public.repreneurs WHERE lower(email)=lower($1)", [manifest.actors.staffCreated.email])
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0]).toMatchObject({ email: manifest.actors.staffCreated.email, lifecycle_status: "lead", source: "staff_manual", created_by: manifest.actors.staff.userId })
    await recordRuntimeFixtures({ p2RepreneurId: rows.rows[0].id })
    await database.end()
    await context.close()
  })

  test("P3 proposal interest retry and staff validation agree after reload", async ({ browser }) => {
    const staff = await staffContext(browser)
    const page = await staff.newPage()
    const clientErrors: string[] = []
    captureClientErrors(page, clientErrors)
    await page.goto("/opportunities/new")
    await choose(page, "Status", "Active")
    await choose(page, "Secteur", "Tech & Digital")
    if (await page.getByLabel("Canonical geography").count()) {
      await choose(page, "Canonical geography", new RegExp(manifest.fixturePrefix))
    } else {
      await page.getByLabel("Ref. Mandat").fill(`${manifest.fixturePrefix}-REF`)
    }
    await page.getByLabel("Localisation").fill("Paris")
    await page.getByLabel("Description").fill(`${manifest.fixturePrefix} internal description`)
    await page.getByLabel("Public title").fill(`${manifest.fixturePrefix} opportunity`)
    await page.getByLabel("Teaser summary").fill(`${manifest.fixturePrefix} safe teaser`)
    const database = await databaseClient()

    // W-127: each mobile contact-creation surface states the shared rule,
    // accepts either half of a name, and leaves the optional details optional.
    const w127Mobile = await mobileStaffContext(browser)
    const w127Page = await w127Mobile.newPage()
    const w127Errors: string[] = []
    captureClientErrors(w127Page, w127Errors)
    const firstOnlyName = `${manifest.fixturePrefix} W127 First`
    const lastOnlyName = `${manifest.fixturePrefix} W127 Last`
    await w127Page.goto("/opportunities/new")
    await w127Page.getByRole("button", { name: "Add firm context" }).click()
    await expect(w127Page.getByText("First or last name required", { exact: true })).toHaveCount(2)
    await expect(w127Page.getByLabel("Email")).not.toHaveAttribute("required")
    await expect(w127Page.getByLabel("Phone")).not.toHaveAttribute("required")
    await expect(w127Page.getByLabel("Job title")).not.toHaveAttribute("required")
    await w127Page.getByLabel("M&A advisory firm").fill(`${manifest.fixturePrefix} W127 first-only firm`)
    await w127Page.getByRole("button", { name: "Create staff-only context" }).click()
    await expect(w127Page.getByText("Add a first name or last name for the first contact.", { exact: true })).toHaveCount(2)
    await w127Page.getByLabel("First name").fill(firstOnlyName)
    await w127Page.getByRole("button", { name: "Create staff-only context" }).click()
    await expect(w127Page.getByText("M&A firm, operating office, and first contact created.", { exact: true })).toBeVisible()
    const w127FirstOnlyFixture = await recordW127FirstOnlyContact(database, firstOnlyName)

    await w127Page.getByRole("button", { name: "Add office contact" }).click()
    await expect(w127Page.getByText("First or last name required", { exact: true })).toHaveCount(2)
    await expect(w127Page.locator("#office_contact_email")).not.toHaveAttribute("required")
    await expect(w127Page.locator("#office_contact_phone")).not.toHaveAttribute("required")
    await expect(w127Page.locator("#office_contact_job_title")).not.toHaveAttribute("required")
    await w127Page.getByRole("button", { name: "Add office contact" }).last().click()
    await expect(w127Page.getByText("Add a first name or last name for the contact.", { exact: true })).toHaveCount(2)
    await w127Page.getByLabel("Last name").fill(lastOnlyName)
    await w127Page.getByRole("button", { name: "Add office contact" }).last().click()
    await expect(w127Page.getByText("Office contact added.", { exact: true })).toBeVisible()
    await recordW127LastOnlyContact(database, w127FirstOnlyFixture, lastOnlyName)
    expect(w127Errors).toEqual([])
    await w127Mobile.close()

    // W-129: at the phone width, the existing-firm office chooser is filtered
    // by its chosen firm, clears stale state, exposes the distinct new-office
    // route, and makes no mutation until a submit action is chosen.
    const beforeExistingOfficeSelection = await maFixtureCounts(database)
    const w129Mobile = await mobileStaffContext(browser)
    const w129Page = await w129Mobile.newPage()
    const w129Errors: string[] = []
    captureClientErrors(w129Page, w129Errors)
    await w129Page.goto("/opportunities/new")
    await w129Page.getByRole("button", { name: "Add firm context" }).click()
    await w129Page.locator("#existing_firm_context").click()
    await choose(w129Page, "M&A advisory firm", new RegExp(`${manifest.fixturePrefix} firm`, "i"))
    await w129Page.getByLabel("Existing operating office").click()
    await expect(w129Page.getByRole("option", { name: new RegExp(`${manifest.fixturePrefix} office`, "i") })).toBeVisible()
    await expect(w129Page.getByRole("option", { name: /Acme Paris/i })).toHaveCount(0)
    await w129Page.keyboard.press("Escape")
    await choose(w129Page, "Existing operating office", new RegExp(`${manifest.fixturePrefix} office`, "i"))
    // Changing either the firm or the path clears a stale office before it can
    // be used; return to the seeded firm and select the real office again.
    await choose(w129Page, "M&A advisory firm", /Acme Co\./i)
    await expect(w129Page.getByLabel("Existing operating office")).toContainText("Choose this firm's operating office")
    await choose(w129Page, "M&A advisory firm", new RegExp(`${manifest.fixturePrefix} firm`, "i"))
    await w129Page.locator("#add_existing_firm_office").click()
    await expect(w129Page.getByLabel("Operating office")).toBeVisible()
    await expect(w129Page.getByRole("button", { name: "Create staff-only context" })).toBeVisible()
    await w129Page.locator("#use_existing_firm_office").click()
    await expect(w129Page.getByLabel("Existing operating office")).toContainText("Choose this firm's operating office")
    await choose(w129Page, "Existing operating office", new RegExp(`${manifest.fixturePrefix} office`, "i"))
    await w129Page.getByRole("button", { name: "Use operating office" }).click()
    expect(await maFixtureCounts(database)).toEqual(beforeExistingOfficeSelection)
    await expect(w129Page.getByText(`Firm: ${manifest.fixturePrefix} firm · Office: ${manifest.fixturePrefix} office`, { exact: true })).toBeVisible()
    expect(w129Errors).toEqual([])
    await w129Mobile.close()

    await page.getByRole("button", { name: "Add firm context" }).click()
    await page.locator("#existing_firm_context").click()
    await choose(page, "M&A advisory firm", new RegExp(`${manifest.fixturePrefix} firm`, "i"))
    await choose(page, "Existing operating office", new RegExp(`${manifest.fixturePrefix} office`, "i"))
    await page.getByRole("button", { name: "Use operating office" }).click()
    await expect(page.getByText(`Firm: ${manifest.fixturePrefix} firm · Office: ${manifest.fixturePrefix} office`, { exact: true })).toBeVisible()

    await page.locator(`#office_affiliation_${manifest.ids.affiliation}`).click()
    await page.locator(`input[name="primary_affiliation_id"][value="${manifest.ids.affiliation}"]`).check()
    const submitted = await page.locator("form").evaluate((form) => Object.fromEntries(new FormData(form as HTMLFormElement).entries()))
    expect(submitted).toMatchObject({
      status: "active",
      geography_node_id: manifest.ids.geography,
      source_office_id: manifest.ids.office,
      affiliation_ids: manifest.ids.affiliation,
      primary_affiliation_id: manifest.ids.affiliation,
      location: "Paris",
    })
    await page.getByRole("button", { name: "Create opportunity" }).click()
    await page.waitForURL(/\/opportunities\/[0-9a-f-]+/)
    const opportunityId = page.url().split("/").pop()!
    await recordRuntimeFixtures({ p3OpportunityId: opportunityId })

    await page.getByRole("tab", { name: "Recommendations" }).click()
    await page.getByRole("combobox", { name: "Repreneur" }).click()
    await page.getByRole("option").filter({ hasText: manifest.actors.portal.email }).click()
    await page.getByRole("button", { name: "Save recommendation" }).click()
    await expect(page.getByText("Recommendation saved")).toBeVisible()

    const proposed = await database.query("SELECT id, status FROM public.opportunity_matches WHERE opportunity_id=$1 AND repreneur_id=$2", [opportunityId, manifest.ids.portalRepreneur])
    expect(proposed.rows).toHaveLength(1)
    expect(proposed.rows[0].status).toBe("proposed")
    const matchId = proposed.rows[0].id
    await recordRuntimeFixtures({ p3OpportunityId: opportunityId, p3MatchId: matchId })

    const portal = await portalContext(browser)
    const portalOne = await portal.newPage()
    const portalTwo = await portal.newPage()
    captureClientErrors(portalOne, clientErrors)
    captureClientErrors(portalTwo, clientErrors)
    await portalOne.goto("/portal/deals")
    await expect(sectionFor(portalOne, "Recommended").getByText(`${manifest.fixturePrefix} opportunity`, { exact: true })).toBeVisible()
    await expect(sectionFor(portalOne, "In Progress").getByText(`${manifest.fixturePrefix} opportunity`, { exact: true })).toHaveCount(0)
    await Promise.all([portalOne.goto(`/portal/deals/${matchId}`), portalTwo.goto(`/portal/deals/${matchId}`)])
    await Promise.allSettled([
      portalOne.getByRole("button", { name: "I'm interested" }).click(),
      portalTwo.getByRole("button", { name: "I'm interested" }).click(),
    ])
    await expect.poll(async () => {
      const interested = await database.query("SELECT id, status FROM public.opportunity_matches WHERE opportunity_id=$1 AND repreneur_id=$2", [opportunityId, manifest.ids.portalRepreneur])
      expect(interested.rows).toHaveLength(1)
      return interested.rows[0].status
    }).toBe("interested")
    await portalOne.goto("/portal/deals")
    await expect(sectionFor(portalOne, "Recommended").getByText(`${manifest.fixturePrefix} opportunity`, { exact: true })).toHaveCount(0)
    await expect(sectionFor(portalOne, "In Progress").getByText(`${manifest.fixturePrefix} opportunity`, { exact: true })).toBeVisible()
    await expect(sectionFor(portalOne, "In Progress").getByText("Interest sent, awaiting Re-New validation", { exact: true })).toBeVisible()
    await portalOne.goto(`/portal/deals/${matchId}`)
    await expect(portalOne.getByText("Documents", { exact: true })).toHaveCount(0)

    await page.goto("/opportunities/reviews")
    const row = page.getByRole("row").filter({ hasText: `${manifest.fixturePrefix} opportunity` })
    await row.getByRole("button", { name: "Validate pursuit" }).click()
    await page.reload()

    const final = await database.query(`SELECT om.status, om.pursuit_stage,
      (SELECT count(*)::int FROM public.opportunity_matches active WHERE active.opportunity_id=om.opportunity_id AND active.status='active_pursuit') AS active_count,
      (SELECT count(*)::int FROM public.opportunity_pursuit_evidence evidence WHERE evidence.match_id=om.id AND evidence.event_type='mutual_interest_validated') AS evidence_count
      FROM public.opportunity_matches om WHERE om.id=$1`, [matchId])
    expect(final.rows[0]).toMatchObject({ status: "active_pursuit", pursuit_stage: "interest", active_count: 1, evidence_count: 1 })
    const evidence = await database.query("SELECT id FROM public.opportunity_pursuit_evidence WHERE match_id=$1 AND event_type='mutual_interest_validated'", [matchId])
    await recordRuntimeFixtures({ p3OpportunityId: opportunityId, p3MatchId: matchId, p3EvidenceId: evidence.rows[0].id })

    await portalOne.goto(`/portal/deals/${matchId}`)
    await portalOne.reload()
    await expect(portalOne.getByText("Active pursuit", { exact: true }).first()).toBeVisible()
    await portalOne.screenshot({ path: `${RUN_DIR}/test-results/p3-portal-active-pursuit.png` })
    await page.goto(`/opportunities/${opportunityId}?tab=recommendations`)
    await page.reload()
    await expect(page.getByText("Active pursuit", { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: `${RUN_DIR}/test-results/p3-staff-active-pursuit.png` })

    // W-126: the staff-only control quarantines the ordinary fixture from both
    // repreneur routes while retaining the staff record, and re-exposure waits
    // for the explicit mobile confirmation.
    await page.goto(`/opportunities/${opportunityId}`)
    await page.getByRole("button", { name: "Mark DEMO" }).click()
    await expect(page.getByRole("heading", { name: "Mark this opportunity DEMO?" })).toBeVisible()
    await page.getByRole("button", { name: "Mark DEMO" }).last().click()
    await expect(page.getByText("Opportunity marked DEMO and quarantined from repreneur access.", { exact: true })).toBeVisible()
    await expect(page.getByText("DEMO", { exact: true }).first()).toBeVisible()
    await expect.poll(async () => (await database.query("SELECT is_demo FROM public.opportunities WHERE id=$1", [opportunityId])).rows[0]?.is_demo).toBe(true)
    await portalOne.goto("/portal/deals")
    await expect(portalOne.getByText(`${manifest.fixturePrefix} opportunity`, { exact: true })).toHaveCount(0)
    const quarantinedDetail = await portalOne.goto(`/portal/deals/${matchId}`)
    expect(quarantinedDetail?.status()).toBe(404)

    const w126Mobile = await mobileStaffContext(browser)
    const w126Page = await w126Mobile.newPage()
    const w126Errors: string[] = []
    captureClientErrors(w126Page, w126Errors)
    await w126Page.goto(`/opportunities/${opportunityId}`)
    await expect(w126Page.getByText("DEMO", { exact: true }).first()).toBeVisible()
    await w126Page.getByRole("button", { name: "Remove DEMO" }).click()
    await expect(w126Page.getByRole("heading", { name: "Remove DEMO classification?" })).toBeVisible()
    await w126Page.getByRole("button", { name: "Cancel" }).click()
    await expect.poll(async () => (await database.query("SELECT is_demo FROM public.opportunities WHERE id=$1", [opportunityId])).rows[0]?.is_demo).toBe(true)
    await w126Page.getByRole("button", { name: "Remove DEMO" }).click()
    await w126Page.getByRole("button", { name: "Remove DEMO" }).last().click()
    await expect(w126Page.getByText("DEMO classification removed. The opportunity can be eligible for repreneur access again.", { exact: true })).toBeVisible()
    await expect.poll(async () => (await database.query("SELECT is_demo FROM public.opportunities WHERE id=$1", [opportunityId])).rows[0]?.is_demo).toBe(false)
    expect(w126Errors).toEqual([])
    await w126Mobile.close()
    await portalOne.goto("/portal/deals")
    await expect(sectionFor(portalOne, "In Progress").getByText(`${manifest.fixturePrefix} opportunity`, { exact: true })).toBeVisible()
    const restoredDetail = await portalOne.goto(`/portal/deals/${matchId}`)
    expect(restoredDetail?.ok()).toBe(true)
    await expect(portalOne.getByText("Active pursuit", { exact: true }).first()).toBeVisible()

    // W-130: each correction stays within the seeded fixture boundary and the
    // database verifies both persistence and the authenticated audit actor.
    const correctionBefore = await database.query(`SELECT
      (SELECT row_to_json(firm) FROM public.ma_firms firm WHERE id=$1) AS firm,
      (SELECT row_to_json(office) FROM public.ma_offices office WHERE id=$2) AS office,
      (SELECT row_to_json(contact) FROM public.ma_contacts contact WHERE id=$3) AS contact,
      (SELECT row_to_json(affiliation) FROM public.ma_contact_office_affiliations affiliation WHERE id=$4) AS affiliation`, [manifest.ids.firm, manifest.ids.office, manifest.ids.contact, manifest.ids.affiliation])
    await recordRuntimeFixtures({ w130FixtureIds: { firmId: manifest.ids.firm, officeId: manifest.ids.office, contactId: manifest.ids.contact, affiliationId: manifest.ids.affiliation } })

    await page.goto(`/opportunities/ma/firms/${manifest.ids.firm}`)
    await page.getByRole("button", { name: "Edit details" }).click()
    await page.getByLabel("Category").fill("QA corrected category")
    await page.getByRole("button", { name: "Save correction" }).click()
    await expect(page.getByText("Firm details saved with staff audit.")).toBeVisible()
    await page.reload()
    await expect(page.getByText("QA corrected category", { exact: true })).toBeVisible()

    await page.goto(`/opportunities/ma/offices/${manifest.ids.office}`)
    await page.getByRole("button", { name: "Edit details" }).click()
    await page.getByLabel("City").fill("Lyon")
    await page.getByRole("button", { name: "Save correction" }).click()
    await expect(page.getByText("Office details saved with staff audit.")).toBeVisible()
    await page.reload()
    await expect(page.getByText("Lyon", { exact: true })).toBeVisible()

    await page.goto(`/opportunities/ma/contacts?contactId=${manifest.ids.contact}`)
    await page.getByRole("button", { name: "Edit details" }).click()
    await expect(page.getByLabel("Job title at selected office")).toHaveValue("QA contact")
    await page.getByLabel("First name").fill("Corrected")
    await page.getByLabel("Job title at selected office").fill("QA corrected office title")
    await page.getByRole("button", { name: "Save correction" }).click()
    await expect(page.getByText("Contact details saved with staff audit.")).toBeVisible()
    await page.goto(`/opportunities/ma/offices/${manifest.ids.office}`)
    await expect(page.getByText("QA corrected office title", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Edit details" }).click()
    await page.getByLabel("Email").fill("")
    await page.getByRole("button", { name: "Save correction" }).click()
    await expect(page.getByText("This person is the usable primary contact for an Active or Paused opportunity. Keep a valid email or correct that opportunity first.", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
    const correctionAfter = await database.query(`SELECT
      (SELECT row_to_json(firm) FROM public.ma_firms firm WHERE id=$1) AS firm,
      (SELECT row_to_json(office) FROM public.ma_offices office WHERE id=$2) AS office,
      (SELECT row_to_json(contact) FROM public.ma_contacts contact WHERE id=$3) AS contact,
      (SELECT row_to_json(affiliation) FROM public.ma_contact_office_affiliations affiliation WHERE id=$4) AS affiliation`, [manifest.ids.firm, manifest.ids.office, manifest.ids.contact, manifest.ids.affiliation])
    const before = correctionBefore.rows[0]
    const after = correctionAfter.rows[0]
    expect(after.firm).toMatchObject({ category: "QA corrected category", updated_by: manifest.actors.staff.userId })
    expect(after.office).toMatchObject({ city: "Lyon", updated_by: manifest.actors.staff.userId })
    expect(after.contact).toMatchObject({ first_name: "Corrected", email: before.contact.email, updated_by: manifest.actors.staff.userId })
    expect(after.affiliation).toMatchObject({ job_title: "QA corrected office title", updated_by: manifest.actors.staff.userId })
    for (const field of ["status", "created_by", "source", "campaign_email_suppressed", "disclosure_state"]) {
      expect(after.firm[field]).toEqual(before.firm[field])
      expect(after.office[field]).toEqual(before.office[field])
      expect(after.contact[field]).toEqual(before.contact[field])
      expect(after.affiliation[field]).toEqual(before.affiliation[field])
    }
    const staffMobile = await protectValidationOrigin(await browser.newContext({
      ...protectedContext,
      viewport: { width: 390, height: 844 },
      storageState: `${RUN_DIR}/auth/staff.json`,
    }))
    const mobileCorrections = await staffMobile.newPage()
    const mobileCorrectionErrors: string[] = []
    captureClientErrors(mobileCorrections, mobileCorrectionErrors)
    await mobileCorrections.goto(`/opportunities/ma/offices/${manifest.ids.office}`)
    await expect(mobileCorrections.getByText("QA corrected office title", { exact: true })).toBeVisible()
    await mobileCorrections.getByRole("button", { name: "Edit details" }).click()
    await expect(mobileCorrections.getByLabel("City")).toHaveValue("Lyon")
    await mobileCorrections.getByRole("button", { name: "Cancel" }).click()
    expect(mobileCorrectionErrors).toEqual([])
    await staffMobile.close()

    // The extra fixture is created through the same server contract and its ID
    // is persisted before every following lifecycle mutation. This makes the
    // failure cleanup path exact rather than title- or reference-derived.
    const declinedOpportunityId = await createManifestOwnedDeal(database, "deals-declined")
    await recordRuntimeFixtures({ p3DealIds: { ...(await readJson(RUNTIME_FIXTURES_FILE).catch(() => ({}))).p3DealIds, declinedOpportunityId } })
    await portalOne.goto("/portal/deals")
    const live = sectionFor(portalOne, "Live Opportunities")
    await expect(live.getByText(`${manifest.fixturePrefix} deals-declined`, { exact: true })).toBeVisible()
    await expect(live.getByText("Revenue", { exact: true })).toBeVisible()
    await expect(live.getByText(`${manifest.referenceCode}`, { exact: false })).toBeVisible()

    const locked = await database.query(`INSERT INTO public.opportunity_matches (opportunity_id, repreneur_id, status, pursuit_stage, created_by)
      VALUES ($1, $2, 'active_pursuit', 'interest', $3) RETURNING id`, [declinedOpportunityId, manifest.ids.lockedRepreneur, manifest.actors.staff.userId])
    const lockedMatchId = locked.rows[0]?.id
    if (typeof lockedMatchId !== "string") throw new Error("Golden P3 failed: locked-match-id")
    await recordRuntimeFixtures({ p3DealIds: { ...(await readJson(RUNTIME_FIXTURES_FILE)).p3DealIds, lockedMatchId } })
    await portalOne.reload()
    await expect(live.getByText("Someone is already positioned", { exact: true })).toBeVisible()
    await expect(live.getByText("Express interest", { exact: true })).toBeVisible()
    // The lock was a visibility-only live-discovery check. Retire it before
    // exercising the current repreneur's retained declined/dropped history.
    await database.query("UPDATE public.opportunity_matches SET status='dropped', pursuit_stage=NULL WHERE id=$1", [lockedMatchId])

    const declined = await database.query(`INSERT INTO public.opportunity_matches (opportunity_id, repreneur_id, status, decline_reason_categories, decline_reason_text, created_by)
      VALUES ($1, $2, 'declined', ARRAY['other']::text[], $3, $4) RETURNING id`, [declinedOpportunityId, manifest.ids.portalRepreneur, `${manifest.fixturePrefix} decline`, manifest.actors.staff.userId])
    const declinedMatchId = declined.rows[0]?.id
    if (typeof declinedMatchId !== "string") throw new Error("Golden P3 failed: declined-match-id")
    await recordRuntimeFixtures({ p3DealIds: { ...(await readJson(RUNTIME_FIXTURES_FILE)).p3DealIds, declinedMatchId } })
    await portalOne.goto("/portal/deals")
    const declinedSection = sectionFor(portalOne, "Declined")
    await expect(declinedSection.getByText(`${manifest.fixturePrefix} deals-declined`, { exact: true })).toBeVisible()
    await expect(declinedSection.getByText("Revenue", { exact: true })).toHaveCount(0)
    await expect(declinedSection.getByRole("link", { name: "Review and reconsider" })).toBeVisible()

    const portalMobile = await protectValidationOrigin(await browser.newContext({
      ...protectedContext,
      viewport: { width: 390, height: 844 },
      storageState: `${RUN_DIR}/auth/portal.json`,
    }))
    const mobileErrors: string[] = []
    const mobile = await portalMobile.newPage()
    captureClientErrors(mobile, mobileErrors)
    await mobile.goto("/portal/deals")
    await expect(sectionFor(mobile, "Declined").getByText(`${manifest.fixturePrefix} deals-declined`, { exact: true })).toBeVisible()
    await expect(sectionFor(mobile, "Declined").getByText("Revenue", { exact: true })).toHaveCount(0)
    await expect(sectionFor(mobile, "Live Opportunities").getByText("Revenue", { exact: true })).toBeVisible()
    expect(mobileErrors).toEqual([])
    await portalMobile.close()

    await portalOne.goto(`/portal/deals/${declinedMatchId}`)
    await expect(portalOne.getByText("Not a fit", { exact: true })).toBeVisible()
    await expect(portalOne.getByText("Documents", { exact: true })).toHaveCount(0)
    await portalOne.getByRole("button", { name: "Review and reconsider" }).click()
    await portalOne.waitForURL(/\/portal\/deals$/)
    await expect.poll(async () => (await database.query(`SELECT status, pursuit_stage, pursuit_stage_notes, pursuit_stage_updated_by, pursuit_stage_updated_at,
      reviewed_by, reviewed_at, decline_reason_categories, decline_reason_text
      FROM public.opportunity_matches WHERE id=$1`, [declinedMatchId])).rows[0]).toMatchObject({
      status: "interested", pursuit_stage: null, pursuit_stage_notes: null, pursuit_stage_updated_by: null,
      pursuit_stage_updated_at: null, reviewed_by: null, reviewed_at: null, decline_reason_categories: [], decline_reason_text: null,
    })
    await expect(sectionFor(portalOne, "In Progress").getByText(`${manifest.fixturePrefix} deals-declined`, { exact: true })).toBeVisible()

    const droppedOpportunityId = await createManifestOwnedDeal(database, "deals-dropped")
    await recordRuntimeFixtures({ p3DealIds: { ...(await readJson(RUNTIME_FIXTURES_FILE)).p3DealIds, droppedOpportunityId } })
    const dropped = await database.query(`INSERT INTO public.opportunity_matches (
        opportunity_id, repreneur_id, status, decline_reason_categories, decline_reason_text,
        pursuit_stage, pursuit_stage_notes, pursuit_stage_updated_by, pursuit_stage_updated_at,
        reviewed_by, reviewed_at, created_by
      ) VALUES ($1, $2, 'dropped', ARRAY['other']::text[], $3, 'nda_sent', $4, $5, NOW(), $5, NOW(), $5)
      RETURNING id`, [
      droppedOpportunityId, manifest.ids.portalRepreneur, `${manifest.fixturePrefix} dropped decline`,
      `${manifest.fixturePrefix} retained pursuit state`, manifest.actors.staff.userId,
    ])
    const droppedMatchId = dropped.rows[0]?.id
    if (typeof droppedMatchId !== "string") throw new Error("Golden P3 failed: dropped-match-id")
    await recordRuntimeFixtures({ p3DealIds: { ...(await readJson(RUNTIME_FIXTURES_FILE)).p3DealIds, droppedMatchId } })
    await page.goto(`/portal-preview?repreneurId=${manifest.ids.portalRepreneur}`)
    await expect(page.getByText("3 visible deal(s)", { exact: true })).toBeVisible()
    await expect(sectionFor(page, "Declined").getByText(`${manifest.fixturePrefix} deals-dropped`, { exact: true })).toBeVisible()
    await page.goto(`/portal-preview?repreneurId=${manifest.ids.portalRepreneur}&matchId=${droppedMatchId}`)
    await expect(page.getByText("Pursuit dropped", { exact: true })).toBeVisible()
    await expect(page.getByText("Documents", { exact: true })).toHaveCount(0)
    await portalOne.goto(`/portal/deals/${droppedMatchId}`)
    await expect(portalOne.getByText("Pursuit dropped", { exact: true })).toBeVisible()
    await expect(portalOne.getByText("Documents", { exact: true })).toHaveCount(0)
    await portalOne.getByRole("button", { name: "Review and reconsider" }).click()
    await portalOne.waitForURL(/\/portal\/deals$/)
    await expect.poll(async () => (await database.query(`SELECT status, pursuit_stage, pursuit_stage_notes, pursuit_stage_updated_by, pursuit_stage_updated_at,
      reviewed_by, reviewed_at, decline_reason_categories, decline_reason_text,
      (SELECT count(*)::int FROM public.opportunity_pursuit_evidence WHERE match_id=om.id) AS evidence_count,
      (SELECT count(*)::int FROM public.opportunity_documents WHERE opportunity_id=om.opportunity_id) AS document_count
      FROM public.opportunity_matches om WHERE id=$1`, [droppedMatchId])).rows[0]).toMatchObject({
      status: "interested", pursuit_stage: null, pursuit_stage_notes: null, pursuit_stage_updated_by: null,
      pursuit_stage_updated_at: null, reviewed_by: null, reviewed_at: null, decline_reason_categories: [], decline_reason_text: null,
      evidence_count: 0, document_count: 0,
    })
    await expect(sectionFor(portalOne, "In Progress").getByText(`${manifest.fixturePrefix} deals-dropped`, { exact: true })).toBeVisible()

    await database.query("UPDATE public.opportunities SET is_demo=true WHERE id=$1", [droppedOpportunityId])
    await portalOne.goto("/portal/deals")
    await expect(portalOne.getByText(`${manifest.fixturePrefix} deals-dropped`, { exact: true })).toHaveCount(0)
    const demoDetailResponse = await portalOne.goto(`/portal/deals/${droppedMatchId}`)
    expect(demoDetailResponse?.status()).toBe(404)
    await expect(portalOne.getByText(`${manifest.fixturePrefix} deals-dropped`, { exact: true })).toHaveCount(0)
    await page.goto(`/portal-preview?repreneurId=${manifest.ids.portalRepreneur}`)
    await expect(page.getByText("2 visible deal(s)", { exact: true })).toBeVisible()
    await expect(page.getByText(`${manifest.fixturePrefix} opportunity`, { exact: true })).toBeVisible()
    await expect(page.getByText(`${manifest.fixturePrefix} deals-dropped`, { exact: true })).toHaveCount(0)
    await page.goto(`/portal-preview?repreneurId=${manifest.ids.portalRepreneur}&matchId=${droppedMatchId}`)
    await expect(page.getByText("Deal not visible in portal preview", { exact: true })).toBeVisible()
    expect(clientErrors).toEqual([])

    await database.end()
    await portal.close()
    await staff.close()
  })
})
