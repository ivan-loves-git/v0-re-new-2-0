import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !password ||
  !databaseUrl ||
  !releaseSha ||
  !runnerTemp ||
  !supabaseUrl ||
  !anonKey ||
  !serviceRoleKey ||
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_CONTRACT_MODE !== "protected" ||
  process.env.RESEND_API_KEY
) {
  throw new Error(
    "Opening readiness browser proof requires the protected disposable runner.",
  );
}

const inputDirectory = join(runnerTemp, "opening-readiness-inputs");
const evidenceDirectory = join(runnerTemp, "opening-readiness-evidence");

async function login(
  page: Page,
  email: string,
  destination: RegExp,
  loginPassword = password,
) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(destination, { timeout: 30_000 });
}

async function logout(page: Page) {
  await page.goto("/auth/logout");
  await expect(page).toHaveURL(/\/auth\/login/);
}

test("synthetic personas, private documents, safe mail, and namespaces are product-runnable", async ({
  page,
}) => {
  await page.goto("/portal/deals");
  await expect(page).toHaveURL(/\/auth\/login/);

  await login(page, fixture.staff.email, /\/dashboard_re/);
  await page.goto(
    `/opportunities/${fixture.ids.realOpportunity}?tab=documents`,
  );
  await expect(
    page.getByText("QA OPENING REAL — SYNTHETIC", { exact: true }).first(),
  ).toBeVisible();

  await page.locator("#document-title").fill("QA OPENING IM — SYNTHETIC");
  await page.locator("#document-type").click();
  await page
    .getByRole("option", { name: "Information memorandum (IM)" })
    .click();
  await page
    .locator("#document-file")
    .setInputFiles(
      join(inputDirectory, "qa-opening-information-memorandum.pdf"),
    );
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByText("QA OPENING IM — SYNTHETIC", { exact: true }),
  ).toBeVisible();

  await page.goto(`/opportunities/${fixture.ids.realOpportunity}?tab=pursuit`);
  const blankNda = page
    .getByRole("heading", { name: "Blank NDA template" })
    .locator("xpath=ancestor::section");
  await blankNda
    .locator("#blank_template-title")
    .fill("QA OPENING BLANK NDA — SYNTHETIC");
  await blankNda
    .locator("#blank_template-file")
    .setInputFiles(join(inputDirectory, "qa-opening-blank-nda.pdf"));
  await blankNda
    .getByRole("button", { name: "Record version", exact: true })
    .click();
  await expect(blankNda.getByText("Version 1 recorded.")).toBeVisible();

  const staffCookies = await page.context().cookies();
  expect(
    staffCookies.some((cookie) =>
      cookie.name.includes("better-auth.session_token"),
    ),
  ).toBe(true);

  await logout(page);
  await login(page, fixture.repreneurs.real.email, /\/portal\/deals/);
  const realLiveOpportunities = page.getByRole("region", {
    name: "Live Opportunities",
  });
  await expect(
    realLiveOpportunities.getByText("QA OPENING REAL — SYNTHETIC", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    realLiveOpportunities.getByText("QA OPENING DEMO — SYNTHETIC", {
      exact: true,
    }),
  ).toHaveCount(0);

  await logout(page);
  await login(page, fixture.repreneurs.demo.email, /\/portal\/deals/);
  await expect(page.getByText("Demo profile", { exact: true })).toBeVisible();
  const demoLiveOpportunities = page.getByRole("region", {
    name: "Live Opportunities",
  });
  await expect(
    demoLiveOpportunities.getByText("QA OPENING DEMO — SYNTHETIC", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    demoLiveOpportunities.getByText("QA OPENING REAL — SYNTHETIC", {
      exact: true,
    }),
  ).toHaveCount(0);

  await logout(page);
  await page.goto("/auth/forgot-password");
  await page.locator("#email").fill(fixture.repreneurs.real.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows: resetRows } = await client.query<{
      identifier: string;
      value: string;
    }>(
      `SELECT "identifier", "value"
       FROM public."verification"
       WHERE "identifier" LIKE 'reset-password:%' AND "value"=$1
       ORDER BY "createdAt" DESC`,
      [fixture.repreneurs.real.userId],
    );
    expect(resetRows).toHaveLength(1);
    expect(
      resetRows[0]?.identifier.replace("reset-password:", "").length,
    ).toBeGreaterThanOrEqual(24);
    const resetToken = resetRows[0]!.identifier.replace("reset-password:", "");
    const resetPassword = `${password}-reset`;

    await page.goto(
      `/auth/reset-password?token=${encodeURIComponent(resetToken)}`,
    );
    await expect(
      page.getByRole("heading", { name: "Set new password" }),
    ).toBeVisible();
    await page.locator("#password").fill(resetPassword);
    await page.locator("#confirmPassword").fill(resetPassword);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(
      page.getByRole("heading", { name: "Password reset" }),
    ).toBeVisible();

    const replay = await page.request.post("/api/auth/reset-password", {
      data: { newPassword: `${resetPassword}-replay`, token: resetToken },
      headers: { Origin: "http://127.0.0.1:3000" },
    });
    expect(replay.status()).toBe(400);
    expect(await replay.json()).toMatchObject({ code: "INVALID_TOKEN" });

    const { rows: consumedResetRows } = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM public."verification"
       WHERE "identifier"=$1`,
      [`reset-password:${resetToken}`],
    );
    expect(consumedResetRows[0]?.count).toBe(0);

    const { rows: updatedCredentialRows } = await client.query<{
      password: string;
    }>(
      `SELECT password FROM public."account"
       WHERE "userId"=$1 AND "providerId"='credential'`,
      [fixture.repreneurs.real.userId],
    );
    expect(updatedCredentialRows).toHaveLength(1);
    expect(
      await verifyPassword({
        hash: updatedCredentialRows[0]!.password,
        password: resetPassword,
      }),
    ).toBe(true);
    expect(
      await verifyPassword({
        hash: updatedCredentialRows[0]!.password,
        password,
      }),
    ).toBe(false);

    await login(
      page,
      fixture.repreneurs.real.email,
      /\/portal\/deals/,
      resetPassword,
    );
    await expect(
      realLiveOpportunities.getByText("QA OPENING REAL — SYNTHETIC", {
        exact: true,
      }),
    ).toBeVisible();
    await logout(page);
    await page.goto(
      `/auth/reset-password?token=${encodeURIComponent(resetToken)}`,
    );
    await expect(
      page.getByRole("heading", { name: "Invalid link" }),
    ).toBeVisible();

    const { rows: documentRows } = await client.query<{
      id: string;
      document_type: string;
      storage_bucket: string;
      storage_path: string;
      size_bytes: string;
      content_sha256: string;
    }>(
      `SELECT document.id, document.document_type, document.storage_bucket,
              document.storage_path, document.size_bytes::text,
              intent.content_sha256
       FROM public.opportunity_documents document
       JOIN public.private_upload_intents intent
         ON intent.bucket_id=document.storage_bucket
        AND intent.storage_path=document.storage_path
        AND intent.status='finalized'
       WHERE document.opportunity_id=$1
       ORDER BY document.document_type`,
      [fixture.ids.realOpportunity],
    );
    expect(documentRows.map((row) => row.document_type).sort()).toEqual([
      "deal_book",
      "nda",
    ]);

    const { rows: artifactRows } = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM public.opportunity_nda_artifacts
       WHERE opportunity_id=$1 AND artifact_role='blank_template'`,
      [fixture.ids.realOpportunity],
    );
    expect(artifactRows[0]?.count).toBe(1);

    const { rows: crossNamespaceRows } = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM public.opportunity_matches match
       JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id
       JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id
       WHERE opportunity.is_demo<>repreneur.is_demo`,
    );
    expect(crossNamespaceRows[0]?.count).toBe(0);

    await expect(
      client.query(
        `INSERT INTO public.opportunity_matches(
           opportunity_id,repreneur_id,status,created_by
         ) VALUES ($1,$2,'shortlisted',$3)`,
        [
          fixture.ids.realOpportunity,
          fixture.ids.demoRepreneur,
          fixture.staff.id,
        ],
      ),
    ).rejects.toThrow(/w164_cross_namespace_match_denied/);

    const manifest = JSON.parse(
      await readFile(join(inputDirectory, "manifest.json"), "utf8"),
    ) as {
      files: Record<string, { sha256: string; bytes: number }>;
    };
    const expectedByDocumentType = {
      deal_book: manifest.files.informationMemorandum,
      nda: manifest.files.blankNda,
    } as const;
    const storageReadback: Array<{
      type: string;
      bytes: number;
      sha256Matched: true;
    }> = [];

    for (const document of documentRows) {
      const expected =
        expectedByDocumentType[
          document.document_type as keyof typeof expectedByDocumentType
        ];
      expect(expected).toBeDefined();
      expect(Number(document.size_bytes)).toBe(expected!.bytes);
      expect(document.content_sha256).toBe(expected!.sha256);

      const directResponse = await page.request.get(
        `${supabaseUrl}/storage/v1/object/${document.storage_bucket}/${document.storage_path}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        },
      );
      expect(directResponse.status()).not.toBe(200);

      const serviceReadback = await page.request.get(
        `${supabaseUrl}/storage/v1/object/${document.storage_bucket}/${document.storage_path}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        },
      );
      expect(serviceReadback.status()).toBe(200);
      const storedBytes = await serviceReadback.body();
      expect(storedBytes.byteLength).toBe(expected!.bytes);
      expect(createHash("sha256").update(storedBytes).digest("hex")).toBe(
        expected!.sha256,
      );
      storageReadback.push({
        type: document.document_type,
        bytes: storedBytes.byteLength,
        sha256Matched: true,
      });
    }
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      join(evidenceDirectory, "browser-enablement.json"),
      `${JSON.stringify(
        {
          runLabel: openingReadinessRunLabel(releaseSha),
          releaseSha,
          syntheticPersonasAuthenticated: ["staff", "REAL", "DEMO"],
          namespaceInventory: { realOnly: true, demoOnly: true },
          documents: {
            registered: documentRows.map((row) => row.document_type),
            inputs: manifest.files,
            privateStorageReadback: storageReadback,
            directAnonymousAccessDenied: true,
          },
          passwordReset: {
            protectedNoSendAdapter: true,
            tokenConsumedOnce: true,
            replayRejected: true,
            changedCredentialAuthenticated: true,
            tokenRecorded: false,
          },
          productionCredentials: false,
          productionData: false,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await client.end();
  }
});
