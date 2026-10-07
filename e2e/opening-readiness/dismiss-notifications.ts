import { errors, type Page } from "@playwright/test"

export async function dismissNotifications(page: Page, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs
  const closeButtons = page.getByRole("button", { name: "Close toast", exact: true })
    .filter({ visible: true })
  while (await closeButtons.count()) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) throw new Error("Visible notification controls could not be dismissed within the deadline.")
    try {
      // A locator retries detachment until its own timeout, even when the toast
      // has expired. Bound each click and rediscover the current controls.
      await closeButtons.first().click({ timeout: Math.min(300, remainingMs) })
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) throw error
    }
  }
}
