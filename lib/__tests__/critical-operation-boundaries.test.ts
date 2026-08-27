import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
}

describe("W-113 critical operation boundaries", () => {
  it("covers each approved server workflow with a fixed operation name", () => {
    expect(source("lib/actions/opportunity-intake.ts")).toContain(
      'startCriticalOperation("opportunity.create")',
    )
    expect(source("lib/actions/opportunity-intake.ts")).toContain(
      'startCriticalOperation("opportunity.update")',
    )
    expect(source("lib/actions/opportunity-pursuit-journey.ts")).toContain(
      'startCriticalOperation("pursuit.journey_action")',
    )
    expect(source("lib/actions/opportunity-pursuit-journey.ts")).toContain(
      'startCriticalOperation("pursuit.start")',
    )
    expect(source("lib/actions/portal-pursuit-nda.ts")).toContain(
      'startCriticalOperation("pursuit.signed_nda_upload")',
    )

    expect(
      source("app/portal/deals/[matchId]/documents/[documentId]/route.ts"),
    ).toContain('startCriticalOperation("portal.memo_download")')
    expect(source("app/portal/deals/[matchId]/nda-template/route.ts")).toContain(
      'startCriticalOperation("portal.nda_template_download")',
    )
    expect(
      source(
        "app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route.ts",
      ),
    ).toContain(
      'startCriticalOperation("portal.staff_preview_memo_download")',
    )

    const email = source("lib/email/send-email.ts")
    expect(email.match(/startCriticalOperation\("email\.repreneur_send"\)/g)).toHaveLength(
      2,
    )
    expect(source("lib/auth.ts")).toContain(
      'startCriticalOperation("email.password_reset_send")',
    )
    expect(source("lib/actions/ma-workflows.ts")).toContain(
      'startCriticalOperation("email.ma_source_send")',
    )
    expect(source("lib/actions/opportunity-pursuit-journey.ts")).toContain(
      'startCriticalOperation("email.memo_notification")',
    )
    expect(source("app/api/webhooks/resend/route.ts")).toContain(
      'startCriticalOperation("email.resend_webhook")',
    )

    const cron = source("app/api/cron/abandoned-forms/route.ts")
    for (const operation of [
      "cron.abandoned_forms",
      "cron.abandoned_reminders",
      "cron.interview_reminders",
      "cron.booking_reminders",
      "cron.stale_leads",
      "cron.private_upload_cleanup",
    ]) {
      expect(cron).toContain(`startCriticalOperation("${operation}")`)
    }
  })

  it("removes known raw provider and recipient logging from critical paths", () => {
    const webhook = source("app/api/webhooks/resend/route.ts")
    expect(webhook).not.toContain("console.log")
    expect(webhook).not.toContain("console.error")

    const cron = source("app/api/cron/abandoned-forms/route.ts")
    expect(cron).not.toContain("console.log")
    expect(cron).not.toContain("console.error")
    expect(cron).not.toContain("${repreneur.email}")
    expect(cron).not.toContain("${rep.email}")
    expect(cron).not.toContain("${c.email}")
    expect(cron).not.toContain("String(err)")

    const email = source("lib/email/send-email.ts")
    expect(email).not.toContain("console.error")
    expect(email).not.toContain("console.warn")
    expect(email).not.toContain("→ ${to}")

    const auth = source("lib/auth.ts")
    expect(auth).not.toContain("console.log")
    expect(auth).not.toContain("console.error")
  })

  it("keeps redirect control flow out of confidential-download failure telemetry", () => {
    for (const path of [
      "app/portal/deals/[matchId]/documents/[documentId]/route.ts",
      "app/portal/deals/[matchId]/nda-template/route.ts",
      "app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route.ts",
    ]) {
      const route = source(path)
      expect(route).toContain('import { unstable_rethrow } from "next/navigation"')
      expect(route).toContain("unstable_rethrow(error)")
      expect(route.indexOf("unstable_rethrow(error)")).toBeLessThan(
        route.indexOf('trace.failure("internal_error")'),
      )
    }
  })
})
