import { beforeEach, describe, expect, it, vi } from "vitest"
import { PAUSE_EMAIL_BODY, PAUSE_EMAIL_SUBJECT } from "@/lib/email/opportunity-pause-copy"

const boundary = vi.hoisted(() => ({ database: vi.fn(), provider: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: boundary.database }))
vi.mock("@/lib/email/resend-client", () => ({ resend: { emails: { send: boundary.provider } }, FROM_EMAIL: "sender@example.test", FROM_NAME: "Re-New", DAILY_EMAIL_LIMIT: 100 }))
vi.mock("@/lib/observability/critical-operation", () => ({ startCriticalOperation: () => ({ success() {}, failure() {} }) }))
import { deliverOpportunityPauseNotification, runPendingOpportunityPauseNotifications } from "@/lib/email/opportunity-pause-delivery"

const id = "26000000-0000-4000-8000-000000000001"
const payload = { notificationId: id, pauseId: "26000000-0000-4000-8000-000000000002", matchId: "26000000-0000-4000-8000-000000000003",
  repreneurId: "26000000-0000-4000-8000-000000000004", recipientEmail: "buyer@example.test", firstName: "Camille", publicTitle: "Public project",
  reason: "other", subject: PAUSE_EMAIL_SUBJECT, body: PAUSE_EMAIL_BODY, reason_note: "PRIVATE STAFF NOTE" }
const key = `opportunity-pause:${id}`

// Only the database transport and provider are fictional. The real pause
// orchestration, business review policy, sender, logs and current-event fence run.
function database() {
  let claim: "pending" | "sent" | "failed" | null = null
  let log: Record<string, unknown> | null = null
  let review: Record<string, unknown> | null = null
  const preparedKeys: unknown[] = []
  const state = { autoSend: true, eligible: true, changeAtProvider: false, payloadReads: 0, counted: 0, preparedKeys }
  return { state, client: {
    from(table: string) {
      let updates: Record<string, unknown> | null = null
      const query = {
        select() { return query }, eq() { return query }, in() { return query },
        update(value: Record<string, unknown>) { updates = value; return query },
        upsert(value: Record<string, unknown>) { log ??= { id: "email-log", daily_counted_at: null, ...value }; return query },
        async maybeSingle() {
          if (table === "email_logs") { if (log && updates) Object.assign(log, updates); return { data: log, error: null } }
          if (table === "email_templates") return { data: { is_active: true, requires_consent: false }, error: null }
          if (table === "email_daily_counts") return { data: { count: state.counted }, error: null }
          return { data: null, error: null }
        },
        single() { return query.maybeSingle() },
      }
      return query
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "opportunity_pause_notification_payload") {
        state.payloadReads++
        return { data: state.eligible && !(state.changeAtProvider && state.payloadReads > 1) ? payload : null, error: null }
      }
      if (name === "pending_opportunity_pause_notifications") return { data: claim === "sent" ? [] : [{ id }], error: null }
      if (name === "claim_notification_delivery") {
        if (claim === "sent") return { data: { status: "sent" }, error: null }
        if (claim === "pending") return { data: { status: "busy" }, error: null }
        claim = "pending"
        return { data: { status: "claimed", leaseToken: "lease" }, error: null }
      }
      if (name === "complete_notification_delivery") { claim = args.p_succeeded ? "sent" : "failed"; return { data: claim, error: null } }
      if (name === "email_business_prepare") {
        state.preparedKeys.push(args.p_key)
        review ??= { id: "review-one", state: "pending", version: 1, recipient_email: args.p_recipient, template_key: args.p_template_key,
          subject: args.p_subject, body_text: args.p_body, retained_html: args.p_html, prepared_policy: { auto_send: state.autoSend, version: 1 } }
        return { data: structuredClone(review), error: null }
      }
      if (name === "email_business_reserve") { if (review) review.state = "sending"; return { data: "review-token", error: null } }
      if (name === "email_business_finish") { if (review) Object.assign(review, { state: args.p_state, provider_message_id: args.p_provider_id }); return { data: null, error: null } }
      if (name === "email_business_authorize_attempt") return { data: true, error: null }
      if (name === "email_review_capture_envelope") return { data: null, error: null }
      if (name === "ma_contact_email_address_is_suppressed") return { data: false, error: null }
      if (name === "finalize_idempotent_email_delivery") {
        if (log && !log.daily_counted_at) state.counted++
        if (log) Object.assign(log, { status: "sent", resend_id: "provider-1", daily_counted_at: "counted" })
        return { data: true, error: null }
      }
      throw new Error(`Unexpected database transport call ${name}`)
    },
  } }
}

beforeEach(() => { vi.clearAllMocks(); boundary.provider.mockResolvedValue({ data: { id: "provider-1" }, error: null }) })

describe("pause notification through the real business sender", () => {
  it("sends only public copy and rejoins one accepted operation after recovery", async () => {
    const db = database(); boundary.database.mockReturnValue(db.client)
    expect(await deliverOpportunityPauseNotification(id)).toMatchObject({ status: "sent" })
    expect(await runPendingOpportunityPauseNotifications()).toMatchObject({ sent: 0, processed: 0 })
    expect(await deliverOpportunityPauseNotification(id)).toMatchObject({ status: "already_sent" })
    expect(boundary.provider).toHaveBeenCalledTimes(1)
    expect(boundary.provider.mock.calls[0][1]).toEqual({ idempotencyKey: key })
    expect(boundary.provider.mock.calls[0][0].text).toContain("Autre motif de suspension")
    expect(boundary.provider.mock.calls[0][0].text).not.toContain("PRIVATE STAFF NOTE")
    expect(db.state.counted).toBe(1)
  })

  it("keeps an Auto-send-off draft queued when the setting is later enabled", async () => {
    const db = database(); db.state.autoSend = false; boundary.database.mockReturnValue(db.client)
    expect(await deliverOpportunityPauseNotification(id)).toMatchObject({ status: "review_required" })
    db.state.autoSend = true
    expect(await runPendingOpportunityPauseNotifications()).toMatchObject({ reviewRequired: 1, sent: 0 })
    expect(db.state.preparedKeys).toEqual([key, key])
    expect(boundary.provider).not.toHaveBeenCalled()
  })

  it.each(["rejected", "uncertain"])("retains a %s provider outcome for review instead of blindly resending", async (outcome) => {
    const db = database(); boundary.database.mockReturnValue(db.client)
    if (outcome === "rejected") boundary.provider.mockResolvedValueOnce({ data: null, error: { message: "Synthetic rejection" } })
    else boundary.provider.mockRejectedValueOnce(new Error("Synthetic connection lost"))
    expect(await deliverOpportunityPauseNotification(id)).toMatchObject({ status: "failed" })
    expect(await runPendingOpportunityPauseNotifications()).toMatchObject({ reviewRequired: 1, sent: 0 })
    expect(db.state.preparedKeys).toEqual([key, key])
    expect(boundary.provider).toHaveBeenCalledTimes(1)
    expect(db.state.counted).toBe(0)
  })

  it("rechecks current eligibility immediately before provider I/O", async () => {
    const db = database(); db.state.changeAtProvider = true; boundary.database.mockReturnValue(db.client)
    expect(await deliverOpportunityPauseNotification(id)).toMatchObject({ status: "failed" })
    expect(boundary.provider).not.toHaveBeenCalled()
  })
})
