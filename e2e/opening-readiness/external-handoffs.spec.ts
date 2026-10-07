import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { Client } from "pg"
import { assertOpeningReadinessFixtureEnvironment, OPENING_READINESS_FIXTURE } from "../../lib/opening-readiness-fixture"
import { test } from "./external-staff-session"
import { seedCurrentExternalLdc } from "./seed-external-ldc"
import { seedActiveOpeningOpportunity } from "./seed-active-opportunity"

const fixture = OPENING_READINESS_FIXTURE
const password = process.env.OPENING_FIXTURE_PASSWORD
const runnerTemp = process.env.RUNNER_TEMP
if (!password || !runnerTemp || process.env.CI !== "true" || process.env.GITHUB_ACTIONS !== "true"
  || process.env.QA_FIXTURE_MODE !== "local" || process.env.QA_CONTRACT_MODE !== "protected"
  || process.env.QA_MAIL_MODE !== "allowlist" || process.env.RESEND_API_KEY) {
  throw new Error("External handoff UI proof requires the protected disposable GitHub fixture.")
}
const { databaseUrl } = assertOpeningReadinessFixtureEnvironment(process.env)
const opportunityId = "25400000-0000-4000-8000-000000000021"
const matchId = "25400000-0000-4000-8000-000000000031"

