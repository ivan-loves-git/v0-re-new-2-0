import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { verifyPassword } from "better-auth/crypto"
import { Client } from "pg"
import { assertOpeningReadinessFixtureEnvironment, OPENING_READINESS_FIXTURE as fixture } from "../../lib/opening-readiness-fixture"

const { databaseUrl } = assertOpeningReadinessFixtureEnvironment(process.env)
const runnerTemp = process.env.RUNNER_TEMP
if (!runnerTemp) throw new Error("Pause notification proof requires the protected fixture artifact directory")
const opportunityId = "26000000-0000-4000-8000-000000000301"
const interestedMatch = "26000000-0000-4000-8000-000000000302"
const pursuitMatch = "26000000-0000-4000-8000-000000000303"
const queuedOpportunityId = "26000000-0000-4000-8000-000000000401"
const queuedMatchId = "26000000-0000-4000-8000-000000000402"
const title = "QA PAUSE NOTICE — SYNTHETIC"

test("staff pause automatically sends only the public reason to both affected cohorts", async ({ page }) => {
  test.setTimeout(180_000)
  const db = new Client({ connectionString: databaseUrl.toString() })
  await db.connect()
  try {
    // Initial synthetic relationship states, matching the protected paused-history fixture.
    // The positive pause below goes through the real authenticated product action.
    await db.query("BEGIN")
    await db.query("SET LOCAL session_replication_role=replica")
    await db.query(`INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,public_title,description,created_by)
      VALUES($1,'QA-PAUSE-PRIVATE-REFERENCE','active',false,$2,$3,'PRIVATE SOURCE CONTEXT',$4)`,
      [opportunityId, fixture.ids.realOffice, title, fixture.authIds.staffUser])
    await db.query(`INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
      VALUES($1,$2,'Synthetic source',true,$3)`, [opportunityId, fixture.ids.realAffiliation, fixture.authIds.staffUser])
    await db.query(`INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,pursuit_stage,created_by)
      VALUES($1,$2,$3,'interested',null,$4),($5,$2,$6,'active_pursuit','interest',$4)`,
      [interestedMatch, opportunityId, fixture.ids.realRepreneur, fixture.authIds.staffUser, pursuitMatch, fixture.ids.realNonOwnerRepreneur])
    await db.query(`INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,public_title,created_by)
      VALUES($1,'QA-PAUSE-QUEUE-REFERENCE','active',false,$2,'QA QUEUED PAUSE — SYNTHETIC',$3)`,
      [queuedOpportunityId, fixture.ids.realOffice, fixture.authIds.staffUser])
    await db.query(`INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
      VALUES($1,$2,'Synthetic source',true,$3)`, [queuedOpportunityId, fixture.ids.realAffiliation, fixture.authIds.staffUser])
    await db.query(`INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
      VALUES($1,$2,$3,'interested',$4)`, [queuedMatchId, queuedOpportunityId, fixture.ids.realRepreneur, fixture.authIds.staffUser])
    await db.query("COMMIT")

    const hash = (await db.query<{ password: string }>(`SELECT password FROM public."account" WHERE "userId"=$1 AND "providerId"='credential'`, [fixture.authIds.staffUser])).rows[0]?.password
    let loginPassword: string | undefined
    if (!hash || !process.env.OPENING_FIXTURE_PASSWORD) throw new Error("Protected fixture login unavailable")
    for (const candidate of [process.env.OPENING_FIXTURE_PASSWORD, `${process.env.OPENING_FIXTURE_PASSWORD}-reset`]) {
      if (await verifyPassword({ hash, password: candidate })) loginPassword = candidate
    }
    if (!loginPassword) throw new Error("Protected fixture credential changed unexpectedly")
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.221" })
    await page.goto("/auth/login")
    await page.getByRole("button", { name: "English", exact: true }).click()
    await page.locator("#email").fill(fixture.staff.email)
    await page.locator("#password").fill(loginPassword)
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard_re/)
    await page.goto(`/opportunities/${opportunityId}`)
    await page.locator("#opportunity-pause-reason").filter({ visible: true }).click()
    await page.getByRole("option", { name: "Other", exact: true }).click()
    await page.locator("#opportunity-pause-note").filter({ visible: true }).fill("PRIVATE STAFF EXPLANATION MUST NEVER BE EMAILED")
    await page.getByRole("button", { name: "Pause opportunity", exact: true }).click()

    const receipts = () => db.query<{ recipient_email: string; body_text: string; state: string; provider_message_id: string; business_operation_key: string }>(
      `SELECT recipient_email,body_text,state,provider_message_id,business_operation_key FROM public.staff_email_reviews
       WHERE template_key='opportunity_paused' AND business_match_id=ANY($1::uuid[]) ORDER BY recipient_email`, [[interestedMatch, pursuitMatch]])
    await expect.poll(async () => (await receipts()).rows.filter(row => row.state === "sent").length, { timeout: 45_000 }).toBe(2)
    const original = (await receipts()).rows
    expect(original.map(row => row.recipient_email).sort()).toEqual([fixture.repreneurs.real.email, fixture.repreneurs.realNonOwner.email].sort())
    for (const row of original) {
      expect(row.provider_message_id).toMatch(/^qa-/)
      expect(row.business_operation_key).toMatch(/^opportunity-pause:/)
      expect(row.body_text).toContain(title)
      expect(row.body_text).toContain("Autre motif de suspension")
      expect(row.body_text).not.toMatch(/PRIVATE|QA-PAUSE-PRIVATE-REFERENCE|reason_note/)
    }
    const historicalNote = (await db.query<{ reason_note: string }>("SELECT reason_note FROM public.opportunity_pause_history WHERE opportunity_id=$1", [opportunityId])).rows[0]
    expect(historicalNote?.reason_note).toBe("PRIVATE STAFF EXPLANATION MUST NEVER BE EMAILED")
    for (let retry = 0; retry < 2; retry++) {
      const response = await page.request.get("/api/cron/opportunity-pause-notifications", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
      expect(response.status()).toBe(200)
    }
    expect((await receipts()).rows).toEqual(original)
    expect((await page.request.get("/api/cron/opportunity-pause-notifications")).status()).toBe(401)

    await page.goto("/emails?tab=templates")
    await page.getByRole("tab", { name: "Templates", exact: true }).click()
    await expect(page.getByRole("switch", { name: "Auto-send: Opportunity paused", exact: true })).toBeChecked()
    const row = page.getByRole("heading", { name: "Opportunity paused", exact: true }).locator("..").locator("..").locator("..")
    await row.getByRole("button", { name: "Voir le contenu", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "Opportunity paused", exact: true })).toBeVisible()
    await expect(page.frameLocator('iframe[title="Email preview"]').getByText("Une exclusivité a été accordée à un autre acquéreur", { exact: false })).toBeVisible()
    const directory = join(runnerTemp, "opening-readiness-evidence")
    await mkdir(directory, { recursive: true })
    await page.screenshot({ path: join(directory, "pause-email-template-desktop.png"), animations: "disabled" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: join(directory, "pause-email-template-mobile.png"), animations: "disabled" })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    // Policy changes apply to future operations. The actual staff toggle must not
    // silently send an existing pause draft when Auto-send is turned back on.
    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 1440, height: 1000 })
    const autoSend = page.getByRole("switch", { name: "Auto-send: Opportunity paused", exact: true })
    await autoSend.click()
    await expect(autoSend).not.toBeChecked()
    await expect.poll(async () => (await db.query("SELECT auto_send FROM public.email_templates WHERE template_key='opportunity_paused'")).rows[0]?.auto_send).toBe(false)
    await page.goto(`/opportunities/${queuedOpportunityId}`)
    await page.locator("#opportunity-pause-reason").filter({ visible: true }).click()
    await page.getByRole("option", { name: "Paused by cabinet", exact: true }).click()
    await page.getByRole("button", { name: "Pause opportunity", exact: true }).click()
    const queuedReceipt = () => db.query<{ id: string; state: string; provider_message_id: string | null; body_text: string }>(
      "SELECT id,state,provider_message_id,body_text FROM public.staff_email_reviews WHERE template_key='opportunity_paused' AND business_match_id=$1", [queuedMatchId])
    await expect.poll(async () => (await queuedReceipt()).rows.length).toBe(1)
    const queued = (await queuedReceipt()).rows[0]
    if (!queued) throw new Error("Pause notification did not prepare its review draft")
    expect(queued.state).toBe("pending")
    expect(queued.provider_message_id).toBeNull()
    expect(queued.body_text).toContain("Mise en pause par le cabinet")
    await page.goto("/emails?tab=templates")
    await page.getByRole("tab", { name: "Templates", exact: true }).click()
    await autoSend.click()
    await expect(autoSend).toBeChecked()
    const recovery = await page.request.get("/api/cron/opportunity-pause-notifications", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    expect(recovery.status()).toBe(200)
    expect((await queuedReceipt()).rows).toEqual([queued])

    // Sending that draft remains an explicit review action, bound to the same pause.
    await page.goto(`/emails/review/${queued.id}`)
    await page.getByRole("button", { name: "Send", exact: true }).click()
    const confirmation = page.getByRole("dialog", { name: "Confirm send", exact: true })
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole("checkbox", { name: "Acknowledge complete message", exact: true }).check()
    await confirmation.getByRole("button", { name: "Send", exact: true }).click()
    await expect.poll(async () => (await queuedReceipt()).rows[0]?.state).toBe("sent")
    expect((await queuedReceipt()).rows[0]?.provider_message_id).toMatch(/^qa-/)
    // Immutable synthetic pause evidence is retained until the protected stack is destroyed.
  } finally {
    await db.query("ROLLBACK")
    await db.query("SELECT public.email_policy_set('opportunity_paused',true,$1)", [fixture.authIds.staffUser])
    await db.end()
  }
})
