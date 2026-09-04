import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { verifyPassword } from "better-auth/crypto";
import { Client } from "pg";
import { OPENING_READINESS_FIXTURE } from "../../lib/opening-readiness-fixture";

/**
 * Product-runnable, disposable proof for governance #97, #98 and #89.
 *
 * This deliberately operates only on the local Supabase fixture and its
 * `.invalid` personas. It records counts and outcomes only: reset tokens,
 * passwords and mail contents must never leave process memory or a browser
 * session.
 */
const fixture = OPENING_READINESS_FIXTURE;
const password = process.env.OPENING_FIXTURE_PASSWORD;
const databaseUrl = process.env.OPENING_FIXTURE_DATABASE_URL;
const runnerTemp = process.env.RUNNER_TEMP;

if (
  !password ||
  !databaseUrl ||
  !runnerTemp ||
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_CONTRACT_MODE !== "protected" ||
  process.env.QA_MAIL_MODE !== "allowlist" ||
  process.env.RESEND_API_KEY
) {
  throw new Error(
    "Portal-access UAT requires the protected disposable GitHub Actions fixture.",
  );
}

const repreneur = fixture.repreneurs.realNonOwner;
const freshRepreneur = {
  id: "93000000-0000-4000-8000-000000000014",
  email: "qa-opening-fresh-access-uat@re-new.invalid",
};
const evidenceDirectory = join(runnerTemp, "opening-readiness-evidence");

type AccessState = {
  roleCount: number;
  sessionCount: number;
  resetCount: number;
  passwordHash: string | null;
  lastSentAt: string | null;
};

async function login(page: Page, email: string, loginPassword = password) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

