import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const boundary = vi.hoisted(() => ({ database: vi.fn(), staff: vi.fn(), provider: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: boundary.database }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: boundary.staff }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email/resend-client", () => ({
  resend: { emails: { send: boundary.provider } }, FROM_EMAIL: "sender@example.test", FROM_NAME: "Re-New", DAILY_EMAIL_LIMIT: 100,
}))
vi.mock("@/lib/observability/critical-operation", () => ({ startCriticalOperation: () => ({ success() {}, failure() {} }) }))

import { retryRecommendationAssignmentEmail } from "@/lib/actions/recommendation-assignment-notifications"

const matchId = "75000000-0000-4000-8000-000000000007"
const notificationId = "76000000-0000-4000-8000-000000000001"
const key = `recommendation-assignment:${notificationId}`

// The real action, claim orchestration, suppression lookup, email logger and
// sender run against a synthetic PostgREST/provider boundary, not mocked peers.
function database() {
  let claim: string | null = null
  let log: Record<string, unknown> | null = null
  const state = { eligible: true, active: true, exists: true, templateExists: true, suppressed: false, counted: 0, copyVersion: 1, email: "person@example.test" }
  return {
    state,
    client: {
      from(table: string) {
        let updates: Record<string, unknown> | null = null
        let mode = "read"
        const query = {
          select() { return query }, eq() { return query }, in() { return query },
          update(values: Record<string, unknown>) { updates = values; mode = "update"; return query },
          upsert(values: Record<string, unknown>) {
            log ??= { id: "email-log", ...values, daily_counted_at: null }; return query
          },
          async maybeSingle() {
            let data: unknown = null
            if (table === "opportunity_recommendation_assignment_notifications") data = state.exists ? { id: notificationId } : null
            if (table === "email_templates") data = state.templateExists ? { is_active: state.active, requires_consent: false } : null
            if (table === "email_daily_counts") data = { count: state.counted }
            if (table === "email_logs") {
              if (mode === "update" && log) Object.assign(log, updates)
              data = log
            }
            if (table === "opportunity_matches") data = { opportunity_id: "opportunity", repreneur_id: "repreneur" }
            return { data, error: null }
          },
          single() { return query.maybeSingle() },
        }
        return query
      },
      async rpc(name: string, args: Record<string, unknown>) {
        if (name === "claim_notification_delivery") {
          if (claim === "sent") return { data: { status: "sent" }, error: null }
          if (claim === "pending") return { data: { status: "busy" }, error: null }
          claim = "pending"
          return { data: { status: "claimed", leaseToken: "lease" }, error: null }
        }
        if (name === "complete_notification_delivery") {
          claim = args.p_succeeded ? "sent" : "failed"
          return { data: claim, error: null }
        }
        if (name === "get_recommendation_assignment_notification") return { data: state.eligible ? {
          id: notificationId, repreneur_id: "repreneur", recipient_email: state.email,
          recipient_first_name: "Synthetic", public_title: "Public <title>", teaser_summary: "Approved <script> text", copy_version: state.copyVersion,
          email_subject: "Une opportunité sélectionnée pour vous",
        } : null, error: null }
        if (name === "ma_contact_email_address_is_suppressed") return { data: state.suppressed, error: null }
        if (name === "finalize_idempotent_email_delivery") {
          if (log && !log.daily_counted_at) state.counted += 1
          Object.assign(log!, { status: "sent", resend_id: "provider-1", daily_counted_at: "counted" })
          return { data: true, error: null }
        }
        throw new Error(`Unexpected RPC ${name}`)
      },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  boundary.staff.mockResolvedValue({ user: { id: "w175-staff" } })
  boundary.provider.mockResolvedValue({ data: { id: "provider-1" }, error: null })
})

describe("staff recommendation assignment email", () => {
  it("sends one frozen safe email and rejoins its durable identity on repeat", async () => {
    const db = database()
    boundary.database.mockReturnValue(db.client)
    expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status: "sent" })
    expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status: "already_sent" })
    expect(boundary.provider).toHaveBeenCalledTimes(1)
    expect(db.state.counted).toBe(1)
    const [envelope, options] = boundary.provider.mock.calls[0]
    expect(options).toEqual({ idempotencyKey: key })
    expect(envelope.to).toEqual(["person@example.test"])
    expect(envelope).not.toHaveProperty("bcc")
    const html = renderToStaticMarkup(envelope.react)
    expect(html).toContain("Public &lt;title&gt;")
    expect(html).toContain("Approved &lt;script&gt; text")
    expect(html).not.toMatch(/<script|href=|INTERNAL|72 heures|portail/i)
  })

  it("rejects nonstaff before database or email access", async () => {
    boundary.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(retryRecommendationAssignmentEmail(matchId)).rejects.toThrow("Staff access required")
    expect(boundary.database).not.toHaveBeenCalled()
    expect(boundary.provider).not.toHaveBeenCalled()
  })

  it.each([
    ["historical/DEMO row", { exists: false }, "not_requested"],
    ["changed recipient, public content or eligibility", { eligible: false }, "blocked"],
    ["disabled template", { active: false }, "blocked"],
    ["missing template configuration", { templateExists: false }, "blocked"],
    ["unsupported frozen copy", { copyVersion: 2 }, "blocked"],
    ["invalid recipient", { email: "not-an-email" }, "blocked"],
    ["suppressed recipient", { suppressed: true }, "failed"],
  ] as const)("does not send for %s", async (_label, change, status) => {
    const db = database()
    Object.assign(db.state, change)
    boundary.database.mockReturnValue(db.client)
    expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status })
    expect(boundary.provider).not.toHaveBeenCalled()
    expect(db.state.counted).toBe(0)
  })

  it("retries a conclusive rejection with the identical envelope/key and counts only one success", async () => {
    const db = database()
    boundary.database.mockReturnValue(db.client)
    boundary.provider.mockResolvedValueOnce({ data: null, error: { message: "Synthetic provider rejection" } })
    expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status: "failed" })
    expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status: "sent" })
    expect(db.state.counted).toBe(1)
    expect(boundary.provider.mock.calls.map(call => call[1])).toEqual([{ idempotencyKey: key }, { idempotencyKey: key }])
    expect(renderToStaticMarkup(boundary.provider.mock.calls[0][0].react)).toBe(renderToStaticMarkup(boundary.provider.mock.calls[1][0].react))
  })

  it("fences a concurrent retry while the first provider request is in flight", async () => {
    const db = database()
    boundary.database.mockReturnValue(db.client)
    let finish!: (value: unknown) => void
    const deferred = new Promise(resolve => { finish = resolve })
    boundary.provider.mockReturnValueOnce(deferred)
    const first = retryRecommendationAssignmentEmail(matchId)
    await vi.waitFor(() => expect(boundary.provider).toHaveBeenCalledTimes(1))
    expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status: "busy" })
    finish({ data: { id: "provider-1" }, error: null })
    expect(await first).toMatchObject({ status: "sent" })
    expect(boundary.provider).toHaveBeenCalledTimes(1)
  })

  it("never blindly resends an uncertain provider attempt after the safe retry window", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-09-11T10:00:00Z"))
      const db = database()
      boundary.database.mockReturnValue(db.client)
      boundary.provider.mockRejectedValueOnce(new Error("Synthetic connection lost"))
      expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status: "failed" })
      vi.setSystemTime(new Date("2026-09-12T11:00:00Z"))
      expect(await retryRecommendationAssignmentEmail(matchId)).toMatchObject({ status: "failed" })
      expect(boundary.provider).toHaveBeenCalledTimes(1)
      expect(db.state.counted).toBe(0)
    } finally { vi.useRealTimers() }
  })
})
