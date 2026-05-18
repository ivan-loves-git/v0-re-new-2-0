import { expect, test } from "@playwright/test"

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3012"
const staffEmail = process.env.SMOKE_STAFF_EMAIL
const staffPassword = process.env.SMOKE_STAFF_PASSWORD

async function loginIfNeeded(page: import("@playwright/test").Page) {
  if (!page.url().includes("/auth/login")) return
  test.skip(!staffEmail || !staffPassword, "Staff smoke credentials are required")
  await page.getByLabel("Email").fill(staffEmail!)
  await page.getByLabel("Password").fill(staffPassword!)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 20000 })
  await page.waitForLoadState("networkidle")
}

test("M&A source directory and email templates render", async ({ page }) => {
  await page.goto(`${baseUrl}/opportunities/ma`, { waitUntil: "networkidle" })
  await loginIfNeeded(page)
  if (!page.url().includes("/opportunities/ma")) {
    await page.goto(`${baseUrl}/opportunities/ma`, { waitUntil: "networkidle" })
  }

  await expect(page.getByRole("heading", { name: "M&A" })).toBeVisible()
  await expect(page.getByPlaceholder("Search sources...")).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Coverage" })).toBeVisible()
  await expect(page.getByRole("link", { name: /M&A/ })).toBeVisible()
  await page.screenshot({
    path: ".planning/phases/06-ma-source-directory-and-intermediary-email-workflows/screenshots/ma-directory.png",
    fullPage: true,
  })

  await page.getByRole("button", { name: /Add source/i }).click()
  await expect(page.getByText("Add M&A source")).toBeVisible()
  await expect(page.getByPlaceholder("Example: Cabinet Atlantique M&A")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.goto(`${baseUrl}/emails`, { waitUntil: "networkidle" })
  await page.getByRole("tab", { name: "Templates" }).click()
  await expect(page.getByText("M&A Validity Check")).toBeVisible()
  await expect(page.getByText("M&A Info Request")).toBeVisible()
  await page.screenshot({
    path: ".planning/phases/06-ma-source-directory-and-intermediary-email-workflows/screenshots/email-ma-templates.png",
    fullPage: true,
  })

  await page.getByRole("tab", { name: "Manual Send" }).click()
  await page.getByRole("combobox").filter({ hasText: "Select a template" }).click()
  await expect(page.getByRole("option", { name: /M&A Validity Check/ })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.getByLabel("Toggle test mode").click()
  await page.getByRole("combobox").filter({ hasText: "Select a template" }).click()
  await expect(page.getByRole("option", { name: /M&A Validity Check/ })).toBeVisible()
})
