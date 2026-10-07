import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { OPENING_READINESS_FIXTURE as fixture } from "../../lib/opening-readiness-fixture";

const databaseUrl = process.env.OPENING_FIXTURE_DATABASE_URL;
const password = process.env.OPENING_FIXTURE_PASSWORD;
const runnerTemp = process.env.RUNNER_TEMP;
if (
  !databaseUrl ||
  !password ||
  !runnerTemp ||
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_MAIL_MODE !== "allowlist" ||
  process.env.RESEND_API_KEY
) {
  throw new Error(
    "M&A directory proof requires the protected disposable CI fixture and fictional mail sink.",
  );
}
async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard_re|portal\/deals)/, {
    timeout: 30000,
  });
}
test("staff create and complete canonical M&A profiles on desktop and mobile with persistent errors and history", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
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
    await login(page, fixture.staff.email);
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
      .fill("QA 257 Synthetic Advisory");
    await dialog.getByLabel("Office name (required)").fill("Central office");
    await dialog
      .getByRole("button", { name: "Create firm", exact: true })
      .click();
    await expect(
      dialog.getByText("Enter the operating office city.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Firm name (required)")).toHaveValue(
      "QA 257 Synthetic Advisory",
    );
    expect(
      (
        await db.query("SELECT id FROM public.ma_firms WHERE name=$1", [
          "QA 257 Synthetic Advisory",
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
      }>(
        "SELECT f.id AS firm_id,o.id AS office_id,o.city,o.is_default,f.created_by FROM public.ma_firms f JOIN public.ma_offices o ON o.firm_id=f.id WHERE f.name=$1",
        ["QA 257 Synthetic Advisory"],
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
        name: "QA 257 Synthetic Advisory",
        exact: true,
      }),
    ).toBeVisible();

    // Adding another office retains the released active-firm eligibility rule.
    await page.goto(`/opportunities/ma/firms/${fixture.ids.realFirm}`);
    await page.getByRole("button", { name: "Add office", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Add operating office" });
    await dialog
      .getByLabel("Office name (required)")
      .fill("QA 257 North office");
    await dialog
      .getByRole("button", { name: "Add office", exact: true })
      .click();
    await expect(dialog.getByLabel("Office name (required)")).toHaveValue(
      "QA 257 North office",
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
        [fixture.ids.realFirm, "QA 257 North office"],
      )
    ).rows;
    expect(addedOffice).toHaveLength(1);
    ownedOffices.push(addedOffice[0]!.id);
    expect(addedOffice[0]!.city).toBe("Lille");

    await page.goto("/opportunities/ma/contacts");
    await page
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Add office contact" });
    await dialog.getByRole("combobox").click();
    await page
      .getByRole("option")
      .filter({ hasText: "QA 257 Synthetic Advisory" })
      .click();
    await dialog
      .getByLabel("First name", { exact: true })
      .fill("QA 257 Phone person");
    await dialog
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    await expect(
      dialog.getByText("Add an email address or phone number.").first(),
    ).toBeVisible();
    await expect(dialog.getByLabel("First name", { exact: true })).toHaveValue(
      "QA 257 Phone person",
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
        "Firm and office: QA 257 Synthetic Advisory · Central office",
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
        `WITH f AS (INSERT INTO public.ma_firms(name,created_by) VALUES ('QA 257 Legacy Advisory','fixture-257') RETURNING id), o AS (INSERT INTO public.ma_offices(firm_id,name,created_by) SELECT id,'Legacy office','fixture-257' FROM f RETURNING id,firm_id), c AS (INSERT INTO public.ma_contacts(first_name,created_by) VALUES ('QA 257 Legacy person','fixture-257') RETURNING id), a AS (INSERT INTO public.ma_contact_office_affiliations(contact_id,office_id,created_by) SELECT c.id,o.id,'fixture-257' FROM c,o RETURNING id,contact_id,office_id) SELECT o.firm_id,o.id AS office_id,a.contact_id,a.id AS affiliation_id FROM o,a`,
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
      .fill("QA 257 notes retained after error");
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
    ).toHaveValue("QA 257 notes retained after error");
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
    await page.getByLabel("City (required to save this office)").fill("Paris");
    await page.getByRole("button", { name: "Save notes", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Edit notes", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("QA 257 notes retained after error", { exact: true }),
    ).toBeVisible();
    await page.goto("/opportunities/ma/contacts");
    await page
      .getByPlaceholder("Search contacts, email or office")
      .fill("QA 257 Legacy person");
    await page
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Edit contact details" });
    await dialog
      .getByLabel("Internal notes", { exact: true })
      .fill("QA 257 contact notes");
    await dialog
      .getByRole("button", { name: "Save correction", exact: true })
      .click();
    await expect(
      dialog.getByText("Add an email address or phone number.").first(),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("Internal notes", { exact: true }),
    ).toHaveValue("QA 257 contact notes");
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
      internal_notes: "QA 257 contact notes",
      updated_by: fixture.staff.id,
      affiliation_id: legacy.affiliation_id,
    });
    await page.goto("/opportunities/ma/firms");
    await page.getByPlaceholder("Search firms or offices").fill("QA 257");
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
      .fill("QA 257 Mobile Advisory");
    await dialog.getByLabel("Office name (required)").fill("Mobile office");
    await dialog.getByLabel("City (required)").fill("Lille");
    await dialog
      .getByRole("checkbox", { name: "Add a first contact (optional)" })
      .check();
    await dialog
      .getByLabel("Last name", { exact: true })
      .fill("QA 257 Mobile person");
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
        ["QA 257 Mobile Advisory"],
      )
    ).rows;
    expect(mobileGraph).toHaveLength(1);
    ownedFirms.push(mobileGraph[0]!.firm_id);
    ownedOffices.push(mobileGraph[0]!.office_id);
    ownedContacts.push(mobileGraph[0]!.contact_id);
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
      await login(portalPage, fixture.repreneurs.real.email);
      await portalPage.goto("/opportunities/ma/firms");
      await expect(
        portalPage.getByRole("button", { name: "Add firm", exact: true }),
      ).not.toBeVisible();
      await expect(portalPage).toHaveURL(/\/portal\//);
    } finally {
      await portal.close();
    }
  } finally {
    await db.query("BEGIN");
    try {
      await db.query(
        "DELETE FROM public.ma_contact_office_affiliations WHERE contact_id=ANY($1::uuid[])",
        [ownedContacts],
      );
      await db.query(
        "DELETE FROM public.ma_contacts WHERE id=ANY($1::uuid[])",
        [ownedContacts],
      );
      await db.query("DELETE FROM public.ma_offices WHERE id=ANY($1::uuid[])", [
        ownedOffices,
      ]);
      await db.query("DELETE FROM public.ma_firms WHERE id=ANY($1::uuid[])", [
        ownedFirms,
      ]);
      await db.query("COMMIT");
      expect(
        (
          await db.query(
            "SELECT ((SELECT count(*) FROM public.ma_contacts WHERE id=ANY($1::uuid[])) + (SELECT count(*) FROM public.ma_contact_office_affiliations WHERE contact_id=ANY($1::uuid[])) + (SELECT count(*) FROM public.ma_offices WHERE id=ANY($2::uuid[])) + (SELECT count(*) FROM public.ma_firms WHERE id=ANY($3::uuid[])))::int AS remaining",
            [ownedContacts, ownedOffices, ownedFirms],
          )
        ).rows[0].remaining,
      ).toBe(0);
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
    // Clear only endpoint buckets first created by this disposable journey.
    await db.query(
      `DELETE FROM public."rateLimit" WHERE ("key" LIKE '%|/sign-in/email' OR "key" LIKE 'auth:/api/auth/sign-in/email:%') AND NOT ("key"=ANY($1::text[]))`,
      [originalBuckets],
    );
    await db.end();
  }
});
