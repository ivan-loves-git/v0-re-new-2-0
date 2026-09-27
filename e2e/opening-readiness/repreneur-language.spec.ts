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
    await firstPage.reload()
    await expect(firstPage.getByRole("heading", { name: "Your deals", exact: true })).toBeVisible()

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
    await staffPage.goto(`/portal-preview?repreneurId=${fixture.repreneurs.real.id}`)
    await expect(staffPage.getByRole("heading", { name: "Portal preview", exact: true })).toBeVisible()
    await staffPage.getByRole("button", { name: "English", exact: true }).click()
    await staffPage.getByRole("button", { name: "Français", exact: true }).click()
    await expect(staffPage.getByText("Customer-content preview language")).toBeVisible()
    await expect(staffPage.locator("html")).toHaveAttribute("lang", "en")
    await expect(staffPage.getByRole("tab", { name: "Deals", exact: true })).toBeVisible()
    await expect(staffPage.getByText("Recommandées → En cours → Opportunités disponibles → Écartées", { exact: true })).toBeVisible()
    await expect(staffPage.getByText("QA OPENING REAL — SYNTHETIC", { exact: true }).first()).toBeVisible()
    expect(await accountLanguage(client, fixture.repreneurs.real.userId)).toBe("en")
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await staffPage.setViewportSize(viewport)
      await expect(staffPage.getByRole("heading", { name: "Portal preview", exact: true })).toBeVisible()
      await expect(staffPage.getByRole("tab", { name: "Deals", exact: true })).toBeVisible()
    }

    // Public file, token, and form state survive a locale-only re-render.
    const publicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.223" },
    })
    contexts.push(publicContext)
    const publicPage = await publicContext.newPage()
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
        livePortalSwitch: true, publicFormAndFileRetained: true, resetTokenRetained: true,
        previewNoCustomerWrite: true, staffChromeEnglish: true, desktopAndMobile: true,
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
