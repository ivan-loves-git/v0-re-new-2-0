import { expect, type Page } from "@playwright/test";

export async function dismissNotifications(page: Page) {
  const closeButtons = page.getByRole("button", { name: "Close toast", exact: true });
  // A toast can expire between observation and click. Retry that race locally;
  // a still-present unusable control must fail instead of consuming the journey.
  await expect(async () => {
    if (!(await closeButtons.count())) return;
    await closeButtons.first().click({ timeout: 500 });
    await expect(closeButtons).toHaveCount(0, { timeout: 500 });
  }).toPass({ timeout: 3_000, intervals: [0, 100, 250] });
}
