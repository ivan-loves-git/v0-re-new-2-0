import { expect, type Page } from "@playwright/test";
import { assertOpeningReadinessFixtureEnvironment } from "../../lib/opening-readiness-fixture";

const clients = { staff: "203.0.113.211", repreneur: "203.0.113.212" } as const;

/** Isolate fictional clients while exercising the real authentication limits. */
export async function signInMaFixture(
  page: Page,
  email: string,
  password: string,
  persona: keyof typeof clients,
) {
  assertOpeningReadinessFixtureEnvironment(process.env);
  await page
    .context()
    .setExtraHTTPHeaders({ "x-forwarded-for": clients[persona] });
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard_re|portal\/deals)/, {
    timeout: 30000,
  });
}
