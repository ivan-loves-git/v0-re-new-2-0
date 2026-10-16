import { expect, test as base, type BrowserContext } from "@playwright/test"
import { assertOpeningReadinessFixtureEnvironment, OPENING_READINESS_FIXTURE as fixture } from "../../lib/opening-readiness-fixture"

type StaffSession = Awaited<ReturnType<BrowserContext["storageState"]>>

// These two business journeys share one genuinely authenticated worker session.
// Its state stays in memory; explicit login/reset proof retains its own calls.
export const test = base.extend<Record<never, never>, { externalStaffSession: StaffSession }>({
  externalStaffSession: [async ({ browser }, provideSession) => {
    assertOpeningReadinessFixtureEnvironment(process.env)
    const password = process.env.OPENING_FIXTURE_PASSWORD
    if (!password || process.env.QA_MAIL_MODE !== "allowlist" || process.env.RESEND_API_KEY) {
      throw new Error("External staff session requires the protected synthetic mail fixture.")
    }
    const context = await browser.newContext()
    let primaryFailure: unknown
    let failed = false
    try {
      const page = await context.newPage()
      await page.goto("http://127.0.0.1:3000/auth/login")
      await page.getByRole("button", { name: "English", exact: true }).click()
      await page.locator("#email").fill(fixture.staff.email)
      await page.locator("#password").fill(password)
      await page.getByRole("button", { name: "Sign In", exact: true }).click()
      await expect(page).toHaveURL(/\/dashboard_re/)
      await provideSession(await context.storageState())
    } catch (error) {
      failed = true
      primaryFailure = error
      throw error
    } finally {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([context.close(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("External staff context cleanup exceeded 5 seconds.")), 5_000)
        })])
      } catch (cleanupFailure) {
        throw new AggregateError(failed ? [primaryFailure, cleanupFailure] : [cleanupFailure], "External staff session cleanup failed.")
      } finally {
        clearTimeout(timer)
      }
    }
  }, { scope: "worker" }],
})
