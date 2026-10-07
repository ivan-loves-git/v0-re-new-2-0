import { expect, test } from "@playwright/test"
import { dismissNotifications } from "../helpers/dismiss-notifications"

test("an expiring toast does not trap dismissal in a detached-button retry", async ({ page }) => {
  test.setTimeout(6_000)
  await page.setContent(`
    <style>@keyframes moving { to { transform: translateX(100px); } }
    button { animation: moving 300ms infinite alternate; }</style>
    <button aria-label="Close toast">Close</button>
    <script>setTimeout(() => document.querySelector('button').remove(), 450)</script>
  `)
  const startedAt = Date.now()
  await dismissNotifications(page)
  expect(Date.now() - startedAt).toBeLessThan(3_000)
  await expect(page.getByRole("button", { name: "Close toast" })).toHaveCount(0)
})

test("a disabled notification control fails within its own deadline", async ({ page }) => {
  await page.setContent('<button aria-label="Close toast" disabled>Close</button>')
  const startedAt = Date.now()
  await expect(dismissNotifications(page, 600)).rejects.toThrow("within the deadline")
  expect(Date.now() - startedAt).toBeLessThan(3_000)
})

test("dismisses current visible controls and ignores hidden expired notifications", async ({ page }) => {
  await page.setContent(`
    <button aria-label="Close toast" onclick="this.remove()">First</button>
    <button aria-label="Close toast" onclick="this.remove()">Second</button>
    <button aria-label="Close toast" style="display:none" disabled>Expired</button>
  `)
  await dismissNotifications(page)
  await expect(page.getByRole("button", { name: "Close toast" })).toHaveCount(0)
})
