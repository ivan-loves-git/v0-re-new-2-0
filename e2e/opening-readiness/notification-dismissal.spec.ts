import { expect, test } from "@playwright/test";
import { dismissNotifications } from "./dismiss-notifications";

test("dismisses current notifications through their normal controls", async ({ page }) => {
  await page.setContent('<button aria-label="Close toast" onclick="this.remove()">Close</button><button aria-label="Close toast" onclick="this.remove()">Close</button>');
  await dismissNotifications(page);
  await expect(page.getByRole("button", { name: "Close toast", exact: true })).toHaveCount(0);
});

test("accepts a notification expiring while its close control cannot be clicked", async ({ page }) => {
  test.setTimeout(10_000);
  await page.setContent('<button aria-label="Close toast" disabled>Close</button>');
  await page.evaluate(() => {
    setTimeout(() => document.querySelector("button")?.remove(), 200);
  });
  await dismissNotifications(page);
  await expect(page.getByRole("button", { name: "Close toast", exact: true })).toHaveCount(0);
});

test("fails locally when a notification stays present and cannot be dismissed", async ({ page }) => {
  test.setTimeout(10_000);
  await page.setContent('<button aria-label="Close toast" disabled>Close</button>');
  const started = Date.now();
  await expect(dismissNotifications(page)).rejects.toThrow();
  expect(Date.now() - started).toBeLessThan(6_000);
  await expect(page.getByRole("button", { name: "Close toast", exact: true })).toHaveCount(1);
});
