import { expect, test } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";

// Deliberately synthetic: these are never a credential for any account.
const email = "native-submit-check@re-new.invalid";
const password = "synthetic-native-submit-not-a-credential";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`login fails closed without JavaScript at ${viewport.width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport,
    });
    const page = await context.newPage();
    const leakedUrls: boolean[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      leakedUrls.push(
        url.searchParams.has("email") ||
          url.searchParams.has("password") ||
          request.url().includes(encodeURIComponent(email)) ||
          request.url().includes(password),
      );
    });
    try {
      await page.goto("/auth/login");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await expect(
        page.getByRole("button", { name: "Sign In", exact: true }),
      ).toBeDisabled();
      await expect(page.getByRole("status")).toHaveText(
        "Preparing secure sign-in. If this continues, enable JavaScript and reload.",
      );
      await expect(page.getByRole("status")).toBeVisible();
      await page.locator("#password").press("Enter");
      await expect(page).toHaveURL(/\/auth\/login$/);

      // Force the browser's native fallback, bypassing the disabled button and
      // all React handlers. Even that fallback must never serialize into a URL.
      const nativeRequest = page.waitForRequest(
        (request) =>
          request.isNavigationRequest() &&
          new URL(request.url()).pathname === "/auth/login",
      );
      await page
        .locator("form")
        .evaluate((form: HTMLFormElement) => form.submit());
      const request = await nativeRequest;
      expect(request.method()).toBe("POST");
      expect(new URL(request.url()).search).toBe("");
      expect(leakedUrls.some(Boolean)).toBe(false);
    } finally {
      await context.close();
    }
  });
}

test("login waits for delayed hydration before enabling submission", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await context.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/auth/login", { waitUntil: "commit" });
    const submit = page.getByRole("button", { name: "Sign In", exact: true });
    await expect(submit).toBeDisabled();
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#password").press("Enter");
    await expect(page).toHaveURL(/\/auth\/login$/);
    releaseScripts();
    await expect(submit).toBeEnabled();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
  } finally {
    releaseScripts();
    await context.close();
  }
});
