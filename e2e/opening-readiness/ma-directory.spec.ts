import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  captureMaDirectoryProof,
  cleanupMaDirectoryProof,
} from "../../lib/qa/ma-directory-proof";
import { signInMaFixture } from "./ma-directory-support";
import { join } from "node:path";
import {
  OPENING_READINESS_FIXTURE as fixture,
  assertOpeningReadinessFixtureEnvironment,
} from "../../lib/opening-readiness-fixture";

const databaseUrl = process.env.OPENING_FIXTURE_DATABASE_URL;
const password = process.env.OPENING_FIXTURE_PASSWORD;
const runnerTemp = process.env.RUNNER_TEMP;
assertOpeningReadinessFixtureEnvironment(process.env);
if (!databaseUrl || !password || !runnerTemp) {
  throw new Error(
    "M&A directory proof requires the protected disposable CI fixture and fictional mail sink.",
  );
}
test("staff create and complete canonical M&A profiles on desktop and mobile with persistent errors and history", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const runId = randomUUID();
  const label = `QA 257 ${runId}`;
  const ownedFirms: string[] = [],
    ownedOffices: string[] = [],
    ownedContacts: string[] = [];
  const evidence = join(runnerTemp!, "opening-readiness-evidence");
  await mkdir(evidence, { recursive: true });
  const originalBuckets = (
    await db.query<{ key: string }>(
      `SELECT "key" FROM public."rateLimit" WHERE "key" LIKE '%|/sign-in/email' OR "key" LIKE 'auth:/api/auth/sign-in/email:%'`,
    )
  ).rows.map((row) => row.key);
  const emailBefore = (
    await db.query("SELECT count(*)::int AS count FROM public.email_logs")
  ).rows[0].count;
  const suppressionBefore = (
    await db.query(
      "SELECT id,campaign_email_suppressed,campaign_email_suppression_reason FROM public.ma_contacts WHERE id=ANY($1::uuid[]) ORDER BY id",
      [[fixture.ids.realContact, fixture.ids.demoContact]],
    )
  ).rows;
  try {
    await signInMaFixture(page, fixture.staff.email, password!, "staff");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/opportunities/ma/firms");
    await expect(
      page.getByRole("button", { name: "Add firm", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(evidence, "ma-directory-firms-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Add firm", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Add M&A firm" });
    await dialog
      .getByLabel("Firm name (required)")
      .fill(`${label} Synthetic Advisory`);
    await dialog.getByLabel("Office name (required)").fill("Central office");
    await dialog
      .getByRole("button", { name: "Create firm", exact: true })
      .click();
    await expect(
      dialog.getByText("Enter the operating office city.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Firm name (required)")).toHaveValue(
      `${label} Synthetic Advisory`,
    );
    expect(
      (
        await db.query("SELECT id FROM public.ma_firms WHERE name=$1", [
          `${label} Synthetic Advisory`,
        ])
      ).rows,
    ).toHaveLength(0);
    await page.screenshot({
      path: join(evidence, "ma-directory-validation-desktop.png"),
      fullPage: true,
    });
    await dialog.getByLabel("City (required)").fill("Lyon");
    await dialog
      .getByRole("button", { name: "Create firm", exact: true })
      .click();
    await expect(page).toHaveURL(/\/opportunities\/ma\/firms\/[0-9a-f-]+$/);
    const graph = (
      await db.query<{
        firm_id: string;
        office_id: string;
        city: string;
        is_default: boolean;
        created_by: string;
        status: string;
      }>(
        "SELECT f.id AS firm_id,o.id AS office_id,o.city,o.is_default,f.created_by,f.status FROM public.ma_firms f JOIN public.ma_offices o ON o.firm_id=f.id WHERE f.name=$1",
        [`${label} Synthetic Advisory`],
      )
    ).rows;
    expect(graph).toHaveLength(1);
    const created = graph[0]!;
    ownedFirms.push(created.firm_id);
    ownedOffices.push(created.office_id);
    expect(created).toMatchObject({
      city: "Lyon",
      is_default: false,
      created_by: fixture.staff.id,
      status: "active",
    });
    expect(
      (
        await db.query(
          "SELECT id FROM public.ma_contact_office_affiliations WHERE office_id=$1",
          [created.office_id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "SELECT id FROM public.opportunities WHERE source_office_id=$1",
          [created.office_id],
        )
      ).rows,
    ).toHaveLength(0);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: `${label} Synthetic Advisory`,
        exact: true,
      }),
    ).toBeVisible();

    // A freshly created firm can immediately receive a second office (#262).
    await expect(page.locator("header").getByText("active", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Add office", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Add operating office" });
    await dialog
      .getByLabel("Office name (required)")
      .fill(`${label} North office`);
    await dialog
      .getByRole("button", { name: "Add office", exact: true })
      .click();
    await expect(dialog.getByLabel("Office name (required)")).toHaveValue(
      `${label} North office`,
    );
    await expect(
      dialog.getByText("Enter the operating office city.", { exact: true }),
    ).toBeVisible();
    await dialog.getByLabel("City (required)").fill("Lille");
    await dialog
      .getByRole("button", { name: "Add office", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const addedOffice = (
      await db.query<{ id: string; city: string }>(
        "SELECT id,city FROM public.ma_offices WHERE firm_id=$1 AND name=$2",
        [created.firm_id, `${label} North office`],
      )
    ).rows;
    expect(addedOffice).toHaveLength(1);
    ownedOffices.push(addedOffice[0]!.id);
    expect(addedOffice[0]!.city).toBe("Lille");
    await page.reload();
    await expect(page.getByText(`${label} North office`, { exact: true })).toBeVisible();
    await page.screenshot({ path: join(evidence, "ma-firm-second-office-desktop.png"), fullPage: true });

    const formerProspect = "26200000-0000-4000-8000-000000000071";
    expect((await db.query("SELECT status,internal_notes FROM public.ma_firms WHERE id=$1", [formerProspect])).rows[0]).toEqual({
      status: "active", internal_notes: "Retained before #262 normalization",
    });
    await page.goto(`/opportunities/ma/firms/${formerProspect}`);
    await page.getByRole("button", { name: "Add office", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Add operating office" });
    await dialog.getByLabel("Office name (required)").fill(`${label} Former prospect office`);
    await dialog.getByLabel("City (required)").fill("Bordeaux");
    await dialog.getByRole("button", { name: "Add office", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const normalizedOffice = (await db.query<{ id: string }>("SELECT id FROM public.ma_offices WHERE firm_id=$1 AND name=$2", [formerProspect, `${label} Former prospect office`])).rows;
    expect(normalizedOffice).toHaveLength(1);
    ownedOffices.push(normalizedOffice[0]!.id);
    await page.reload();
    await expect(page.getByText(`${label} Former prospect office`, { exact: true })).toBeVisible();
    await page.screenshot({ path: join(evidence, "ma-former-prospect-office-desktop.png"), fullPage: true });

    await page.goto("/opportunities/ma/contacts");
    await page
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Add office contact" });
    await dialog.getByRole("combobox").click();
    await page
      .getByRole("option")
      .filter({ hasText: `${label} Synthetic Advisory` })
      .filter({ hasText: "Central office" })
      .click();
    await dialog
      .getByLabel("First name", { exact: true })
      .fill(`${label} Phone person`);
    await dialog
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    await expect(
      dialog.getByText("Add an email address or phone number.").first(),
    ).toBeVisible();
    await expect(dialog.getByLabel("First name", { exact: true })).toHaveValue(
      `${label} Phone person`,
    );
    await page.screenshot({
      path: join(evidence, "ma-directory-contacts-desktop.png"),
      fullPage: true,
    });
    await dialog.getByLabel("Email", { exact: true }).fill("malformed");
    await dialog.getByLabel("Phone", { exact: true }).fill("+33 1 00 00 00 00");
    await dialog
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    await expect(
      dialog.getByText("Enter a valid email address, or leave it blank.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Phone", { exact: true })).toHaveValue(
      "+33 1 00 00 00 00",
    );
    await dialog.getByLabel("Email", { exact: true }).fill("");
    await dialog
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const person = (
      await db.query<{
        id: string;
        office_id: string;
        email: null;
        phone: string;
      }>(
        "SELECT c.id,a.office_id,c.email,c.phone FROM public.ma_contacts c JOIN public.ma_contact_office_affiliations a ON a.contact_id=c.id AND a.is_active WHERE a.office_id=$1",
        [created.office_id],
      )
    ).rows;
    expect(person).toHaveLength(1);
    ownedContacts.push(person[0]!.id);
    expect(person[0]).toMatchObject({
      office_id: created.office_id,
      email: null,
      phone: "+33 1 00 00 00 00",
    });
    await page.goto(`/opportunities/ma/offices/${created.office_id}`);
    await page
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Add office contact" });
    await expect(
      dialog.getByText(
        `Firm and office: ${label} Synthetic Advisory · Central office`,
        { exact: true },
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    // An incomplete historical target is retained before any profile edit.
    const legacy = (
      await db.query<{
        firm_id: string;
        office_id: string;
        contact_id: string;
        affiliation_id: string;
      }>(
        `WITH f AS (INSERT INTO public.ma_firms(name,created_by) VALUES ($1,'fixture-257') RETURNING id), o AS (INSERT INTO public.ma_offices(firm_id,name,created_by) SELECT id,'Legacy office','fixture-257' FROM f RETURNING id,firm_id), c AS (INSERT INTO public.ma_contacts(first_name,created_by) VALUES ($2,'fixture-257') RETURNING id), a AS (INSERT INTO public.ma_contact_office_affiliations(contact_id,office_id,created_by) SELECT c.id,o.id,'fixture-257' FROM c,o RETURNING id,contact_id,office_id) SELECT o.firm_id,o.id AS office_id,a.contact_id,a.id AS affiliation_id FROM o,a`,
        [`${label} Legacy Advisory`, `${label} Legacy person`],
      )
    ).rows[0]!;
    ownedFirms.push(legacy.firm_id);
    ownedOffices.push(legacy.office_id);
    ownedContacts.push(legacy.contact_id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/opportunities/ma/offices/${legacy.office_id}`);
    await page.getByRole("button", { name: "Edit notes", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Internal notes", exact: true })
      .fill(`${label} notes retained after error`);
    await page.getByRole("button", { name: "Save notes", exact: true }).click();
    await expect(
      page
        .getByText("Complete the office city before saving this profile.", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Internal notes", exact: true }),
    ).toHaveValue(`${label} notes retained after error`);
    expect(
      (
        await db.query(
          "SELECT city,internal_notes FROM public.ma_offices WHERE id=$1",
          [legacy.office_id],
        )
      ).rows[0],
    ).toMatchObject({ city: null, internal_notes: null });
    await page.screenshot({
      path: join(evidence, "ma-directory-correction-mobile.png"),
      fullPage: true,
    });
    await page
      .getByLabel("City (required to save this office)")
      .filter({ visible: true })
      .fill("Paris");
    await page.getByRole("button", { name: "Save notes", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Edit notes", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page
        .getByText(`${label} notes retained after error`, { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.goto("/opportunities/ma/contacts");
    await page
      .getByPlaceholder("Search contacts, email or office")
      .filter({ visible: true })
      .fill(`${label} Legacy person`);
    await page
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Edit contact details" });
    await dialog
      .getByLabel("Internal notes", { exact: true })
      .fill(`${label} contact notes`);
    await dialog
      .getByRole("button", { name: "Save correction", exact: true })
      .click();
    await expect(
      dialog.getByText("Add an email address or phone number.").first(),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("Internal notes", { exact: true }),
    ).toHaveValue(`${label} contact notes`);
    await dialog.getByLabel("Phone", { exact: true }).fill("+33 2 00 00 00 00");
    await dialog
      .getByRole("button", { name: "Save correction", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(
      (
        await db.query(
          "SELECT c.phone,c.internal_notes,c.updated_by,a.id AS affiliation_id FROM public.ma_contacts c JOIN public.ma_contact_office_affiliations a ON a.contact_id=c.id AND a.is_active WHERE c.id=$1",
          [legacy.contact_id],
        )
      ).rows[0],
    ).toMatchObject({
      phone: "+33 2 00 00 00 00",
      internal_notes: `${label} contact notes`,
      updated_by: fixture.staff.id,
      affiliation_id: legacy.affiliation_id,
    });
    await page.goto("/opportunities/ma/firms");
    await page
      .getByPlaceholder("Search firms or offices")
      .filter({ visible: true })
      .fill(`${label}`);
    await page.screenshot({
      path: join(evidence, "ma-directory-firms-mobile.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    // Native controls accept keyboard submission with the same requiredness.
    await page.getByRole("button", { name: "Add firm", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Add M&A firm" });
    await dialog
      .getByLabel("Firm name (required)")
      .fill(`${label} Mobile Advisory`);
    await dialog.getByLabel("Office name (required)").fill("Mobile office");
    await dialog.getByLabel("City (required)").fill("Lille");
    await dialog
      .getByRole("checkbox", { name: "Add a first contact (optional)" })
      .check();
    await dialog
      .getByLabel("Last name", { exact: true })
      .fill(`${label} Mobile person`);
    await dialog.getByLabel("Phone", { exact: true }).fill("+33 3 00 00 00 00");
    await page.screenshot({
      path: join(evidence, "ma-directory-contact-mobile.png"),
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Create firm", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/opportunities\/ma\/firms\/[0-9a-f-]+$/);
    const mobileGraph = (
      await db.query<{
        firm_id: string;
        office_id: string;
        contact_id: string;
      }>(
        "SELECT f.id AS firm_id,o.id AS office_id,c.id AS contact_id FROM public.ma_firms f JOIN public.ma_offices o ON o.firm_id=f.id JOIN public.ma_contact_office_affiliations a ON a.office_id=o.id AND a.is_active JOIN public.ma_contacts c ON c.id=a.contact_id WHERE f.name=$1",
        [`${label} Mobile Advisory`],
      )
    ).rows;
    expect(mobileGraph).toHaveLength(1);
    ownedFirms.push(mobileGraph[0]!.firm_id);
    ownedOffices.push(mobileGraph[0]!.office_id);
    ownedContacts.push(mobileGraph[0]!.contact_id);
    await page.getByRole("button", { name: "Add office", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Add operating office" });
    await dialog.getByLabel("Office name (required)").fill(`${label} Mobile second office`);
    await dialog.getByLabel("City (required)").fill("Nantes");
    await page.screenshot({ path: join(evidence, "ma-firm-add-office-mobile.png"), fullPage: true });
    await dialog.getByRole("button", { name: "Add office", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const mobileOffice = (await db.query<{ id: string }>("SELECT id FROM public.ma_offices WHERE firm_id=$1 AND name=$2", [mobileGraph[0]!.firm_id, `${label} Mobile second office`])).rows;
    expect(mobileOffice).toHaveLength(1);
    ownedOffices.push(mobileOffice[0]!.id);
    await page.reload();
    await expect(
      page.getByRole("link", { name: `${label} Mobile second office`, exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: join(evidence, "ma-firm-second-office-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(
      (await db.query("SELECT count(*)::int AS count FROM public.email_logs"))
        .rows[0].count,
    ).toBe(emailBefore);
    expect(
      (
        await db.query(
          "SELECT id,campaign_email_suppressed,campaign_email_suppression_reason FROM public.ma_contacts WHERE id=ANY($1::uuid[]) ORDER BY id",
          [[fixture.ids.realContact, fixture.ids.demoContact]],
        )
      ).rows,
    ).toEqual(suppressionBefore);
    const portal = await browser.newContext();
    try {
      const portalPage = await portal.newPage();
      await signInMaFixture(
        portalPage,
        fixture.repreneurs.real.email,
        password!,
        "repreneur",
      );
      await portalPage.goto("/opportunities/ma/firms");
      await expect(
        portalPage.getByRole("button", { name: "Add firm", exact: true }),
      ).not.toBeVisible();
      await expect(portalPage).toHaveURL(/\/portal\//);
    } finally {
      await portal.close();
    }
  } finally {
    try {
      if (ownedFirms.length || ownedOffices.length || ownedContacts.length) {
        const proof = await captureMaDirectoryProof(db, {
          runId,
          firms: ownedFirms,
          offices: ownedOffices,
          contacts: ownedContacts,
        });
        expect((await cleanupMaDirectoryProof(db, proof)).committed).toBe(
          false,
        );
        expect(
          (await cleanupMaDirectoryProof(db, proof, { commit: true }))
            .remaining,
        ).toBe(0);
      }
      // Clear only endpoint buckets first created by this disposable journey.
      await db.query(
        `DELETE FROM public."rateLimit" WHERE ("key" LIKE '%|/sign-in/email' OR "key" LIKE 'auth:/api/auth/sign-in/email:%') AND NOT ("key"=ANY($1::text[]))`,
        [originalBuckets],
      );
    } finally {
      await db.end();
    }
  }
});
