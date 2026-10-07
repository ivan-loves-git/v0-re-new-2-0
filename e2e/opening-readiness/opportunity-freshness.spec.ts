import { expect, test, type Page } from "@playwright/test"
import { Client } from "pg"
import { OPENING_READINESS_FIXTURE } from "../../lib/opening-readiness-fixture"
import { dismissNotifications } from "../helpers/dismiss-notifications"

const fixture = OPENING_READINESS_FIXTURE
const databaseUrl = process.env.OPENING_FIXTURE_DATABASE_URL
const password = process.env.OPENING_FIXTURE_PASSWORD
const cronSecret = process.env.CRON_SECRET
const contactId = "93000000-0000-4000-8000-0000000000b1"
const affiliationId = "93000000-0000-4000-8000-0000000000b2"
const opportunityA = "93000000-0000-4000-8000-0000000000b3"
const opportunityB = "93000000-0000-4000-8000-0000000000b4"
const linkA = "93000000-0000-4000-8000-0000000000b5"
const linkB = "93000000-0000-4000-8000-0000000000b6"
const recipient = "qa-opening-fresh-access-uat@re-new.invalid"

if (!databaseUrl || !password || !cronSecret || process.env.CI !== "true" ||
  process.env.GITHUB_ACTIONS !== "true" || process.env.QA_FIXTURE_MODE !== "local" ||
  process.env.QA_CONTRACT_MODE !== "protected" || process.env.QA_MAIL_MODE !== "allowlist" ||
  process.env.RESEND_API_KEY) {
  throw new Error("Freshness browser proof requires the disposable protected CI stack without provider credentials.")
}

test.use({ timezoneId: "Europe/Paris" })

async function readyReviewQueue(page: Page) {
  const display = page.getByRole("region", { name: "Staff email review queue", exact: true })
    .getByRole("button", { name: "Display", exact: true })
  const density = page.getByText("Row density", { exact: true })
  // Visible server markup alone does not prove the queue's client interactions.
  await expect(async () => {
    if (!(await density.isVisible())) await display.click()
    expect(await density.isVisible()).toBe(true)
  }).toPass({ timeout: 15_000 })
  await page.keyboard.press("Escape")
  await expect(density).toBeHidden()
}

