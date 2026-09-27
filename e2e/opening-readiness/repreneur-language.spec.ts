import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Browser, type Page } from "@playwright/test"
import { Client } from "pg"
import { verifyPassword } from "better-auth/crypto"
import { OPENING_READINESS_FIXTURE, assertOpeningReadinessFixtureEnvironment } from "../../lib/opening-readiness-fixture"
import { PASSWORD_RESET_TOKEN_STORAGE_KEY } from "../../lib/password-reset-token"

const fixture = OPENING_READINESS_FIXTURE
const password = process.env.OPENING_FIXTURE_PASSWORD
const runnerTemp = process.env.RUNNER_TEMP
if (!password || !runnerTemp || process.env.CI !== "true"
  || process.env.GITHUB_ACTIONS !== "true"
  || process.env.QA_FIXTURE_MODE !== "local"
  || process.env.QA_CONTRACT_MODE !== "protected"
  || process.env.QA_MAIL_MODE !== "allowlist"
  || process.env.RESEND_API_KEY) {
  throw new Error("Language proof requires the protected disposable GitHub Actions fixture.")
}
const { databaseUrl } = assertOpeningReadinessFixtureEnvironment(process.env)

async function login(page: Page, email: string, loginPassword = password) {
  await page.goto("/auth/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(loginPassword)
  await page.getByRole("button", { name: /^(Se connecter|Sign In)$/ }).click()
}

async function currentFixturePassword(client: Client, userId: string) {
  const { rows } = await client.query<{ password: string }>(
    'SELECT password FROM public."account" WHERE "userId"=$1 AND "providerId"=\'credential\'',
    [userId],
  )
  expect(rows).toHaveLength(1)
  for (const candidate of [password, `${password}-reset`, `${password}-access-uat`]) {
    if (await verifyPassword({ hash: rows[0]!.password, password: candidate })) return candidate
  }
  throw new Error("Synthetic fixture credential no longer matches an expected password.")
}

async function accountLanguage(client: Client, userId: string) {
  const { rows } = await client.query<{ language: string }>(
    "SELECT language FROM public.repreneur_ui_preferences WHERE user_id=$1",
    [userId],
  )
  return rows[0]?.language ?? null
}

async function ownerState(client: Client, repreneurId: string, opportunityId: string) {
  const [matches, interestEvents, external, review] = await Promise.all([
    client.query<{ id: string; status: string; updated_at: string }>(
      "SELECT id,status,updated_at::text FROM public.opportunity_matches WHERE repreneur_id=$1 ORDER BY id", [repreneurId]),
    client.query<{ id: string }>(
      "SELECT e.id FROM public.opportunity_interest_events e JOIN public.opportunity_matches m ON m.id=e.match_id WHERE m.repreneur_id=$1 ORDER BY e.id", [repreneurId]),
    client.query<{ id: string; title: string; stage: string }>(
      "SELECT id,title,stage FROM public.external_pursuits WHERE owner_repreneur_id=$1 ORDER BY id", [repreneurId]),
    client.query<{ first_viewed_at: string; reviewed: boolean }>(
      "SELECT first_viewed_at::text,reviewed FROM public.repreneur_opportunity_review_state WHERE repreneur_id=$1 AND opportunity_id=$2", [repreneurId, opportunityId]),
  ])
  return { matches: matches.rows, interestEvents: interestEvents.rows, external: external.rows, review: review.rows }
}

test("French-first locale is account-scoped, live, and separate from staff preview", async ({ browser }) => {
  test.setTimeout(240_000)
  const client = new Client({ connectionString: databaseUrl.toString() })
  const contexts: Awaited<ReturnType<Browser["newContext"]>>[] = []
  let releasePreflight = () => {}
  await client.connect()
  try {
    // Only the disposable synthetic identities are touched; no account row is inferred.
    await client.query("DELETE FROM public.repreneur_ui_preferences WHERE user_id = ANY($1::text[])", [[
      fixture.repreneurs.real.userId, fixture.repreneurs.realNonOwner.userId,
    ]])
    const realPassword = await currentFixturePassword(client, fixture.repreneurs.real.userId)
    const otherPassword = await currentFixturePassword(client, fixture.repreneurs.realNonOwner.userId)

    const first = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.220" },
    })
    contexts.push(first)
    const firstPage = await first.newPage()
    await firstPage.goto("/auth/login")
    await expect(firstPage.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible()
    await firstPage.locator("#email").fill(fixture.repreneurs.real.email)
    await firstPage.locator("#password").fill(realPassword)
    await firstPage.getByRole("button", { name: "English", exact: true }).click()
    await expect(firstPage.locator("#email")).toHaveValue(fixture.repreneurs.real.email)
    await expect(firstPage.locator("#password")).toHaveValue(realPassword)
    await firstPage.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(firstPage).toHaveURL(/\/portal\/deals/)
    await expect(firstPage.getByRole("heading", { name: "Your deals", exact: true })).toBeVisible()
    expect(await accountLanguage(client, fixture.repreneurs.real.userId)).toBeNull()

    // Explicit authenticated selection alone creates the self-owned row.
    await firstPage.getByRole("button", { name: "Français", exact: true }).click()
    await expect(firstPage.getByRole("heading", { name: "Vos opportunités", exact: true })).toBeVisible()
    await expect.poll(() => accountLanguage(client, fixture.repreneurs.real.userId)).toBe("fr")
    await expect(firstPage.locator("html")).toHaveAttribute("lang", "fr")

    // Filters and canonical content stay in place through live language changes.
    const originalTitle = "QA OPENING REAL — SYNTHETIC"
    const originalTeaser = "Synthetic opening fixture"
    const { rows: originalContent } = await client.query<{
      public_title: string; teaser_summary: string; description: string; sector: string; location: string
    }>("SELECT public_title,teaser_summary,description,sector,location FROM public.opportunities WHERE id=$1", [fixture.ids.realOpportunity])
    expect(originalContent).toEqual([{
      public_title: originalTitle, teaser_summary: originalTeaser,
      description: "QA OPENING REAL SYNTHETIC — NEVER COMMERCIAL", sector: "Tech & Digital", location: "France",
    }])
    const beforeListSwitch = await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)
    const search = firstPage.getByRole("textbox", { name: "Rechercher parmi les opportunités" })
    await search.fill("QA OPENING REAL")
    await firstPage.getByRole("button", { name: "Zone géographique", exact: true }).click()
    const geography = firstPage.locator('[data-slot="popover-content"]')
    await expect(geography).toHaveAttribute("lang", "fr")
    await firstPage.keyboard.press("Escape")
    await firstPage.getByRole("button", { name: "Secteurs", exact: true }).click()
    const sectors = firstPage.locator('[data-slot="popover-content"]')
    await sectors.getByRole("checkbox", { name: "Tech & Digital" }).check()
    await firstPage.keyboard.press("Escape")
    await expect(firstPage.getByRole("button", { name: "Secteurs (1)" })).toBeVisible()
    const originalCard = firstPage.locator('[data-slot="card"]')
      .filter({ has: firstPage.getByText(originalTeaser, { exact: true }) })
    await expect(originalCard).toHaveCount(1)
    await expect(originalCard.getByText(originalTitle, { exact: true })).toBeVisible()
    await expect(originalCard.getByText(originalTeaser, { exact: true })).toBeVisible()
    const { rows: fixtureMatches } = await client.query<{ id: string }>(
      "SELECT id FROM public.opportunity_matches WHERE repreneur_id=$1 AND opportunity_id=$2",
      [fixture.repreneurs.real.id, fixture.ids.realOpportunity],
    )
    expect(fixtureMatches.length).toBeLessThanOrEqual(1)
    const detailHref = await originalCard.getByRole("link", { name: "Voir le détail" }).getAttribute("href")
    expect(detailHref).toBe(`/portal/deals/${fixtureMatches[0]?.id ?? fixture.ids.realOpportunity}`)
    await firstPage.getByRole("button", { name: "English", exact: true }).click()
    await expect(firstPage.getByRole("textbox", { name: "Search deal flow" })).toHaveValue("QA OPENING REAL")
    await expect(firstPage.getByRole("button", { name: "Sectors (1)" })).toBeVisible()
    await expect(originalCard.getByText(originalTitle, { exact: true })).toBeVisible()
    await expect(originalCard.getByText(originalTeaser, { exact: true })).toBeVisible()
    expect(await originalCard.getByRole("link", { name: "View detail" }).getAttribute("href")).toBe(detailHref)
    await firstPage.getByRole("button", { name: "Français", exact: true }).click()
    await expect(firstPage.getByRole("textbox", { name: "Rechercher parmi les opportunités" })).toHaveValue("QA OPENING REAL")
    expect(await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)).toEqual(beforeListSwitch)

    await originalCard.getByRole("link", { name: "Voir le détail" }).click()
    await expect(firstPage.getByRole("heading", { name: originalTitle })).toBeVisible()
    await expect(firstPage.getByText(originalTeaser, { exact: true })).toBeVisible()
    await expect(firstPage.getByText("QA OPENING REAL SYNTHETIC — NEVER COMMERCIAL")).toHaveCount(0)
    await expect(firstPage.getByText("Indiquez à Re-New si vous souhaitez explorer cette opportunité.")).toBeVisible()
    await expect.poll(async () => (await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)).review.length).toBe(1)
    const beforeDetailSwitch = await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)
    await firstPage.getByRole("button", { name: "English", exact: true }).click()
    await expect(firstPage.getByText("Tell Re-New whether this opportunity should be explored further.")).toBeVisible()
    await expect(firstPage.getByRole("heading", { name: originalTitle })).toBeVisible()
    await expect(firstPage.getByText(originalTeaser, { exact: true })).toBeVisible()
    await firstPage.getByRole("button", { name: "Français", exact: true }).click()
    expect(await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)).toEqual(beforeDetailSwitch)
    expect((await client.query("SELECT public_title,teaser_summary,description,sector,location FROM public.opportunities WHERE id=$1", [fixture.ids.realOpportunity])).rows).toEqual(originalContent)

    await firstPage.goto("/portal/pursuits")
    await expect(firstPage.getByRole("heading", { name: "Vos dossiers de reprise" })).toBeVisible()
    await firstPage.getByRole("textbox", { name: "Rechercher des dossiers" }).fill("QA DRAFT — NEVER SUBMIT")
    const beforePursuitSwitch = await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)
    await firstPage.getByRole("button", { name: "Nouveau dossier externe" }).click()
    const editor = firstPage.locator('[data-slot="dialog-content"]')
    await expect(editor).toHaveAttribute("lang", "fr")
    await expect(editor.getByRole("heading", { name: "Nouveau dossier externe" })).toBeVisible()
    await editor.locator("#external-pursuit-title").fill("QA DRAFT — NEVER SUBMIT")
    await editor.locator("#external-pursuit-availability").click()
    await expect(firstPage.locator('[data-slot="select-content"]')).toHaveAttribute("lang", "fr")
    await expect(firstPage.getByRole("option", { name: "Disponibilité inconnue" })).toBeVisible()
    await firstPage.keyboard.press("Escape")
    // The modal masks the header from pointer/keyboard interaction. Invoke its
    // real button handler to prove a locale update cannot remount the open draft.
    await firstPage.locator('header button[aria-label="English"]').evaluate((button: HTMLButtonElement) => button.click())
    await expect(editor).toHaveAttribute("lang", "en")
    await expect(editor.locator("#external-pursuit-title")).toHaveValue("QA DRAFT — NEVER SUBMIT")
    await expect(firstPage.locator('input[aria-label="Search pursuits"]')).toHaveValue("QA DRAFT — NEVER SUBMIT")
    await editor.locator("#external-pursuit-availability").click()
    await expect(firstPage.locator('[data-slot="select-content"]')).toHaveAttribute("lang", "en")
    await expect(firstPage.getByRole("option", { name: "Availability unknown" })).toBeVisible()
    await firstPage.keyboard.press("Escape")
    await firstPage.keyboard.press("Escape")
    await expect(editor).toHaveCount(0)
    expect(await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)).toEqual(beforePursuitSwitch)
    await firstPage.getByRole("button", { name: "Français", exact: true }).click()
    await expect(firstPage.getByRole("textbox", { name: "Rechercher des dossiers" })).toHaveValue("QA DRAFT — NEVER SUBMIT")

    const second = await browser.newContext({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.221" },
    })
    contexts.push(second)
    const secondPage = await second.newPage()
    await secondPage.goto("/auth/login")
    await secondPage.getByRole("button", { name: "English", exact: true }).click()
    await secondPage.locator("#email").fill(fixture.repreneurs.real.email)
    await secondPage.locator("#password").fill(realPassword)
    await secondPage.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(secondPage).toHaveURL(/\/portal\/deals/)
    await expect(secondPage.getByRole("heading", { name: "Vos opportunités", exact: true })).toBeVisible()
    await expect(secondPage.locator("html")).toHaveAttribute("lang", "fr")
    await secondPage.getByRole("button", { name: "English", exact: true }).click()
    await expect(secondPage.getByRole("heading", { name: "Your deals", exact: true })).toBeVisible()
    await expect.poll(() => accountLanguage(client, fixture.repreneurs.real.userId)).toBe("en")
    await secondPage.goto("/portal/pursuits")
    await expect(secondPage.getByRole("heading", { name: "Your pursuits" })).toBeVisible()
    expect(await secondPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await firstPage.reload()
    await expect(firstPage.getByRole("heading", { name: "Your pursuits", exact: true })).toBeVisible()

    // This browser still carries its prior choice, but a second account has no row.
    await firstPage.goto("/auth/logout")
    await expect(firstPage).toHaveURL(/\/auth\/login/)
    await login(firstPage, fixture.repreneurs.realNonOwner.email, otherPassword)
    await expect(firstPage).toHaveURL(/\/portal\/deals/)
    await expect(firstPage.getByRole("heading", { name: "Vos opportunités", exact: true })).toBeVisible()
    expect(await accountLanguage(client, fixture.repreneurs.realNonOwner.userId)).toBeNull()

    const staff = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.222" },
    })
    contexts.push(staff)
    const staffPage = await staff.newPage()
    await login(staffPage, fixture.staff.email)
    await expect(staffPage).toHaveURL(/\/dashboard_re/)
    const previewBefore = await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)
    await staffPage.goto(`/portal-preview?repreneurId=${fixture.repreneurs.real.id}`)
    await expect(staffPage.getByRole("heading", { name: "Portal preview", exact: true })).toBeVisible()
    await staffPage.getByRole("button", { name: "English", exact: true }).click()
    await staffPage.getByRole("button", { name: "Français", exact: true }).click()
    await expect(staffPage.getByText("Customer-content preview language")).toBeVisible()
    await expect(staffPage.getByText("Customer-content preview language").locator("..")).toHaveAttribute("lang", "en")
    await expect(staffPage.getByRole("group", { name: "Interface language" })).toContainText("FR")
    await expect(staffPage.getByText("Interface only. Original content, documents and emails may remain in their original language.")).toBeVisible()
    await expect(staffPage.locator("html")).toHaveAttribute("lang", "en")
    await expect(staffPage.getByRole("tab", { name: "Deals", exact: true })).toBeVisible()
    await expect(staffPage.getByText("Recommandées → En cours → Opportunités disponibles → Écartées", { exact: true })).toBeVisible()
    await expect(staffPage.getByText("QA OPENING REAL — SYNTHETIC", { exact: true }).first()).toBeVisible()
    expect(await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)).toEqual(previewBefore)
    await staffPage.getByRole("button", { name: "Comment vos opportunités sont classées" }).click()
    await expect(staffPage.locator('[data-slot="popover-content"]')).toHaveAttribute("lang", "fr")
    await staffPage.keyboard.press("Escape")
    expect(await ownerState(client, fixture.repreneurs.real.id, fixture.ids.realOpportunity)).toEqual(previewBefore)
    expect(await accountLanguage(client, fixture.repreneurs.real.userId)).toBe("en")
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await staffPage.setViewportSize(viewport)
      await expect(staffPage.getByRole("heading", { name: "Portal preview", exact: true })).toBeVisible()
      await expect(staffPage.getByRole("tab", { name: "Deals", exact: true })).toBeVisible()
    }

    const noScript = await browser.newContext({ javaScriptEnabled: false })
    contexts.push(noScript)
    const noScriptPage = await noScript.newPage()
    await noScriptPage.goto("/auth/login")
    await expect(noScriptPage.locator('[data-localized-skip-link]')).toHaveText("Aller au contenu principal")
    await expect(noScriptPage.locator('[data-localized-skip-link]')).toHaveAttribute("lang", "fr")
    await expect(noScriptPage.locator('[data-root-skip-link]')).toBeHidden()
    await expect(noScriptPage.getByRole("button", { name: "Se connecter" })).toBeVisible()

    // Public file, token, and form state survive a locale-only re-render.
    const publicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.223" },
    })
    contexts.push(publicContext)
    const publicPage = await publicContext.newPage()
    await publicPage.goto("/welcome")
    await expect(publicPage).toHaveTitle("Re-New | WAVE")
    await publicPage.getByRole("button", { name: "English", exact: true }).click()
    await expect(publicPage).toHaveTitle("Re-New | WAVE")
    await publicPage.getByRole("button", { name: "Français", exact: true }).click()
    await publicPage.goto("/intake-v2")
    await publicPage.locator("#first_name").fill("Synthetic First")
    await publicPage.locator("#last_name").fill("Synthetic Last")
    await publicPage.route("**/api/intake-upload-token", (route) => route.fulfill({ status: 503, body: "{}" }))
    await publicPage.locator("#cv-upload").setInputFiles({
      name: "synthetic-cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    })
    const selectedFileName = () => publicPage.locator("#cv-upload")
      .evaluate((input: HTMLInputElement) => input.files?.[0]?.name ?? null)
    await expect.poll(selectedFileName).toBe("synthetic-cv.pdf")
    await publicPage.getByRole("button", { name: "English", exact: true }).click()
    await expect(publicPage.locator("#first_name")).toHaveValue("Synthetic First")
    await expect(publicPage.locator("#last_name")).toHaveValue("Synthetic Last")
    await expect.poll(selectedFileName).toBe("synthetic-cv.pdf")

    const syntheticToken = "a".repeat(24)
    const preflightBlocked = new Promise<void>((resolve) => { releasePreflight = resolve })
    await publicPage.route("**/api/auth/reset-password/preflight", async (route) => {
      await preflightBlocked
      await route.fulfill({ status: 400, contentType: "application/json", body: "{}" })
    })
    await publicPage.goto(`/auth/reset-password#token=${syntheticToken}`)
    await expect.poll(() => publicPage.evaluate((key) => sessionStorage.getItem(key), PASSWORD_RESET_TOKEN_STORAGE_KEY)).toBe(syntheticToken)
    await publicPage.getByRole("button", { name: "Français", exact: true }).click()
    await expect.poll(() => publicPage.evaluate((key) => sessionStorage.getItem(key), PASSWORD_RESET_TOKEN_STORAGE_KEY)).toBe(syntheticToken)
    await expect(publicPage).toHaveURL(/\/auth\/reset-password$/)

    await mkdir(join(runnerTemp, "opening-readiness-evidence"), { recursive: true })
    await writeFile(join(runnerTemp, "opening-readiness-evidence", "repreneur-ui-language.json"),
      JSON.stringify({
        defaultFrench: true, accountPrecedenceAcrossContexts: true, accountIsolation: true,
        livePortalSwitch: true, filtersAndCanonicalContentRetained: true, detailAndPursuitDialogBothLanguages: true,
        noBusinessMutationOnSwitch: true, publicFormAndFileRetained: true, resetTokenRetained: true,
        previewNoCustomerWrite: true, staffChromeEnglish: true, portalDialogLanguageScoped: true,
        noScriptFrenchSkipLink: true, desktopAndMobile: true,
      }) + "\n")
  } finally {
    releasePreflight()
    for (const context of contexts) await context.close()
    await client.query("DELETE FROM public.repreneur_ui_preferences WHERE user_id = ANY($1::text[])", [[
      fixture.repreneurs.real.userId, fixture.repreneurs.realNonOwner.userId,
    ]])
    await client.end()
  }
})
