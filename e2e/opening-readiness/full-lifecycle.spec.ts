import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  devices,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { verifyPassword } from "better-auth/crypto";
import { Client } from "pg";
import {
  OPENING_READINESS_FIXTURE,
  openingReadinessRunLabel,
} from "../../lib/opening-readiness-fixture";

const fixture = OPENING_READINESS_FIXTURE;
const password = process.env.OPENING_FIXTURE_PASSWORD;
const databaseUrl = process.env.OPENING_FIXTURE_DATABASE_URL;
const releaseSha = process.env.OPENING_FIXTURE_RELEASE_SHA;
const runnerTemp = process.env.RUNNER_TEMP;
const baseURL = "http://127.0.0.1:3000";

if (
  !password ||
  !databaseUrl ||
  !releaseSha ||
  !runnerTemp ||
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_CONTRACT_MODE !== "protected" ||
  process.env.QA_MAIL_MODE !== "allowlist" ||
  process.env.RENEW_STAFF_NOTIFICATION_EMAIL !== fixture.staff.email ||
  process.env.RESEND_API_KEY
) {
  throw new Error(
    "Full lifecycle proof requires the protected disposable runner and synthetic staff mail sink.",
  );
}

const inputDirectory = join(runnerTemp, "opening-readiness-inputs");
const evidenceDirectory = join(runnerTemp, "opening-readiness-evidence");
const desktopTitle = "QA LIFECYCLE REAL — SYNTHETIC";
const mobileTitle = "QA LIFECYCLE DEMO — SYNTHETIC";

type InputManifest = {
  files: Record<
    | "blankNda"
    | "renewSignedNda"
    | "repreneurSignedNda"
    | "informationMemorandum",
    { path: string; sha256: string; bytes: number }
  >;
};

type EvidenceEntry = {
  step: string;
  surface: "desktop" | "mobile" | "database" | "mail" | "storage";
  result: string;
  count?: number;
};

async function login(page: Page, email: string, loginPassword = password) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(loginPassword);
  const signInResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  expect((await signInResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/(dashboard_re|portal\/deals)/, {
    timeout: 30_000,
  });
}

async function chooseOption(
  page: Page,
  trigger: string,
  option: string | RegExp,
) {
  await page.locator(trigger).click();
  await page.getByRole("option", { name: option }).click();
}

async function createDraftOpportunity(
  page: Page,
  input: {
    classification: "real" | "demo";
    title: string;
    officeName: RegExp;
    affiliationId: string;
  },
) {
  await page.goto("/opportunities/new");
  await page
    .locator('button[role="radio"][value="' + input.classification + '"]')
    .click();
  await expect(page.locator("#generated-reference")).toBeDisabled();
  await chooseOption(page, "#geography_node_id", /^France · FR$/);
  await chooseOption(page, "#sector_choice", "Tech & Digital");
  await page.locator("#location").fill("France");
  await page.locator("#revenue_meur").fill("25");
  await page.locator("#ebitda_keur").fill("3000");
  await page.locator("#headcount_range").fill("80");
  await page
    .locator("#description")
    .fill("QA lifecycle synthetic record. Never commercial.");
  await chooseOption(page, "#source_office", input.officeName);
  await page.locator("#office_affiliation_" + input.affiliationId).check();
  const primary = page.locator(
    'input[name="primary_affiliation_id"][value="' + input.affiliationId + '"]',
  );
  if (!(await primary.isChecked())) await primary.check();
  await page.locator("#public_title").fill(input.title);
  await page
    .locator("#teaser_summary")
    .fill("Synthetic teaser for the disposable opening proof.");
  await page.getByRole("button", { name: "Create opportunity" }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}(?:\?.*)?$/, {
    timeout: 30_000,
  });
  const match = new URL(page.url()).pathname.match(
    /\/opportunities\/([0-9a-f-]{36})$/,
  );
  expect(match?.[1]).toBeTruthy();
  return match![1]!;
}

async function activateOpportunity(page: Page, opportunityId: string) {
  await page.goto("/opportunities/" + opportunityId + "?tab=edit");
  await chooseOption(page, "#status", "Active");
  await page.getByRole("button", { name: "Save changes" }).click();
}

async function expectPreview(
  page: Page,
  repreneurId: string,
  opportunityId: string,
  title: string,
  visible: boolean,
) {
  await page.goto(
    "/portal-preview?repreneurId=" +
      encodeURIComponent(repreneurId) +
      "&dealId=" +
      encodeURIComponent(opportunityId),
  );
  if (visible) {
    await expect(
      page
        .locator("#main-content")
        .getByRole("heading", { name: "Portal preview" }),
    ).toBeVisible();
    await expect(
      page.locator("#main-content").getByRole("heading", { name: title }),
    ).toBeVisible();
    await expect(
      page
        .locator("#main-content")
        .getByText("Responses are disabled while previewing.", {
          exact: true,
        }),
    ).toBeVisible();
  } else {
    await expect(
      page
        .locator("#main-content")
        .getByText("Deal not visible in portal preview", { exact: true }),
    ).toBeVisible();
  }
}

async function expectMemoDenied(
  page: Page,
  matchId: string,
  documentId: string,
) {
  const response = await page.request.get(
    `${baseURL}/portal/deals/${matchId}/documents/${documentId}`,
  );
  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
}