async function readAccessState(
  client: Client,
  target: { id: string; userId?: string },
): Promise<AccessState> {
  const userId = target.userId ?? "qa-opening-no-user-for-this-repreneur";
  const [role, session, reset, account] = await Promise.all([
    client.query<{ count: number; last_sent_at: string | null }>(
      `SELECT count(*)::int AS count, max(last_access_email_sent_at)::text AS last_sent_at
       FROM public.app_user_roles
       WHERE repreneur_id=$1 AND role='repreneur'`,
      [target.id],
    ),
    client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM public."session" WHERE "userId"=$1 AND "expiresAt">NOW()',
      [userId],
    ),
    client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM public."verification"
       WHERE "identifier" LIKE 'reset-password:%' AND "value"=$1`,
      [userId],
    ),
    client.query<{ password: string }>(
      'SELECT password FROM public."account" WHERE "userId"=$1 AND "providerId"=\'credential\'',
      [userId],
    ),
  ]);
  expect(account.rows.length).toBeLessThanOrEqual(1);
  return {
    roleCount: role.rows[0]?.count ?? 0,
    sessionCount: session.rows[0]?.count ?? 0,
    resetCount: reset.rows[0]?.count ?? 0,
    passwordHash: account.rows[0]?.password ?? null,
    lastSentAt: role.rows[0]?.last_sent_at ?? null,
  };
}

async function detail(page: Page, repreneurId = repreneur.id) {
  await page.goto(`/repreneurs/${repreneurId}?tab=engagement`);
  await expect(
    page.getByRole("heading", { name: "Portal Access", exact: true }),
  ).toBeVisible();
}

async function linkedPortalUserId(client: Client, repreneurId: string) {
  const { rows } = await client.query<{ user_id: string }>(
    `SELECT user_id
     FROM public.app_user_roles
     WHERE repreneur_id=$1 AND role='repreneur'`,
    [repreneurId],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.user_id).toBeTruthy();
  return rows[0]!.user_id;
}

async function expectConfirmation(
  page: Page,
  title: string,
  recipient = repreneur.email,
) {
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText(recipient);
  return dialog;
}

async function resetTokenForCurrentRole(
  client: Client,
  userId = repreneur.userId,
) {
  const { rows } = await client.query<{ identifier: string }>(
    `SELECT "identifier"
     FROM public."verification"
     WHERE "identifier" LIKE 'reset-password:%' AND "value"=$1
     ORDER BY "createdAt" DESC`,
    [userId],
  );
  expect(rows).toHaveLength(1);
  return rows[0]!.identifier.replace("reset-password:", "");
}

async function expectInvalidPortalLink(page: Page, token: string) {
  await page.goto(
    `/auth/reset-password?intent=portal#token=${encodeURIComponent(token)}`,
  );
  await expect(
    page.getByRole("heading", {
      name: "Lien d'acces indisponible",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Demander un nouveau lien", exact: true }),
  ).toHaveAttribute("href", "/auth/forgot-password?intent=portal");
  await expect(page.locator("#password")).toHaveCount(0);
  await expect(page.locator("#confirmPassword")).toHaveCount(0);
}

test("staff portal-access confirmations have safe exactly-once consequences and one-use recovery", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const client = new Client({ connectionString: databaseUrl });
  const evidence: Record<string, unknown> = {
    ticket97: "confirmation and exactly-once staff actions",
    ticket98:
      "valid, consumed, expired, malformed and revoked portal recovery links",
    ticket89: "controlled portal access persistence and session treatment",
    productionData: false,
    productionCredentials: false,
    outboundProvider: false,
    mailTransport: "protected-allowlist",
  };

  await client.connect();
  let portalContext: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  let setupContext: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  let invalidContext: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  try {
    // The fixture runs several independent browser journeys through the same
    // local server. Stable documentation-range client addresses isolate the
    // server's real per-client auth-rate-limit contract without weakening it.
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": "203.0.113.201",
    });
    // A separate, unmistakably synthetic profile starts with no auth identity,
    // credential, role, session or reset record. This is the genuine fresh
    // Enable path; the established non-owner fixture covers Repair later.
    await client.query(
      `INSERT INTO public.repreneurs(
        id,email,first_name,last_name,lifecycle_status,journey_stage,created_by,is_demo,
        q12_geo_zones,q13_target_sectors_v2,q14_deal_size,q15_structure,q16_equity,
        target_revenue_min_meur,target_revenue_max_meur,target_ebitda_min_keur,
        target_ebitda_max_keur,target_ebitda_margin_min_pct,target_staff_size_min,
        target_staff_size_max,questionnaire_completed_at,needs_data_completion
      ) VALUES (
        $1,$2,'QA','OPENING FRESH ACCESS — SYNTHETIC','client','execution',$3,false,
        '["all-france"]','["Tech & Digital"]','["3-5M"]','["majority_without_fund"]','>450',
        10,50,2000,5000,6,10,250,clock_timestamp(),false
      )`,
      [freshRepreneur.id, freshRepreneur.email, fixture.staff.id],
    );
    expect(await readAccessState(client, freshRepreneur)).toMatchObject({
      roleCount: 0,
      sessionCount: 0,
      resetCount: 0,
      passwordHash: null,
    });

    // Establish the precondition that Resend keeps a currently signed-in
    // repreneur signed in; the fixture's initial state itself has no session.
    portalContext = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.202" },
    });
    const portalPage = await portalContext.newPage();
    await login(portalPage, repreneur.email);
    await expect(portalPage).toHaveURL(/\/portal\/deals/);

    await login(page, fixture.staff.email);
    await expect(page).toHaveURL(/\/dashboard_re/);

    // Fresh Enable: both cancellation and a rapid double confirmation remain
    // safe. One new identity, credential, role and reset record are created;
    // no session exists until the recipient independently completes setup.
    await detail(page, freshRepreneur.id);
    await page
      .getByRole("button", { name: "Enable portal access", exact: true })
      .click();
    let dialog = await expectConfirmation(
      page,
      "Enable portal access?",
      freshRepreneur.email,
    );
    await expect(dialog).toContainText(
      "No existing credentials or active sessions will be changed.",
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await readAccessState(client, freshRepreneur)).toMatchObject({
      roleCount: 0,
      sessionCount: 0,
      resetCount: 0,
      passwordHash: null,
    });
    await page
      .getByRole("button", { name: "Enable portal access", exact: true })
      .click();
    dialog = await expectConfirmation(
      page,
      "Enable portal access?",
      freshRepreneur.email,
    );
    await dialog
      .getByRole("button", { name: "Enable and send link", exact: true })
      .dblclick();
    // The UI appends the persisted send timestamp to each success message.
    // Keep that truthful feedback assertion while using the DB readback below
    // as the durable exactly-once oracle.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      page.getByText(
        /^Portal access enabled and setup link sent\. Last sent .+\.$/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resend access link", exact: true }),
    ).toBeVisible();
    const freshAccess = {
      ...freshRepreneur,
      userId: await linkedPortalUserId(client, freshRepreneur.id),
    };
    const afterFreshEnable = await readAccessState(client, freshAccess);
    expect(afterFreshEnable.roleCount).toBe(1);
    expect(afterFreshEnable.sessionCount).toBe(0);
    expect(afterFreshEnable.resetCount).toBe(1);
    expect(afterFreshEnable.passwordHash).not.toBeNull();
    expect(afterFreshEnable.lastSentAt).not.toBeNull();
    evidence.freshEnable = {
      cancelNoOp: true,
      confirmedDeliveries: afterFreshEnable.resetCount,
      oneNewRole: afterFreshEnable.roleCount === 1,
      newCredential: afterFreshEnable.passwordHash !== null,
      activeSessions: afterFreshEnable.sessionCount,
    };

    await detail(page);
    const initial = await readAccessState(client, repreneur);
    expect(initial.roleCount).toBe(1);
    expect(initial.sessionCount).toBeGreaterThanOrEqual(1);
    expect(initial.resetCount).toBe(0);

    // Resend: cancel is inert; double confirm must result in one new reset
    // verification while preserving the current credential and session.
    await page
      .getByRole("button", { name: "Resend access link", exact: true })
      .click();
    dialog = await expectConfirmation(page, "Resend portal access link?");
    await expect(dialog).toContainText("Credentials will stay unchanged.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(await readAccessState(client, repreneur)).toMatchObject(initial);

    await page
      .getByRole("button", { name: "Resend access link", exact: true })
      .click();
    dialog = await expectConfirmation(page, "Resend portal access link?");
    const resendConfirm = dialog.getByRole("button", {
      name: "Send one link",
      exact: true,
    });
    await resendConfirm.dblclick();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      page.getByText(/^Portal access link sent\. Last sent .+\.$/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resend access link", exact: true }),
    ).toBeVisible();
    const afterResend = await readAccessState(client, repreneur);
    expect(afterResend.roleCount).toBe(1);
    expect(afterResend.sessionCount).toBe(initial.sessionCount);
    expect(afterResend.passwordHash).toBe(initial.passwordHash);
    expect(afterResend.resetCount).toBe(initial.resetCount + 1);
    expect(afterResend.lastSentAt).not.toBeNull();
    evidence.resend = {
      cancelNoOp: true,
      confirmedDeliveries: afterResend.resetCount - initial.resetCount,
      credentialRetained: afterResend.passwordHash === initial.passwordHash,
      activeSessionsRetained: afterResend.sessionCount === initial.sessionCount,
      // Current Better Auth behavior is measured here; the test deliberately
      // does not declare an unimplemented latest-link-only product rule.
      observedUnusedResetRecordsAfterOneResend: afterResend.resetCount,
    };

    // A dialog opened against an old snapshot may not mutate the current
    // access record or create another delivery.
    await detail(page);
    await page
      .getByRole("button", { name: "Resend access link", exact: true })
      .click();
    await expectConfirmation(page, "Resend portal access link?");
    await client.query(
      `UPDATE public.app_user_roles
       SET last_access_email_sent_at=NOW()+interval '1 minute'
       WHERE id=$1`,
      [fixture.ids.realNonOwnerPortalRole],
    );
    await page
      .getByRole("button", { name: "Send one link", exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      page.getByText(
        "Portal access changed after this confirmation opened. Refresh the page and confirm the current state.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resend access link", exact: true }),
    ).toBeVisible();
    const afterStale = await readAccessState(client, repreneur);
    expect(afterStale.resetCount).toBe(afterResend.resetCount);
    evidence.staleConfirmation = { rejected: true, extraDeliveries: 0 };

    // Disable removes the role, current sessions and all unused reset links;
    // Cancel leaves each of those state surfaces untouched.
    await detail(page);
    await page
      .getByRole("button", { name: "Disable portal access", exact: true })
      .click();
    dialog = await expectConfirmation(page, "Disable portal access?");
    await expect(dialog).toContainText("No email will be sent.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const beforeDisable = await readAccessState(client, repreneur);
    expect(beforeDisable.roleCount).toBe(1);
    expect(beforeDisable.resetCount).toBe(afterResend.resetCount);

    const revokedToken = await resetTokenForCurrentRole(client);
    await page
      .getByRole("button", { name: "Disable portal access", exact: true })
      .click();
    dialog = await expectConfirmation(page, "Disable portal access?");
    await dialog
      .getByRole("button", { name: "Disable access", exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      page.getByText("Portal access disabled and sessions revoked.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Repair portal access & send link",
        exact: true,
      }),
    ).toBeVisible();
    const afterDisable = await readAccessState(client, repreneur);
    expect(afterDisable.roleCount).toBe(0);
    expect(afterDisable.sessionCount).toBe(0);
    expect(afterDisable.resetCount).toBe(0);
    expect(afterDisable.passwordHash).toBe(initial.passwordHash);
    await portalPage.goto("/portal/deals");
    await expect(portalPage).toHaveURL(/\/auth\/login/);
    evidence.disable = {
      cancelNoOp: true,
      roleRemoved: afterDisable.roleCount === 0,
      activeSessionsRevoked: afterDisable.sessionCount === 0,
      unusedResetLinksRevoked: afterDisable.resetCount === 0,
      credentialRetained: afterDisable.passwordHash === initial.passwordHash,
    };

    invalidContext = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.203" },
    });
    await expectInvalidPortalLink(await invalidContext.newPage(), revokedToken);

    // Re-enable is correctly labelled Repair because it preserves the login
    // identity but deliberately rotates its credential and starts a fresh
    // one-use setup flow.
    await detail(page);
    await page
      .getByRole("button", {
        name: "Repair portal access & send link",
        exact: true,
      })
      .click();
    dialog = await expectConfirmation(page, "Repair portal access?");
    await expect(dialog).toContainText("existing credential will be replaced");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await readAccessState(client, repreneur)).toMatchObject(
      afterDisable,
    );

    await page
      .getByRole("button", {
        name: "Repair portal access & send link",
        exact: true,
      })
      .click();
    dialog = await expectConfirmation(page, "Repair portal access?");
    const repairConfirm = dialog.getByRole("button", {
      name: "Repair and send link",
      exact: true,
    });
    await repairConfirm.dblclick();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(
      page.getByText(
        /^Portal access repaired and setup link sent\. Last sent .+\.$/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resend access link", exact: true }),
    ).toBeVisible();
    const afterRepair = await readAccessState(client, repreneur);
    expect(afterRepair.roleCount).toBe(1);
    expect(afterRepair.sessionCount).toBe(0);
    expect(afterRepair.resetCount).toBe(1);
    expect(afterRepair.passwordHash).not.toBe(initial.passwordHash);
    expect(
      await verifyPassword({ hash: afterRepair.passwordHash, password }),
    ).toBe(false);
    evidence.repair = {
      cancelNoOp: true,
      confirmedDeliveries: afterRepair.resetCount,
      oneRole: afterRepair.roleCount === 1,
      priorSessionsRevoked: afterRepair.sessionCount === 0,
      credentialRotated: afterRepair.passwordHash !== initial.passwordHash,
    };

    // The fresh setup token is usable once. Its actual token value stays only
    // in memory and is never written to the evidence artifact.
    const setupToken = await resetTokenForCurrentRole(client);
    const setupPassword = `${password}-access-uat`;
    setupContext = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.204" },
    });
    const setupPage = await setupContext.newPage();
    await setupPage.goto(
      `/auth/reset-password?intent=portal#token=${encodeURIComponent(setupToken)}`,
    );
    await expect(
      setupPage.getByRole("heading", {
        name: "Creer votre mot de passe",
        exact: true,
      }),
    ).toBeVisible();
    await setupPage.locator("#password").fill(setupPassword);
    await setupPage.locator("#confirmPassword").fill(setupPassword);
    await setupPage
      .getByRole("button", { name: "Creer mon mot de passe", exact: true })
      .click();
    await expect(
      setupPage.getByRole("heading", {
        name: "Mot de passe cree",
        exact: true,
      }),
    ).toBeVisible();
    const afterSetup = await readAccessState(client, repreneur);
    expect(afterSetup.resetCount).toBe(0);
    expect(
      await verifyPassword({
        hash: afterSetup.passwordHash,
        password: setupPassword,
      }),
    ).toBe(true);
    const replay = await setupPage.request.post("/api/auth/reset-password", {
      data: { newPassword: `${setupPassword}-replay`, token: setupToken },
      headers: { Origin: "http://127.0.0.1:3000" },
    });
    expect(replay.status()).toBe(400);
    expect(await replay.json()).toMatchObject({ code: "INVALID_TOKEN" });
    await expectInvalidPortalLink(setupPage, setupToken);
    evidence.setup = {
      validLinkConsumedOnce: true,
      replayRejected: true,
      consumedBrowserRecovery: true,
    };

    // A repreneur session cannot reach the staff record or its mutation UI.
    // The server action separately calls requireStaffAccess; the existing
    // focused authorization tests exercise that direct action boundary.
    await login(setupPage, repreneur.email, setupPassword);
    await expect(setupPage).toHaveURL(/\/portal\/deals/);
    await setupPage.goto(`/repreneurs/${freshRepreneur.id}`);
    await expect(setupPage).toHaveURL(/\/portal\/deals/);
    await expect(
      setupPage.getByRole("heading", { name: "Portal Access", exact: true }),
    ).toHaveCount(0);
    evidence.nonStaff = { staffRouteDenied: true, staffActionUiAbsent: true };

    // Both a syntactically valid expired token and malformed input route to
    // the non-enumerating portal recovery path. The expiry row stays only in
    // the disposable stack that the workflow destroys after the test.
    const expiredToken = "AbCdEfGhJkLmNoPqRsTuVwXy";
    await client.query(
      `INSERT INTO public."verification"(id, "identifier", "value", "expiresAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,NOW()-interval '1 minute',NOW(),NOW())`,
      [
        "qa-opening-expired-access-uat",
        `reset-password:${expiredToken}`,
        repreneur.userId,
      ],
    );
    await expectInvalidPortalLink(setupPage, expiredToken);
    await expectInvalidPortalLink(setupPage, "invalid");
    await setupPage.goto("/auth/reset-password?intent=portal");
    await expect(
      setupPage.getByRole("heading", {
        name: "Lien d'acces indisponible",
        exact: true,
      }),
    ).toBeVisible();
    await expect(setupPage.locator("#password")).toHaveCount(0);
    await expect(setupPage.locator("#confirmPassword")).toHaveCount(0);
    await setupPage.reload();
    await expect(
      setupPage.getByRole("heading", {
        name: "Lien d'acces indisponible",
        exact: true,
      }),
    ).toBeVisible();
    await expect(setupPage.locator("#password")).toHaveCount(0);
    await expect(setupPage.locator("#confirmPassword")).toHaveCount(0);
    await setupPage.goBack();
    await expect(
      setupPage.getByRole("heading", {
        name: "Lien d'acces indisponible",
        exact: true,
      }),
    ).toBeVisible();
    await expect(setupPage.locator("#password")).toHaveCount(0);
    await expect(setupPage.locator("#confirmPassword")).toHaveCount(0);
    await setupPage.goForward();
    await expect(
      setupPage.getByRole("heading", {
        name: "Lien d'acces indisponible",
        exact: true,
      }),
    ).toBeVisible();
    await expect(setupPage.locator("#password")).toHaveCount(0);
    await expect(setupPage.locator("#confirmPassword")).toHaveCount(0);
    evidence.recovery = {
      expiredRejected: true,
      malformedRejected: true,
      missingRejected: true,
      missingRefreshAndBackForwardSafe: true,
      disableRevokedRejected: true,
      recoveryRoute: "/auth/forgot-password?intent=portal",
    };
    // The protected adapter intentionally has no persistent mailbox. The
    // strongest fixture-safe proof is each browser-confirmed action's success
    // response plus its one generated verification and recorded send time;
    // no mail body or provider call log exists to retain by design.
    evidence.mailBoundary = {
      persistentMailbox: false,
      freshEnableAcceptedNoSendCalls: afterFreshEnable.lastSentAt ? 1 : 0,
      resendAcceptedNoSendCalls: afterResend.lastSentAt ? 1 : 0,
      repairAcceptedNoSendCalls: afterRepair.lastSentAt ? 1 : 0,
      evidence:
        "confirmed browser success, one reset verification and persisted last_access_email_sent_at per action",
    };

    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      join(evidenceDirectory, "portal-access-uat.json"),
      JSON.stringify(evidence),
    );
  } finally {
    await Promise.all([
      portalContext?.close(),
      setupContext?.close(),
      invalidContext?.close(),
    ]);
    await client.end();
  }
});