test("staff records external E4/E6 through the actual localized desktop/mobile dialog without sending", async ({ page, externalStaffSession }) => {
  test.setTimeout(180_000)
  const db = new Client({ connectionString: databaseUrl.toString() })
  await db.connect()
  const { rows: [priorJourney] } = await db.query<{ enabled: boolean }>("SELECT enabled FROM public.wave_journey_settings WHERE singleton")
  try {
    // Only this isolated disposable dossier is seeded. Every new handoff and
    // document validation below uses the actual authenticated staff UI.
    await db.query("UPDATE public.wave_journey_settings SET enabled=true WHERE singleton")
    await seedActiveOpeningOpportunity(db, { opportunityId, reference: "QA-254-EXTERNAL",
      title: "QA EXTERNAL HANDOFF — SYNTHETIC", description: "Synthetic disposable handoff proof" })
    await db.query(`INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
      VALUES($1,$2,$3,'interested',$4)`, [matchId, opportunityId, fixture.ids.realNonOwnerRepreneur, fixture.authIds.staffUser])
    await db.query("SELECT public.journey_start_pursuit($1,$2,$3)", [matchId, fixture.staff.email, "qa-254-cycle"])
    const currentLdc = await seedCurrentExternalLdc(db, fixture.ids.realNonOwnerRepreneur)
    await page.context().addCookies(externalStaffSession.cookies)
    await page.goto("/dashboard_re")
    await expect(page).toHaveURL(/\/dashboard_re/)
    await page.goto(`/opportunities/${opportunityId}?tab=pursuit`)
    const evidenceDirectory = join(runnerTemp!, "opening-readiness-evidence")
    await mkdir(evidenceDirectory, { recursive: true })
    for (const [size, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height })
      for (const language of ["en", "fr"] as const) {
        await page.getByRole("button", { name: /^(Record as done outside WAVE|Enregistrer comme réalisé hors WAVE)$/ }).click()
        const dialog = page.getByRole("dialog")
        await dialog.getByRole("button", { name: language === "en" ? "English" : "Français", exact: true }).click()
        const heading = dialog.getByRole("heading", { name: language === "en" ? "Record a completed external exchange" : "Enregistrer un échange externe terminé" })
        await expect(heading).toBeVisible()
        await expect(dialog.locator("[data-external-ldc-version]").getByText(currentLdc.fileName, { exact: true })).toBeVisible()
        await expect(dialog.locator("[data-external-ldc-version]").getByText(language === "fr" ? "Cette attestation conserve exactement cette version de votre Lettre de cadrage." : "This attestation retains exactly this version of the Lettre de cadrage.", { exact: true })).toBeVisible()
        await expect(dialog.getByLabel(language === "en" ? "Actual exchange date" : "Date réelle de l’échange", { exact: true })).toBeVisible()
        await expect(dialog.getByLabel(language === "en" ? "Known time (optional, Paris time)" : "Heure connue (facultative, heure de Paris)", { exact: true })).toBeVisible()
        const submit = dialog.getByRole("button", { name: language === "en" ? "Record completed exchange" : "Enregistrer l’échange terminé", exact: true })
        const cancel = dialog.getByRole("button", { name: language === "en" ? "Cancel" : "Annuler", exact: true })
        await expect(submit).toBeDisabled()
        await page.evaluate(() => document.fonts.ready)
        await dialog.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        const version = dialog.locator("[data-external-ldc-version]")
        await expect(version.getByText(new RegExp(language === "fr" ? "^Version du " : "^Version from "))).toBeVisible()
        expect(await version.evaluate((element) => {
          const panel = element.getBoundingClientRect()
          return element.scrollWidth <= element.clientWidth && [...element.querySelectorAll("p")].every((paragraph) => {
            const range = document.createRange()
            range.selectNodeContents(paragraph)
            return [...range.getClientRects()].every((box) => box.left >= panel.left && box.right <= panel.right)
          })
        })).toBe(true)
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        if (size === "mobile") {
          await heading.scrollIntoViewIfNeeded({ timeout: 10_000 })
          await expect(heading).toBeInViewport({ ratio: 1 })
          await expect(version).toBeInViewport({ ratio: 1 })
        }
        await dialog.screenshot({ path: join(evidenceDirectory, `external-handoff-${language}-${size}.png`) })
        if (size === "mobile") {
          await submit.scrollIntoViewIfNeeded({ timeout: 10_000 })
          await expect.poll(() => dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
          await expect(submit).toBeInViewport({ ratio: 1 })
          await expect(cancel).toBeInViewport({ ratio: 1 })
          await expect(dialog.getByLabel(language === "en" ? "Meaningful reference" : "Référence explicite", { exact: true })).toBeInViewport({ ratio: 1 })
          expect(await submit.evaluate((element) => {
            const box = element.getBoundingClientRect(), range = document.createRange()
            range.selectNodeContents(element)
            return element.scrollWidth <= element.clientWidth && [...range.getClientRects()].every((text) =>
              text.left >= box.left && text.right <= box.right && text.top >= box.top && text.bottom <= box.bottom)
          })).toBe(true)
          await dialog.screenshot({ path: join(evidenceDirectory, `external-handoff-${language}-mobile-footer.png`) })
        }
        await cancel.click()
        await expect(page.getByRole("dialog")).toHaveCount(0)
      }
    }
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await page.getByRole("button", { name: /^(Record as done outside WAVE|Enregistrer comme réalisé hors WAVE)$/ }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Français", exact: true }).click()
    await dialog.getByLabel("Date réelle de l’échange", { exact: true }).fill(yesterday)
    await dialog.getByLabel("Canal", { exact: true }).selectOption("phone")
    await dialog.getByLabel("Référence explicite", { exact: true }).fill("Synthetic call requesting qualification and absent blank NDA")
    await dialog.getByRole("button", { name: "Enregistrer l’échange terminé", exact: true }).click()
    await expect(page.getByRole("button", { name: "Record intermediary qualification", exact: true })).toBeVisible()
    await expect(page.getByText("Demande de qualification réalisée hors WAVE", { exact: true })).toBeVisible()
    await expect(page.getByText(`${yesterday} · date seule · Téléphone`, { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Evidence log", exact: true })).toBeVisible()
    const e4 = await db.query("SELECT exchange_date::text,exchange_time,staff_user_id FROM public.opportunity_pursuit_external_handoffs WHERE match_id=$1 AND handoff_type='e4'", [matchId])
    expect(e4.rows).toEqual([{ exchange_date: yesterday, exchange_time: null, staff_user_id: fixture.authIds.staffUser }])
    const { rows: [retained] } = await db.query("SELECT x.id,x.context->'ldc' AS source,v.storage_path,v.content_sha256,v.size_bytes FROM public.opportunity_pursuit_external_handoffs x JOIN public.pursuit_external_ldc_receipts link ON link.receipt_id=x.id JOIN public.pursuit_ldc_versions v ON v.id=link.version_id WHERE x.match_id=$1", [matchId])
    expect(retained!.source).toMatchObject({ file_name: currentLdc.fileName, content_sha256: currentLdc.sha256, size_bytes: currentLdc.bytes.byteLength })
    const versionResponse = await page.request.get(`/api/pursuit-handoffs/${retained!.id}/ldc?download`)
    expect(versionResponse.status()).toBe(200)
    expect(versionResponse.headers()["cache-control"]).toContain("private, no-store")
    expect(createHash("sha256").update(await versionResponse.body()).digest("hex")).toBe(currentLdc.sha256)
    // Actual W165 replacement and the exact original-key remove used by an
    // already-read old worker cannot remove the private receipt version.
    await seedCurrentExternalLdc(db, fixture.ids.realNonOwnerRepreneur, 2)
    expect((await currentLdc.storage.from("cvs").remove([currentLdc.path])).error).toBeNull()
    expect((await currentLdc.storage.from("cvs").download(currentLdc.path)).data).toBeNull()
    const afterReplacement = await page.request.get(`/api/pursuit-handoffs/${retained!.id}/ldc?download`)
    expect(afterReplacement.status()).toBe(200)
    expect(createHash("sha256").update(await afterReplacement.body()).digest("hex")).toBe(currentLdc.sha256)

    await page.setViewportSize({ width: 1440, height: 1000 })
    const manifest = JSON.parse(await readFile(join(runnerTemp!, "opening-readiness-inputs", "manifest.json"), "utf8")) as { files: { blankNda: { path: string } } }
    const blank = page.getByRole("heading", { name: "Blank NDA template", exact: true }).locator("xpath=ancestor::section")
    await blank.locator("#blank_template-title").fill("QA EXTERNAL BLANK NDA — SYNTHETIC")
    await blank.locator("#blank_template-file").setInputFiles(manifest.files.blankNda.path)
    await blank.getByRole("button", { name: "Record version", exact: true }).click()
    await expect(blank.getByText("Version 1 recorded.")).toBeVisible()
    await page.getByRole("button", { name: "Record intermediary qualification", exact: true }).click()
    await expect(page.getByRole("button", { name: "Validate blank template", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "Validate blank template", exact: true }).click()
    await expect(page.getByRole("button", { name: "Pass Gate 1", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Pass Gate 1", exact: true }).click()
    await expect(page.getByRole("button", { name: "Prepare NDA-ready notice", exact: true })).toBeVisible()
    await page.getByRole("button", { name: /^(Record as done outside WAVE|Enregistrer comme réalisé hors WAVE)$/ }).click()
    dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "English", exact: true }).click()
    await dialog.getByLabel("Actual exchange date", { exact: true }).fill(yesterday)
    await dialog.getByLabel("Known time (optional, Paris time)", { exact: true }).fill("12:00")
    await dialog.getByLabel("Channel", { exact: true }).selectOption("meeting")
    await dialog.getByLabel("Meaningful reference", { exact: true }).fill("Synthetic meeting notifying the buyer that the retained NDA is ready")
    await dialog.getByRole("button", { name: "Record completed exchange", exact: true }).click()
    await expect(page.getByRole("button", { name: "Validate Re-New copy", exact: true })).toBeVisible()
    await expect(page.getByText("NDA-ready notice completed outside WAVE", { exact: true })).toBeVisible()
    await expect(page.getByText(`${yesterday} · 12:00 Europe/Paris · Meeting`, { exact: true })).toBeVisible()
    const e6 = await db.query("SELECT exchange_time::text,staff_user_id,context->'documents' AS documents FROM public.opportunity_pursuit_external_handoffs WHERE match_id=$1 AND handoff_type='e6'", [matchId])
    expect(e6.rows[0]).toMatchObject({ exchange_time: "12:00:00", staff_user_id: fixture.authIds.staffUser })
    expect(e6.rows[0].documents).toHaveLength(1)
    const { rows: [effects] } = await db.query("SELECT (SELECT count(*)::int FROM public.opportunity_pursuit_handoff_deliveries WHERE match_id=$1) AS sends,(SELECT count(*)::int FROM public.ma_interactions WHERE opportunity_id=$2) AS interactions,(SELECT count(*)::int FROM public.opportunity_pursuit_confidential_grants WHERE match_id=$1) AS grants", [matchId, opportunityId])
    expect(effects).toEqual({ sends: 0, interactions: 0, grants: 0 })
    await writeFile(join(evidenceDirectory, "external-handoffs.json"), JSON.stringify({ exactStaff: true, phaseDocuments: true, noDispatch: true, dateOnlyPreserved: true, knownTimePreserved: true, frenchEnglishDesktopMobile: true, noAccessGrant: true, currentLdcPdfVersion: true, retainedLdcAfterReplacement: true }))
  } finally {
    await db.query("UPDATE public.wave_journey_settings SET enabled=$1 WHERE singleton", [priorJourney!.enabled])
    await db.end()
  }
})
