import { chmod, mkdir, rm } from "node:fs/promises"
import { chromium, type FullConfig } from "@playwright/test"
import { CREDENTIALS_FILE, RUN_DIR, readJson } from "../../scripts/qa/phase-b-common.mjs"

export default async function globalSetup(config: FullConfig) {
  const githubRunner = process.env.QA_EXECUTION_MODE === "github-runner"
  const credentials = await readJson(CREDENTIALS_FILE)
  const baseURL = config.projects[0].use.baseURL as string
  const origin = new URL(baseURL).origin
  const browser = await chromium.launch()
  await mkdir(`${RUN_DIR}/auth`, { recursive: true })
  await chmod(`${RUN_DIR}/auth`, 0o700)

  for (const actor of ["staff", "portal"] as const) {
    const context = await browser.newContext({
      baseURL,
      ...(githubRunner ? { ignoreHTTPSErrors: true } : {}),
    })
    if (!githubRunner) {
      await context.route(`${origin}/**`, async (route) => {
        await route.continue({
          headers: {
            ...route.request().headers(),
            "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
            "x-vercel-set-bypass-cookie": "true",
          },
        })
      })
    }
    const page = await context.newPage()
    await page.goto("/auth/login")
    await page.getByLabel("Email").fill(actor === "staff" ? credentials.staffEmail : credentials.portalEmail)
    await page.getByLabel("Password").fill(credentials.password)
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL(actor === "staff" ? /\/dashboard_re(?:\?|$)/ : /\/portal\/deals(?:\?|$)/)
    await context.storageState({ path: `${RUN_DIR}/auth/${actor}.json` })
    await context.close()
  }

  await browser.close()
  await rm(CREDENTIALS_FILE, { force: true })
}
