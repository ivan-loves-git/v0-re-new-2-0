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
    await fillStaffRepreneur(second, manifest.actors.staffCreated.email)
    await second.getByRole("button", { name: "Create Repreneur" }).click()
    await expect(second.getByText(/already belongs to another Repreneur/i)).toBeVisible()

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
    await choose(page, "Operating office", new RegExp(manifest.fixturePrefix))
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

    const database = await databaseClient()
    const proposed = await database.query("SELECT id, status FROM public.opportunity_matches WHERE opportunity_id=$1 AND repreneur_id=$2", [opportunityId, manifest.ids.portalRepreneur])
    expect(proposed.rows).toHaveLength(1)
    expect(proposed.rows[0].status).toBe("proposed")
    const matchId = proposed.rows[0].id
    await recordRuntimeFixtures({ p3OpportunityId: opportunityId, p3MatchId: matchId })

    const portal = await portalContext(browser)
    const portalOne = await portal.newPage()
    const portalTwo = await portal.newPage()
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
    await page.goto(`/opportunities/${opportunityId}?tab=recommendations`)
    await page.reload()
    await expect(page.getByText("Active pursuit", { exact: true }).first()).toBeVisible()

    await database.end()
    await portal.close()
    await staff.close()
  })
})
