import { expect, test, type Page } from "@playwright/test"
import { Client } from "pg"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { OPENING_READINESS_FIXTURE as fixture } from "../../lib/opening-readiness-fixture"

const databaseUrl = process.env.OPENING_FIXTURE_DATABASE_URL,
  password = process.env.OPENING_FIXTURE_PASSWORD,
  runnerTemp = process.env.RUNNER_TEMP
if (
  !databaseUrl ||
  !password ||
  !runnerTemp ||
  process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_MAIL_MODE !== "allowlist" ||
  process.env.RESEND_API_KEY
)
  throw new Error(
    "Email operations proof requires the protected disposable CI stack and fictional provider sink.",
  )
test.use({ timezoneId: "Europe/Paris" })
async function login(page: Page, email: string) {
  await page.goto("/auth/login")
  await page.getByRole("button", { name: "English", exact: true }).click()
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password!)
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  await expect(page).toHaveURL(/\/(dashboard_re|portal\/deals)/, { timeout: 30000 })
}
async function prepare(page: Page) {
  await page.goto("/emails?tab=send")
  await page.getByPlaceholder("Name or email...").fill(fixture.repreneurs.real.email)
  await page.getByRole("button").filter({ hasText: fixture.repreneurs.real.email }).click()
  await page.getByRole("combobox").click()
  await page.getByRole("option").filter({ hasText: "Registration confirmation" }).click()
  await page.getByRole("button", { name: "Prepare for review", exact: true }).click()
  await expect(
    page.getByText("Draft prepared for Review & send. No email was sent.", { exact: true }),
  ).toBeVisible()
}
test("complete staff business review, history and analytics retain actual outcomes on desktop and mobile", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000)
  const db = new Client({ connectionString: databaseUrl })
  await db.connect()
  const original = await db.query(
    "SELECT subject,body_markdown,is_active,auto_send FROM public.email_templates WHERE template_key='welcome'",
  )
  const evidenceDirectory = join(runnerTemp!, "opening-readiness-evidence")
  await mkdir(evidenceDirectory, { recursive: true })
  try {
    await db.query(
      "UPDATE public.email_templates SET is_active=true,auto_send=false WHERE template_key='welcome'",
    )
    await login(page, fixture.staff.email)
    await page.goto("/emails")
    const tabs = page.locator('.email-operations-tabs [role="tab"]')
    await expect(tabs).toHaveText([
      "Review & send",
      "History",
      "Templates",
      "Manual Send",
      "Analytics",
    ])
    await page.getByRole("tab", { name: "Templates", exact: true }).click()
    await expect(
      page.getByRole("switch", { name: "Auto-send: Registration confirmation", exact: true }),
    ).not.toBeChecked()
    await expect(
      page.getByRole("switch", { name: "Active locked: Access and password setup", exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole("switch", { name: "Active locked: Password reset", exact: true }),
    ).toBeDisabled()
    await expect(page.getByText("Legacy first contact", { exact: true })).toBeVisible()
    await expect(page.getByText("E7 signed copies", { exact: true })).toBeVisible()
    await prepare(page)
    const prepared = await db.query<{ id: string; body_text: string }>(
      "SELECT id,body_text FROM public.staff_email_reviews WHERE source_kind='business' AND template_key='welcome' AND repreneur_id=$1 AND source_context->>'kind'='manual' ORDER BY created_at DESC LIMIT 1",
      [fixture.ids.realRepreneur],
    )
    expect(prepared.rows).toHaveLength(1)
    const review = prepared.rows[0]!
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM public.email_logs WHERE idempotency_key=(SELECT business_operation_key FROM public.staff_email_reviews WHERE id=$1)",
          [review.id],
        )
      ).rows[0].count,
    ).toBe(0)
    // Future-only policy changes through the actual staff control never drain this old draft.
    await page.goto("/emails?tab=templates")
    const auto = page.getByRole("switch", {
      name: "Auto-send: Registration confirmation",
      exact: true,
    })
    await auto.click()
    await expect(auto).toBeChecked()
    expect(
      (await db.query("SELECT state FROM public.staff_email_reviews WHERE id=$1", [review.id]))
        .rows[0].state,
    ).toBe("pending")
    await auto.click()
    await expect(auto).not.toBeChecked()
    await page.goto(`/emails/review/${review.id}`)
    const subject = "QA 247 PERSONAL WORDS — SYNTHETIC"
    await page.getByRole("textbox", { name: "Subject", exact: true }).fill(subject)
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(`${review.body_text}\n\nQA individual addition — fictional.`)
    await page.getByRole("button", { name: "Save reviewed text", exact: true }).click()
    await expect
      .poll(
        async () =>
          (
            await db.query("SELECT subject FROM public.staff_email_reviews WHERE id=$1", [
              review.id,
            ])
          ).rows[0].subject,
      )
      .toBe(subject)
    // Reusable edits occur through the saved catalogue action; individual words stay retained.
    await page.goto("/emails?tab=templates")
    await page
      .locator("#template-welcome")
      .getByRole("button", { name: "Voir le contenu", exact: true })
      .click()
    await page.getByRole("dialog").locator("#subject").fill("QA 247 NEW GENERAL COPY — SYNTHETIC")
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
    await expect(page.getByText("Modifications enregistrées.", { exact: true })).toBeVisible()
    await page.goto(`/emails/review/${review.id}`)
    await page
      .locator("summary")
      .filter({ hasText: /^More details$/ })
      .click()
    await expect(page.getByText("Template updated", { exact: true })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Subject", exact: true })).toHaveValue(subject)
    await page.getByRole("button", { name: "Send", exact: true }).click()
    const confirm = page.getByRole("dialog", { name: "Confirm send", exact: true })
    await expect(confirm).toContainText(subject)
    await confirm
      .getByRole("checkbox", { name: "Acknowledge complete message", exact: true })
      .check()
    await confirm.getByRole("button", { name: "Send", exact: true }).click()
    await expect(page.getByText("Accepted by provider", { exact: true })).toBeVisible()
    const accepted = (
      await db.query(
        "SELECT state,provider_message_id,provider_cc,body_text FROM public.staff_email_reviews WHERE id=$1",
        [review.id],
      )
    ).rows[0]
    expect(accepted.state).toBe("sent")
    expect(accepted.provider_message_id).toMatch(/^qa-/)
    expect(accepted.provider_cc).toEqual([
      "qa-opening-staff@re-new.invalid",
      "qa-opening-real-non-owner@re-new.invalid",
    ])
    expect(accepted.body_text).toContain("QA individual addition")
    await db.query(
      "SELECT public.email_provider_record_event('qa-247-delivered',$1,'email.delivered',now(),'primary',NULL)",
      [accepted.provider_message_id],
    )
    await db.query(
      "SELECT public.email_provider_record_event('qa-247-copy-bounce',$1,'email.bounced',now(),'copy','Synthetic copy failure')",
      [accepted.provider_message_id],
    )
    await db.query(
      "SELECT public.email_provider_record_event('qa-247-copy-bounce',$1,'email.bounced',now(),'copy','Synthetic copy failure')",
      [accepted.provider_message_id],
    )
    expect(
      (
        await db.query(
          "SELECT status,delivered,bounced FROM public.email_operations_history WHERE provider_message_id=$1",
          [accepted.provider_message_id],
        )
      ).rows,
    ).toEqual([{ status: "delivered", delivered: true, bounced: false }])
    await db.query(
      `INSERT INTO public.email_logs(repreneur_id,template_key,to_email,subject,status,resend_id,sent_at)
   SELECT $1,'welcome',$2,CASE WHEN n=151 THEN 'QA 247 OLDER SEARCH RECEIPT — SYNTHETIC' ELSE 'QA 247 HISTORY '||n||' — SYNTHETIC' END,'sent','qa-247-history-'||n,now()-n*interval '1 hour' FROM generate_series(1,151)n`,
      [fixture.ids.realRepreneur, fixture.repreneurs.real.email],
    )
    await page.goto("/emails?reviewFilter=sent")
    await expect(
      page.getByText("Sent · latest 150 accepted messages", { exact: true }),
    ).toBeVisible()
    expect(await page.locator("tbody tr").count()).toBe(150)
    await page.screenshot({ path: join(evidenceDirectory, "email-247-sent-desktop.png") })
    await page.getByRole("tab", { name: "History", exact: true }).click()
    await page
      .getByRole("textbox", { name: "Search all email history", exact: true })
      .fill("OLDER SEARCH RECEIPT")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "QA 247 OLDER SEARCH RECEIPT — SYNTHETIC", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "QA 247 OLDER SEARCH RECEIPT — SYNTHETIC", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toContainText("Historical body unavailable")
    await page.keyboard.press("Escape")
    await page.getByRole("textbox", { name: "Search all email history", exact: true }).fill(subject)
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await page.getByRole("button", { name: subject, exact: true }).click()
    await expect(page.getByRole("dialog")).toContainText("QA individual addition")
    await expect(page.getByRole("dialog")).toContainText("staff/copy recipient")
    await page.screenshot({
      path: join(evidenceDirectory, "email-247-history-desktop.png"),
      fullPage: true,
    })
    await page.keyboard.press("Escape")
    await page.getByRole("tab", { name: "Analytics", exact: true }).click()
    await expect(page.getByText("Not measured", { exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole("figure", { name: "Accepted messages by business category", exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: join(evidenceDirectory, "email-247-analytics-desktop.png"),
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: join(evidenceDirectory, "email-247-analytics-mobile.png"),
      fullPage: true,
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.goto("/emails?tab=templates")
    const shownAuto = page.getByRole("switch", {
      name: "Auto-send: Registration confirmation",
      exact: true,
    })
    await shownAuto.click()
    await expect(shownAuto).toBeChecked()
    await expect(
      page.getByRole("switch", { name: "Active: Registration confirmation", exact: true }),
    ).toBeChecked()
    await page.screenshot({
      path: join(evidenceDirectory, "email-247-templates-mobile.png"),
      fullPage: true,
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    const unauth = await browser.newContext(),
      anon = await unauth.newPage()
    await anon.goto("/emails")
    await expect(anon).toHaveURL(/\/auth\/login/)
    await unauth.close()
    const repContext = await browser.newContext(),
      rep = await repContext.newPage()
    await login(rep, fixture.repreneurs.real.email)
    await rep.goto("/emails")
    await expect(rep.getByRole("heading", { name: "Email operations", exact: true })).toHaveCount(0)
    await repContext.close()
  } finally {
    const previous = original.rows[0]
    if (previous)
      await db.query(
        "UPDATE public.email_templates SET subject=$1,body_markdown=$2,is_active=$3,auto_send=$4 WHERE template_key='welcome'",
        [previous.subject, previous.body_markdown, previous.is_active, previous.auto_send],
      )
    await db.end()
  }
})