async function expectPursuitPageDenied(page: Page, matchId: string) {
  const requestUrl = `${baseURL}/portal/deals/${matchId}`;
  const response = await page.request.get(requestUrl, { maxRedirects: 0 });
  expect(response.url()).toBe(requestUrl);
  expect([200, 404]).toContain(response.status());
  const cacheControl = response.headers()["cache-control"];
  if (cacheControl) {
    expect(cacheControl).toMatch(/private|no-store|no-cache/);
  }
  const body = await response.text();
  // App Router partial prerendering can commit a 200 response before
  // notFound() renders the built-in 404 shell. Require the denial boundary,
  // noindex marker and confidential-data absence; never accept status alone.
  expect(body).toContain("This page could not be found.");
  expect(body).toMatch(
    /<meta(?=[^>]*\bname="robots")(?=[^>]*\bcontent="noindex")[^>]*>/,
  );
  expect(body).not.toContain("Disclosed source");
  expect(body).not.toContain("Download IM");
  expect(body).not.toContain(desktopTitle);
  expect(body).not.toContain("QA OPENING REAL FIRM — SYNTHETIC");
  expect(body).not.toContain("QA OPENING REAL CONTACT — SYNTHETIC");
}

async function expectAnonymousMemoDenied(
  page: Page,
  matchId: string,
  documentId: string,
) {
  expect(await page.context().cookies()).toEqual([]);
  const response = await page.request.get(
    `${baseURL}/portal/deals/${matchId}/documents/${documentId}`,
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(307);
  expect(response.headers()["content-type"] ?? "").not.toContain(
    "application/pdf",
  );
  expect(response.headers()["content-disposition"]).toBeUndefined();
  const location = response.headers().location;
  expect(location).toBeTruthy();
  expect(new URL(location!, baseURL).pathname).toBe("/auth/login");
}

async function one<T>(
  client: Client,
  text: string,
  values: unknown[],
): Promise<T> {
  const { rows } = await client.query<T & Record<string, unknown>>(
    text,
    values,
  );
  expect(rows).toHaveLength(1);
  return rows[0] as T;
}

async function currentFixturePassword(client: Client, userId: string) {
  const credential = await one<{ password: string }>(
    client,
    'SELECT password FROM public."account" WHERE "userId"=$1 AND "providerId"=\'credential\'',
    [userId],
  );
  for (const candidate of [password, `${password}-reset`]) {
    if (
      await verifyPassword({ hash: credential.password, password: candidate })
    ) {
      return candidate;
    }
  }
  throw new Error(
    "Synthetic fixture credential no longer matches an expected password.",
  );
}

test("one disposable opportunity proves the implemented lifecycle subset on desktop and mobile", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const manifest = JSON.parse(
    await readFile(join(inputDirectory, "manifest.json"), "utf8"),
  ) as InputManifest;
  const evidence: EvidenceEntry[] = [];
  const writeEvidence = async () => {
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      join(evidenceDirectory, "lifecycle-register.json"),
      JSON.stringify(
        {
          runLabel: openingReadinessRunLabel(releaseSha),
          releaseSha,
          productionData: false,
          productionCredentials: false,
          responseDeadlineAutomationEvaluated: false,
          canonicalLifecycleCommunicationsVerified: false,
          entries: evidence,
        },
        null,
        2,
      ) + "\n",
    );
  };
  const record = async (entry: EvidenceEntry) => {
    evidence.push(entry);
    await writeEvidence();
  };

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let mobileContext: BrowserContext | null = null;
  let realContext: BrowserContext | null = null;
  let realNonOwnerContext: BrowserContext | null = null;
  let demoContext: BrowserContext | null = null;
  let anonymousContext: BrowserContext | null = null;

  try {
    // The prerequisite auth-readiness test intentionally consumes four of the
    // five loopback sign-in attempts in both auth guards. Discover and reset
    // only those two disposable sign-in buckets so this independent lifecycle
    // proof still exercises the real endpoint without relaxing either policy.
    const signInRouteSuffix = "|/sign-in/email";
    const signInBuckets = await client.query<{ key: string }>(
      `SELECT "key"
       FROM public."rateLimit"
       WHERE "key" LIKE $1`,
      [`%${signInRouteSuffix}`],
    );
    expect(signInBuckets.rows).toHaveLength(1);
    const signInBucket = signInBuckets.rows[0]!.key;
    const signInClient = signInBucket.slice(0, -signInRouteSuffix.length);
    expect(["127.0.0.1", "::1", "::ffff:127.0.0.1"]).toContain(signInClient);
    const resetSignInBudget = await client.query<{ key: string }>(
      `DELETE FROM public."rateLimit"
       WHERE "key"=$1
       RETURNING "key"`,
      [signInBucket],
    );
    expect(resetSignInBudget.rows).toEqual([{ key: signInBucket }]);

    const routeSignInPrefix = "auth:/api/auth/sign-in/email:";
    const routeSignInBuckets = await client.query<{ key: string }>(
      `SELECT "key"
       FROM public."rateLimit"
       WHERE "key" LIKE $1`,
      [`${routeSignInPrefix}%`],
    );
    expect(routeSignInBuckets.rows).toHaveLength(1);
    const routeSignInBucket = routeSignInBuckets.rows[0]!.key;
    expect(routeSignInBucket).toMatch(
      /^auth:\/api\/auth\/sign-in\/email:[A-Za-z0-9_-]{43}$/,
    );
    const resetRouteSignInBudget = await client.query<{ key: string }>(
      `DELETE FROM public."rateLimit"
       WHERE "key"=$1
       RETURNING "key"`,
      [routeSignInBucket],
    );
    expect(resetRouteSignInBudget.rows).toEqual([{ key: routeSignInBucket }]);

    await login(page, fixture.staff.email);
    const staffStorageState = await page.context().storageState();

    const desktopOpportunityId = await createDraftOpportunity(page, {
      classification: "real",
      title: desktopTitle,
      officeName: /QA OPENING REAL FIRM.*QA OPENING REAL OFFICE/,
      affiliationId: fixture.ids.realAffiliation,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(
      new RegExp(`/opportunities/${desktopOpportunityId}(?:\\?.*)?$`),
    );
    await expect(
      page.getByRole("heading", { name: desktopTitle }),
    ).toBeVisible();
    const desktopDraft = await one<{
      reference: string;
      status: string;
      is_demo: boolean;
      repreneur_exposure: string;
      source_office_id: string;
      geography_node_id: string;
    }>(
      client,
      "SELECT reference,status,is_demo,repreneur_exposure,source_office_id,geography_node_id FROM public.opportunities WHERE id=$1",
      [desktopOpportunityId],
    );
    expect(desktopDraft).toMatchObject({
      status: "draft",
      is_demo: false,
      repreneur_exposure: "staff_only",
      source_office_id: fixture.ids.realOffice,
      geography_node_id: "00000000-0000-4092-8000-000000000001",
    });
    expect(desktopDraft.reference).toMatch(/^Re-New - FR - \d+$/);
    const desktopSource = await one<{ links: number; primary_links: number }>(
      client,
      "SELECT count(*)::int AS links,count(*) FILTER (WHERE is_active AND is_primary)::int AS primary_links FROM public.opportunity_ma_contacts WHERE opportunity_id=$1",
      [desktopOpportunityId],
    );
    expect(desktopSource).toEqual({ links: 1, primary_links: 1 });
    await record({
      step: "staff created classified REAL draft with one canonical source",
      surface: "desktop",
      result: "draft hidden",
      count: 1,
    });

    await expectPreview(
      page,
      fixture.ids.realRepreneur,
      desktopOpportunityId,
      desktopTitle,
      false,
    );
    await activateOpportunity(page, desktopOpportunityId);
    await expect
      .poll(
        async () =>
          one<{ status: string; repreneur_exposure: string }>(
            client,
            "SELECT status,repreneur_exposure FROM public.opportunities WHERE id=$1",
            [desktopOpportunityId],
          ),
        { timeout: 30_000 },
      )
      .toEqual({ status: "active", repreneur_exposure: "anonymized" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: desktopTitle }),
    ).toBeVisible();
    await expect(page.locator("#status")).toContainText("Active");
    await expectPreview(
      page,
      fixture.ids.realRepreneur,
      desktopOpportunityId,
      desktopTitle,
      true,
    );
    await record({
      step: "staff activated and previewed REAL opportunity",
      surface: "desktop",
      result: "active anonymized",
    });

    mobileContext = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL,
      storageState: staffStorageState,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("/dashboard_re");
    await expect(mobilePage).toHaveURL(/\/dashboard_re/);
    const mobileOpportunityId = await createDraftOpportunity(mobilePage, {
      classification: "demo",
      title: mobileTitle,
      officeName: /QA OPENING DEMO FIRM.*QA OPENING DEMO OFFICE/,
      affiliationId: fixture.ids.demoAffiliation,
    });
    await mobilePage.reload({ waitUntil: "domcontentloaded" });
    await expect(mobilePage).toHaveURL(
      new RegExp(`/opportunities/${mobileOpportunityId}(?:\\?.*)?$`),
    );
    await expect(
      mobilePage.getByRole("heading", { name: mobileTitle }),
    ).toBeVisible();
    await expectPreview(
      mobilePage,
      fixture.ids.demoRepreneur,
      mobileOpportunityId,
      mobileTitle,
      false,
    );
    await activateOpportunity(mobilePage, mobileOpportunityId);
    await expect
      .poll(
        async () =>
          one<{
            status: string;
            is_demo: boolean;
            repreneur_exposure: string;
          }>(
            client,
            "SELECT status,is_demo,repreneur_exposure FROM public.opportunities WHERE id=$1",
            [mobileOpportunityId],
          ),
        { timeout: 30_000 },
      )
      .toEqual({
        status: "active",
        is_demo: true,
        repreneur_exposure: "anonymized",
      });
    await mobilePage.reload({ waitUntil: "domcontentloaded" });
    await expect(
      mobilePage.getByRole("heading", { name: mobileTitle }),
    ).toBeVisible();
    await expect(mobilePage.locator("#status")).toContainText("Active");
    await expectPreview(
      mobilePage,
      fixture.ids.demoRepreneur,
      mobileOpportunityId,
      mobileTitle,
      true,
    );
    await record({
      step: "staff created, activated, refreshed and previewed DEMO opportunity",
      surface: "mobile",
      result: "active DEMO only",
    });
    await mobileContext.close();
    mobileContext = null;

    realContext = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL,
    });
    const realPage = await realContext.newPage();
    await login(realPage, fixture.repreneurs.real.email);
    await realPage.goto("/portal/deals/" + fixture.ids.realOpportunity);
    await realPage
      .getByRole("button", { name: "Express interest", exact: true })
      .click();
    await expect(
      realPage.getByText("Interest received", { exact: true }),
    ).toBeVisible();
    const notificationMatch = await one<{
      status: string;
      interest_expressed_at: Date | null;
      interest_notification_sent_at: Date | null;
    }>(
      client,
      "SELECT status,interest_expressed_at,interest_notification_sent_at FROM public.opportunity_matches WHERE opportunity_id=$1 AND repreneur_id=$2",
      [fixture.ids.realOpportunity, fixture.ids.realRepreneur],
    );
    expect(notificationMatch.status).toBe("interested");
    expect(notificationMatch.interest_expressed_at).not.toBeNull();
    expect(notificationMatch.interest_notification_sent_at).not.toBeNull();
    await record({
      step: "REAL self-interest persisted and notified synthetic staff sink",
      surface: "mail",
      result: "allowlisted no-send accepted",
    });

    await realPage.goto("/portal/deals/" + desktopOpportunityId);
    await expect(
      realPage.getByRole("heading", { name: desktopTitle }),
    ).toBeVisible();
    await expect(realPage.getByText(mobileTitle, { exact: true })).toHaveCount(
      0,
    );
    await record({
      step: "REAL portal exposed REAL and excluded DEMO",
      surface: "desktop",
      result: "namespace isolated",
    });

    await page.goto(
      "/opportunities/" + desktopOpportunityId + "?tab=recommendations",
    );
    await page.locator("#repreneur_id").click();
    await page
      .getByPlaceholder("Search by name or email...")
      .fill(fixture.repreneurs.real.email);
    await page
      .getByRole("option")
      .filter({ hasText: fixture.repreneurs.real.email })
      .click();
    await expect(
      page.locator("#platform_recommendation_preview"),
    ).toContainText("Strong fit");
    await expect(
      page.locator("#platform_recommendation_preview"),
    ).toContainText("100");
    await chooseOption(page, "#human_recommendation", "Strong fit");
    await page
      .locator("#human_notes")
      .fill("Synthetic lifecycle proof: staff reviewed the automatic result.");
    await page.getByRole("button", { name: "Save recommendation" }).click();
    await expect(
      page.getByText("Recommendation saved", { exact: true }),
    ).toBeVisible();

    const savedMatch = await one<{
      id: string;
      status: string;
      platform_recommendation: string;
      platform_score: number;
      platform_reasons: string[];
    }>(
      client,
      "SELECT id,status,platform_recommendation,platform_score,platform_reasons FROM public.opportunity_matches WHERE opportunity_id=$1 AND repreneur_id=$2",
      [desktopOpportunityId, fixture.ids.realRepreneur],
    );
    expect(savedMatch.status).toBe("proposed");
    expect(savedMatch.platform_recommendation).toBe("strong_fit");
    expect(savedMatch.platform_score).toBe(100);
    expect(savedMatch.platform_reasons).toHaveLength(6);
    await record({
      step: "staff saved complete-thesis recommendation",
      surface: "database",
      result: "proposed strong fit 100 with six reasons",
    });

    await realPage.goto("/portal/deals/" + savedMatch.id);
    await realPage
      .getByRole("button", { name: "I'm interested", exact: true })
      .click();
    await expect(realPage).toHaveURL(/\/portal\/deals$/);
    await expect
      .poll(
        async () =>
          (
            await one<{ status: string }>(
              client,
              "SELECT status FROM public.opportunity_matches WHERE id=$1",
              [savedMatch.id],
            )
          ).status,
        { timeout: 30_000 },
      )
      .toBe("interested");
    await record({
      step: "repreneur responded to staff proposal",
      surface: "desktop",
      result: "manual response recorded; no automated deadline asserted",
    });

    await page.goto(
      "/opportunities/" + desktopOpportunityId + "?tab=recommendations",
    );
    const matchRow = page
      .getByRole("row")
      .filter({ hasText: fixture.repreneurs.real.email });
    await matchRow.getByRole("button", { name: "Validate" }).click();
    await expect(
      page.getByText("Pursuit validated", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          one<{ status: string; pursuit_stage: string }>(
            client,
            "SELECT status,pursuit_stage FROM public.opportunity_matches WHERE id=$1",
            [savedMatch.id],
          ),
        { timeout: 30_000 },
      )
      .toEqual({ status: "active_pursuit", pursuit_stage: "interest" });
    await record({
      step: "staff validated interest into the one active pursuit",
      surface: "desktop",
      result: "active pursuit at interest",
    });

    await page.goto("/opportunities/" + desktopOpportunityId + "?tab=ma");
    await chooseOption(page, "#ma_template", "Request NDA and info memo");
    await expect(page.locator("#ma_subject")).not.toHaveValue("");
    await expect(page.locator("#ma_body")).not.toHaveValue("");
    await page.getByRole("button", { name: "Send to contact" }).click();
    await expect(
      page.getByText("M&A email sent", { exact: true }),
    ).toBeVisible();
    const sourceEmail = await one<{
      delivery_status: string;
      provider_message_id: string | null;
      recipient_email_snapshot: string;
    }>(
      client,
      "SELECT delivery_status,provider_message_id,recipient_email_snapshot FROM public.ma_interactions WHERE opportunity_id=$1 AND template_key='ma_nda_info_memo_request' ORDER BY created_at DESC LIMIT 1",
      [desktopOpportunityId],
    );
    expect(sourceEmail).toEqual({
      delivery_status: "sent",
      provider_message_id: "qa-allowlist-accepted",
      recipient_email_snapshot: "qa-opening-real-contact@re-new.invalid",
    });
    await record({
      step: "staff circulated source-side NDA and IM request",
      surface: "mail",
      result:
        "durable source-request evidence through allowlisted no-send adapter; no E4, E6 or E7 event claimed",
    });

    await page.goto(
      "/opportunities/" + desktopOpportunityId + "?tab=documents",
    );
    await page.locator("#document-title").fill("QA LIFECYCLE IM — SYNTHETIC");
    await chooseOption(page, "#document-type", "Information memorandum (IM)");
    await page
      .locator("#document-file")
      .setInputFiles(manifest.files.informationMemorandum.path);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      page.getByText("QA LIFECYCLE IM — SYNTHETIC", { exact: true }),
    ).toBeVisible();
    const memo = await one<{
      id: string;
      size_bytes: string;
      content_sha256: string;
    }>(
      client,
      "SELECT document.id,document.size_bytes::text,intent.content_sha256 FROM public.opportunity_documents document JOIN public.private_upload_intents intent ON intent.bucket_id=document.storage_bucket AND intent.storage_path=document.storage_path AND intent.status='finalized' WHERE document.opportunity_id=$1 AND document.document_type='deal_book'",
      [desktopOpportunityId],
    );
    expect(Number(memo.size_bytes)).toBe(
      manifest.files.informationMemorandum.bytes,
    );
    expect(memo.content_sha256).toBe(
      manifest.files.informationMemorandum.sha256,
    );

    await realPage.goto("/portal/deals/" + savedMatch.id);
    await expect(
      realPage.getByText("Confidential documents locked", { exact: true }),
    ).toBeVisible();
    await expect(
      realPage.getByRole("link", { name: "Download IM" }),
    ).toHaveCount(0);
    const deniedMemo = await realPage.request.get(
      baseURL + "/portal/deals/" + savedMatch.id + "/documents/" + memo.id,
    );
    expect(deniedMemo.status()).toBe(404);
    expect(deniedMemo.headers()["cache-control"]).toBe("private, no-store");
    expect(deniedMemo.headers()["referrer-policy"]).toBe("no-referrer");
    await record({
      step: "IM persisted privately and portal access failed closed",
      surface: "storage",
      result: "hash matched; pre-grant download denied",
    });

    await page.goto("/opportunities/" + desktopOpportunityId + "?tab=pursuit");
    const blankSection = page
      .getByRole("heading", { name: "Blank NDA template" })
      .locator("xpath=ancestor::section");
    await blankSection
      .locator("#blank_template-title")
      .fill("QA LIFECYCLE BLANK NDA — SYNTHETIC");
    await blankSection
      .locator("#blank_template-file")
      .setInputFiles(manifest.files.blankNda.path);
    await blankSection.getByRole("button", { name: "Record version" }).click();
    await expect(blankSection.getByText("Version 1 recorded.")).toBeVisible();

    await page
      .getByRole("button", { name: "Record qualification request" })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Record intermediary qualification",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Record intermediary qualification",
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Validate blank template" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Validate blank template" }).click();
    await expect(
      page.getByRole("button", { name: "Pass Gate 1" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pass Gate 1" }).click();

    const renewSection = page
      .getByRole("heading", { name: "Re-New-signed copy" })
      .locator("xpath=ancestor::section");
    await renewSection
      .locator("#renew_signed_copy-title")
      .fill("QA LIFECYCLE RE-NEW NDA — SYNTHETIC");
    await renewSection
      .locator("#renew_signed_copy-file")
      .setInputFiles(manifest.files.renewSignedNda.path);
    await renewSection.getByRole("button", { name: "Record version" }).click();
    await expect(renewSection.getByText("Version 1 recorded.")).toBeVisible();

    await realPage.goto("/portal/deals/" + savedMatch.id);
    const ndaDownloadHref = await realPage
      .getByRole("link", { name: "Download template" })
      .getAttribute("href");
    expect(ndaDownloadHref).toBeTruthy();
    const ndaDownload = await realPage.request.get(baseURL + ndaDownloadHref!);
    expect(ndaDownload.status()).toBe(200);
    expect(ndaDownload.headers()["cache-control"]).toBe("private, no-store");
    const ndaBytes = await ndaDownload.body();
    expect(ndaBytes.byteLength).toBe(manifest.files.blankNda.bytes);
    expect(createHash("sha256").update(ndaBytes).digest("hex")).toBe(
      manifest.files.blankNda.sha256,
    );
    await realPage
      .locator("#signed-nda-title")
      .fill("QA LIFECYCLE REPRENEUR NDA — SYNTHETIC");
    await realPage
      .locator("#signed-nda-file")
      .setInputFiles(manifest.files.repreneurSignedNda.path);
    await realPage.getByRole("button", { name: "Upload signed copy" }).click();
    const signedNdaForm = realPage.locator("form").filter({
      has: realPage.locator("#signed-nda-title"),
    });
    await expect(
      signedNdaForm.getByRole("status").filter({
        hasText: "Your signed NDA has been received for staff validation.",
      }),
    ).toBeVisible();

    await page.goto("/opportunities/" + desktopOpportunityId + "?tab=pursuit");
    await page.getByRole("button", { name: "Validate Re-New copy" }).click();
    await expect(
      page.getByRole("button", { name: "Validate repreneur copy" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Validate repreneur copy" }).click();
    await expect(
      page.getByRole("button", { name: "Pass Gate 2" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pass Gate 2" }).click();
    await expect(
      page.getByRole("button", { name: "Record manual dispatch" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Record manual dispatch" }).click();
    await record({
      step: "implemented NDA gates and manual handoff completed",
      surface: "desktop",
      result:
        "Gate 1, both current signatures, Gate 2 and manual dispatch; no E6 or E7 event claimed",
    });

    await page.locator("#journey-im").selectOption(memo.id);
    const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    await page.locator("#journey-nda-expiry").fill(expiry);
    await page
      .getByRole("button", { name: "Grant confidential access" })
      .click();
    await expect(
      page
        .locator("#main-content")
        .getByText("Access granted", { exact: true }),
    ).toBeVisible();
    const grant = await one<{
      live: boolean;
      memo_id: string;
      dispatched: boolean;
      approval_actor: string;
      approval_recorded: boolean;
      source_firm_id: string;
      source_office_id: string;
      source_firm_name: string;
      source_office_name: string;
      disclosed_contacts: Array<{ name?: string }>;
      approval_evidence_complete: boolean;
    }>(
      client,
      `SELECT
         grant_row.revoked_at IS NULL AS live,
         grant_row.information_memo_document_id::text AS memo_id,
         grant_row.dispatch_evidence_id IS NOT NULL AS dispatched,
         grant_row.granted_by AS approval_actor,
         grant_row.source_disclosed_at IS NOT NULL AS approval_recorded,
         grant_row.source_firm_id::text,
         grant_row.source_office_id::text,
         grant_row.source_firm_name,
         grant_row.source_office_name,
         grant_row.disclosed_contacts,
         EXISTS (
           SELECT 1
           FROM public.opportunity_pursuit_evidence evidence
           WHERE evidence.match_id=grant_row.match_id
             AND evidence.event_type='confidential_access_granted'
             AND evidence.actor=grant_row.granted_by
             AND evidence.document_id=grant_row.information_memo_document_id
             AND evidence.metadata->>'information_memo_document_id'=grant_row.information_memo_document_id::text
             AND evidence.metadata->>'source_firm_name'=grant_row.source_firm_name
             AND evidence.metadata->>'source_office_name'=grant_row.source_office_name
         ) AS approval_evidence_complete
       FROM public.opportunity_pursuit_confidential_grants grant_row
       WHERE grant_row.match_id=$1`,
      [savedMatch.id],
    );
    expect(grant).toMatchObject({
      live: true,
      memo_id: memo.id,
      dispatched: true,
      approval_actor: fixture.staff.email,
      approval_recorded: true,
      source_firm_id: fixture.ids.realFirm,
      source_office_id: fixture.ids.realOffice,
      source_firm_name: "QA OPENING REAL FIRM — SYNTHETIC",
      source_office_name: "QA OPENING REAL OFFICE — SYNTHETIC",
      approval_evidence_complete: true,
    });
    expect(grant.disclosed_contacts).toEqual([
      { name: "QA OPENING REAL CONTACT — SYNTHETIC" },
    ]);
    const memoNotification = await one<{ status: string; sent: boolean }>(
      client,
      "SELECT status,sent_at IS NOT NULL AS sent FROM public.opportunity_memo_notifications WHERE match_id=$1",
      [savedMatch.id],
    );
    expect(memoNotification).toEqual({ status: "sent", sent: true });
    await record({
      step: "staff explicitly approved confidential disclosure",
      surface: "database",
      result:
        "actor, timestamp, source scope and immutable grant evidence matched; no E8 event claimed",
    });

    await realPage.goto("/portal/deals/" + savedMatch.id);
    await expect(
      realPage.getByText("QA OPENING REAL FIRM — SYNTHETIC"),
    ).toBeVisible();
    await expect(
      realPage.getByText("QA OPENING REAL CONTACT — SYNTHETIC"),
    ).toBeVisible();
    const memoHref = await realPage
      .getByRole("link", { name: "Download IM" })
      .getAttribute("href");
    expect(memoHref).toBeTruthy();
    const memoDownload = await realPage.request.get(baseURL + memoHref!);
    expect(memoDownload.status()).toBe(200);
    expect(memoDownload.headers()["cache-control"]).toBe("private, no-store");
    const memoBytes = await memoDownload.body();
    expect(memoBytes.byteLength).toBe(
      manifest.files.informationMemorandum.bytes,
    );
    expect(createHash("sha256").update(memoBytes).digest("hex")).toBe(
      manifest.files.informationMemorandum.sha256,
    );

    anonymousContext = await browser.newContext({ baseURL });
    const anonymousPage = await anonymousContext.newPage();
    await expectAnonymousMemoDenied(anonymousPage, savedMatch.id, memo.id);

    realNonOwnerContext = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL,
    });
    const realNonOwnerPage = await realNonOwnerContext.newPage();
    await login(
      realNonOwnerPage,
      fixture.repreneurs.realNonOwner.email,
      await currentFixturePassword(
        client,
        fixture.repreneurs.realNonOwner.userId,
      ),
    );
    await expectPursuitPageDenied(realNonOwnerPage, savedMatch.id);
    await expectMemoDenied(realNonOwnerPage, savedMatch.id, memo.id);
    await realNonOwnerPage.goto(`/portal/deals/${desktopOpportunityId}`);
    const realNonOwnerOpportunityHeader = realNonOwnerPage
      .locator("#main-content header")
      .filter({
        has: realNonOwnerPage.getByRole("heading", { name: desktopTitle }),
      });
    await expect(realNonOwnerOpportunityHeader).toHaveCount(1);
    await expect(
      realNonOwnerOpportunityHeader.getByRole("heading", {
        name: desktopTitle,
      }),
    ).toBeVisible();
    await expect(
      realNonOwnerOpportunityHeader.getByText("Someone is already positioned", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      realNonOwnerPage.getByText("Disclosed source", { exact: true }),
    ).toHaveCount(0);
    await expect(
      realNonOwnerPage.getByText("QA OPENING REAL FIRM — SYNTHETIC"),
    ).toHaveCount(0);
    await expect(
      realNonOwnerPage.getByText("QA OPENING REAL CONTACT — SYNTHETIC"),
    ).toHaveCount(0);
    await expect(
      realNonOwnerPage.getByRole("link", { name: "Download IM" }),
    ).toHaveCount(0);
    await expect(
      realNonOwnerPage.getByRole("link", { name: "Download template" }),
    ).toHaveCount(0);

    demoContext = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL,
    });
    const demoPage = await demoContext.newPage();
    await login(
      demoPage,
      fixture.repreneurs.demo.email,
      await currentFixturePassword(client, fixture.repreneurs.demo.userId),
    );
    await expectPursuitPageDenied(demoPage, savedMatch.id);
    await expectMemoDenied(demoPage, savedMatch.id, memo.id);

    const authorityDenials = await one<{
      demo_denied: boolean;
      real_non_owner_denied: boolean;
    }>(
      client,
      `WITH target AS (
         SELECT information_memo_document_id AS memo_id
         FROM public.opportunity_pursuit_confidential_grants
         WHERE match_id=$1
       )
       SELECT
         NOT public.journey_repreneur_can_access_confidential($1,$2,target.memo_id) AS demo_denied,
         NOT public.journey_repreneur_can_access_confidential($1,$3,target.memo_id) AS real_non_owner_denied
       FROM target`,
      [
        savedMatch.id,
        fixture.ids.demoRepreneur,
        fixture.ids.realNonOwnerRepreneur,
      ],
    );
    expect(authorityDenials).toEqual({
      demo_denied: true,
      real_non_owner_denied: true,
    });
    await record({
      step: "confidential IM grant and audience isolation completed",
      surface: "storage",
      result:
        "exact bytes to owner; anonymous, DEMO and second REAL non-owner denied",
    });

    await page.goto("/analytics_op");
    const activeOpportunitiesCard = page
      .locator("#main-content")
      .locator('[data-slot="card"]')
      .filter({
        has: page.getByText("Active opportunities", { exact: true }),
      });
    await expect(activeOpportunitiesCard).toHaveCount(1);
    await expect(activeOpportunitiesCard).toContainText("2");
    const productionCounts = await one<{
      real_active: number;
      demo_active: number;
      real_active_pursuits: number;
      demo_active_pursuits: number;
    }>(
      client,
      "SELECT (SELECT count(*)::int FROM public.opportunities WHERE status='active' AND is_demo=false) AS real_active,(SELECT count(*)::int FROM public.opportunities WHERE status='active' AND is_demo=true) AS demo_active,(SELECT count(*)::int FROM public.opportunity_matches match JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id WHERE match.status='active_pursuit' AND opportunity.is_demo=false AND repreneur.is_demo=false) AS real_active_pursuits,(SELECT count(*)::int FROM public.opportunity_matches match JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id WHERE match.status='active_pursuit' AND (opportunity.is_demo=true OR repreneur.is_demo=true)) AS demo_active_pursuits",
      [],
    );
    expect(productionCounts).toEqual({
      real_active: 2,
      demo_active: 2,
      real_active_pursuits: 1,
      demo_active_pursuits: 0,
    });
    await record({
      step: "staff operating metric excluded DEMO namespace",
      surface: "database",
      result: "two REAL active shown; two DEMO active excluded",
      count: 2,
    });

    await page.goto("/opportunities/" + desktopOpportunityId + "?tab=pursuit");
    await page.getByRole("button", { name: "Record Continue" }).click();
    await expect(page.locator("#pursuit-complete-reason")).toBeVisible();
    await page
      .locator("#pursuit-complete-reason")
      .fill("Synthetic lifecycle completed successfully.");
    await page.getByRole("button", { name: "Complete pursuit" }).click();
    await expect
      .poll(
        async () =>
          one<{
            match_status: string;
            pursuit_stage: string;
            opportunity_status: string;
            closure_reason: string | null;
            closure_count: number;
          }>(
            client,
            "SELECT match.status AS match_status,match.pursuit_stage,opportunity.status AS opportunity_status,(SELECT history.reason::text FROM public.opportunity_closure_history history WHERE history.opportunity_id=opportunity.id ORDER BY history.closed_at DESC LIMIT 1) AS closure_reason,(SELECT count(*)::int FROM public.opportunity_closure_history history WHERE history.opportunity_id=opportunity.id) AS closure_count FROM public.opportunity_matches match JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id WHERE match.id=$1",
            [savedMatch.id],
          ),
        { timeout: 30_000 },
      )
      .toEqual({
        match_status: "completed",
        pursuit_stage: "closed",
        opportunity_status: "closed",
        closure_reason: "signed_repreneur",
        closure_count: 1,
      });

    const lifecycleEvidence = await client.query<{ event_type: string }>(
      "SELECT event_type::text FROM public.opportunity_pursuit_evidence WHERE match_id=$1 ORDER BY recorded_at,id",
      [savedMatch.id],
    );
    expect(lifecycleEvidence.rows.map((row) => row.event_type)).toEqual([
      "mutual_interest_validated",
      "qualification_requested",
      "intermediary_qualified",
      "template_validated",
      "gate_1_passed",
      "renew_signed_copy_validated",
      "repreneur_signed_copy_validated",
      "gate_2_passed",
      "manual_package_dispatched",
      "confidential_access_granted",
      "continued",
      "access_revoked",
      "completed",
    ]);

    const revocation = await one<{
      revoked_closed_and_history_retained: boolean;
    }>(
      client,
      `SELECT
         grant_row.revoked_at IS NOT NULL
         AND NULLIF(btrim(grant_row.revoked_by), '') IS NOT NULL
         AND NOT public.journey_repreneur_can_access_confidential(
           match_row.id,
           match_row.repreneur_id,
           grant_row.information_memo_document_id
         )
         AND EXISTS (
           SELECT 1 FROM public.opportunity_pursuit_evidence evidence
           WHERE evidence.match_id=match_row.id
             AND evidence.event_type='confidential_access_granted'
         )
         AND EXISTS (
           SELECT 1 FROM public.opportunity_pursuit_evidence evidence
           WHERE evidence.match_id=match_row.id
             AND evidence.event_type='access_revoked'
         )
         AND match_row.status='completed'
         AND opportunity.status='closed'
         AND EXISTS (
           SELECT 1 FROM public.opportunity_closure_history history
           WHERE history.opportunity_id=opportunity.id
             AND history.reason='signed_repreneur'
         ) AS revoked_closed_and_history_retained
       FROM public.opportunity_matches match_row
       JOIN public.opportunities opportunity ON opportunity.id=match_row.opportunity_id
       JOIN public.opportunity_pursuit_confidential_grants grant_row ON grant_row.match_id=match_row.id
       WHERE match_row.id=$1`,
      [savedMatch.id],
    );
    expect(revocation.revoked_closed_and_history_retained).toBe(true);
    await expectMemoDenied(realPage, savedMatch.id, memo.id);
    await expectPursuitPageDenied(realPage, savedMatch.id);
    await page.goto("/opportunities/" + desktopOpportunityId);
    await expect(
      page.getByRole("heading", { name: "Opportunity lifecycle" }),
    ).toBeVisible();
    await expect(
      page.getByText("This opportunity is retained as history.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Closure history" }),
    ).toContainText("Signed repreneur");
    await realPage.goto("/portal/deals");
    await expect(realPage.getByText(desktopTitle, { exact: true })).toHaveCount(
      0,
    );
    await record({
      step: "pursuit continued, completed and closed the opportunity",
      surface: "database",
      result:
        "immutable history retained; disclosure revoked and direct access denied",
      count: lifecycleEvidence.rows.length,
    });

    const serializedEvidence = await readFile(
      join(evidenceDirectory, "lifecycle-register.json"),
      "utf8",
    );
    expect(serializedEvidence).not.toContain(desktopOpportunityId);
    expect(serializedEvidence).not.toContain(mobileOpportunityId);
    expect(serializedEvidence).not.toContain(savedMatch.id);
    expect(serializedEvidence).not.toContain(fixture.staff.email);
    expect(serializedEvidence).not.toContain(fixture.repreneurs.real.email);
    expect(serializedEvidence).not.toContain(
      fixture.repreneurs.realNonOwner.email,
    );
    expect(serializedEvidence).not.toContain(fixture.repreneurs.demo.email);
  } finally {
    await Promise.allSettled([
      mobileContext?.close(),
      realContext?.close(),
      realNonOwnerContext?.close(),
      demoContext?.close(),
      anonymousContext?.close(),
    ]);
    await client.end();
  }
});