test("staff can review one generated contact group on desktop/mobile; non-staff cannot open its rule", async ({ page, browser, request }) => {
  test.setTimeout(180_000)
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    // This fixed local CI database is destroyed after the suite. The synthetic
    // contact uses a QA allowlisted address, never a real intermediary. The
    // fixture has one deliberately legacy null-precision active row; seed it
    // as retained historical data, then exercise every current guard normally.
    await client.query("BEGIN")
    await client.query("SET LOCAL session_replication_role = replica")
    await client.query(`INSERT INTO public.ma_contacts(id,first_name,last_name,display_name,status,email,created_by)
      VALUES($1,'QA Freshness','Contact','QA Freshness Contact','active',$2,$3)`, [contactId,recipient,fixture.staff.id])
    await client.query(`INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,created_by)
      VALUES($1,$2,$3,true,$4)`, [affiliationId,contactId,fixture.ids.realOffice,fixture.staff.id])
    await client.query(`INSERT INTO public.opportunities(
      id,reference,status,source_office_id,description,public_title,teaser_summary,sector,location,
      revenue_meur,ebitda_keur,headcount,repreneur_exposure,is_demo,date_added,date_added_precision,created_by
    ) VALUES
      ($1,'QA-FRESH-A','active',$3,'QA freshness only','QA FRESHNESS A — SYNTHETIC','QA only','Tech & Digital','France',25,3000,80,'anonymized',false,current_date-60,'day',$4),
      ($2,'QA-FRESH-B','active',$3,'QA freshness only','QA FRESHNESS B — SYNTHETIC','QA only','Tech & Digital','France',25,3000,80,'anonymized',false,current_date-180,NULL,$4)`,
      [opportunityA,opportunityB,fixture.ids.realOffice,fixture.staff.id])
    await client.query(`INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,is_primary,is_active,linked_by)
      VALUES($1,$2,$5,true,true,$6),($3,$4,$5,true,true,$6)`,
      [linkA,opportunityA,linkB,opportunityB,affiliationId,fixture.staff.id])
    await client.query(`INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_markdown,body_editable)
      VALUES('ma_opportunity_validity_check','Vérification {opportunityTitle}','Synthetic freshness QA',false,false,
        'Bonjour {firstName},\\n\\nPouvez-vous confirmer {opportunityTitle} ?',true)
      ON CONFLICT(template_key) DO UPDATE SET subject=excluded.subject,body_markdown=excluded.body_markdown,
        body_editable=true,is_active=false`)
    await client.query("COMMIT")

    const deniedCron = await request.get("/api/cron/opportunity-freshness")
    expect(deniedCron.status()).toBe(401)
    const prepared = await request.get("/api/cron/opportunity-freshness", { headers: { authorization: `Bearer ${cronSecret}` } })
    expect(prepared.status()).toBe(200)
    expect((await prepared.json()).prepared).toBeGreaterThanOrEqual(1)
    const grouped = await client.query<{ id: string; count: number; body_text: string }>(`
      SELECT review.id,count(member.opportunity_id)::int AS count,review.body_text
      FROM public.staff_email_reviews review
      JOIN public.opportunity_freshness_members member ON member.review_id=review.id
      WHERE review.source_kind='freshness' AND review.recipient_email=$1
      GROUP BY review.id`, [recipient])
    expect(grouped.rows).toHaveLength(1)
    expect(grouped.rows[0]).toMatchObject({ count: 2 })
    expect(grouped.rows[0]!.body_text).toContain("QA-FRESH-A")
    expect(grouped.rows[0]!.body_text).toContain("QA-FRESH-B")
    const reviewId = grouped.rows[0]!.id

    const anonymous = await browser.newContext()
    const anonymousPage = await anonymous.newPage()
    await anonymousPage.goto("http://127.0.0.1:3000/emails/automations/opportunity-freshness")
    await expect(anonymousPage).toHaveURL(/\/auth\/login/)
    await anonymous.close()

    // Earlier fixture journeys consume the local sign-in budget. Reset only
    // those ephemeral rate-limit keys, then exercise the real sign-in route.
    await client.query(`DELETE FROM public."rateLimit" WHERE "key" LIKE '%|/sign-in/email'
      OR "key" LIKE 'auth:/api/auth/sign-in/email:%'`)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto("/auth/login")
    await page.getByRole("button", { name: "English", exact: true }).click()
    await page.locator("#email").fill(fixture.staff.email)
    await page.locator("#password").fill(password!)
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard_re/)
    await page.goto("/emails?reviewFilter=active")
    const reviewRow = page.getByRole("row").filter({
      has: page.locator(`a[href="/emails/review/${reviewId}"]`),
    })
    await expect(reviewRow.getByText("Source freshness", { exact: true })).toBeVisible()
    await readyReviewQueue(page)
    await reviewRow.getByRole("link", { name: "Review", exact: true }).click()
    const reviewSheet = page.getByRole("dialog", { name: "Review message", exact: true })
    await expect(reviewSheet).toBeVisible()
    await expect(reviewSheet.getByRole("button", { name: "Send", exact: true })).toBeDisabled()
    await reviewSheet.locator("summary").filter({ hasText: /^More details$/ }).click()
    await expect(reviewSheet.getByText("Catalogue template disabled or unavailable", { exact: true })).toBeVisible()
    await expect(reviewSheet.getByText("QA-FRESH-A", { exact: false }).first()).toBeVisible()
    await expect(reviewSheet.getByText("QA-FRESH-B", { exact: false }).first()).toBeVisible()
    await reviewSheet.getByRole("link", { name: "View the internal 45-day rule" }).click()
    await expect(page.getByRole("heading", { name: "Opportunity freshness" })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/emails/review/${reviewId}`)
    const directReview = page.locator("#main-content:visible")
    await expect(directReview.getByRole("heading", { name: "Review message", exact: true })).toBeVisible()
    await directReview.locator("summary").filter({ hasText: /^More details$/ }).click()
    await expect(directReview.getByRole("link", { name: "View the internal 45-day rule" })).toBeVisible()
    const sendButton = directReview.getByRole("button", { name: "Send", exact: true })
    await expect(sendButton).toBeDisabled()
    const sendBox = await sendButton.boundingBox()
    expect(sendBox && sendBox.x + sendBox.width).toBeLessThanOrEqual(390)

    await client.query("UPDATE public.email_templates SET is_active=true WHERE template_key='ma_opportunity_validity_check'")
    await page.reload()
    // Cached inactive route markup is not the current interactive editor.
    const body = page.locator("#review-body:visible")
    await expect(body).toHaveCount(1)
    await expect(body).toBeEditable()
    const reviewedBody = (await body.inputValue()) + "\nSynthetic QA group check."
    await body.fill(reviewedBody)
    await page.getByRole("button", { name: "Save reviewed text" }).click()
    await expect(page.getByText("Review text saved.", { exact: false })).toBeVisible()
    await page.reload()
    await expect(body).toHaveValue(reviewedBody)
    const reviewedSubject = await directReview.getByRole("textbox", { name: "Subject", exact: true }).inputValue()
    await dismissNotifications(page)
    await sendButton.click()
    const confirmation = page.getByRole("dialog", { name: "Confirm send", exact: true })
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toContainText(reviewedSubject)
    await expect(confirmation).toContainText(reviewedBody)
    const confirmSend = confirmation.getByRole("button", { name: "Send", exact: true })
    await expect(confirmSend).toBeDisabled()
    await confirmation.getByRole("checkbox", { name: "Acknowledge complete message", exact: true }).check()
    await expect(confirmSend).toBeEnabled()
    await confirmSend.click()
    // Sending advances the saved version and can remount away the confirmation.
    await expect(directReview.getByText("Accepted by provider", { exact: true })).toBeVisible()
    await page.reload()
    await expect(directReview.getByText("Accepted by provider", { exact: true })).toBeVisible()
    await expect(directReview.getByRole("textbox", { name: "Subject", exact: true })).toHaveValue(reviewedSubject)
    await expect(body).toHaveValue(reviewedBody)
    await expect(sendButton).toBeDisabled()
    await directReview.locator("summary").filter({ hasText: /^More details$/ }).click()
    const publicReceipt = directReview.locator('[data-slot="alert-description"]:visible')
      .filter({ hasText: /Provider receipt qa-/ })
    await expect(publicReceipt).toContainText("Sent means accepted by the provider, not delivered or read.")
    const receipt = await client.query<{ provider_message_id: string; members: number }>(`
      SELECT delivery.provider_message_id,count(member.opportunity_id)::int AS members
      FROM public.opportunity_freshness_deliveries delivery
      JOIN public.opportunity_freshness_members member ON member.review_id=delivery.review_id
      WHERE delivery.review_id=$1 GROUP BY delivery.provider_message_id`, [reviewId])
    expect(receipt.rows).toEqual([{ provider_message_id: expect.stringMatching(/^qa-/), members: 2 }])
    const fakeSingleSends = await client.query<{ count: number }>(`
      SELECT count(*)::int AS count FROM public.ma_interactions
      WHERE opportunity_id IN ($1,$2) AND template_key='ma_opportunity_validity_check'`, [opportunityA,opportunityB])
    expect(fakeSingleSends.rows[0]?.count).toBe(0)
  } finally {
    await client.end()
  }
})
