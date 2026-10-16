import { afterEach, beforeEach, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({ database: vi.fn(), send: vi.fn(), suppressed: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: boundary.database }))
vi.mock("@/lib/email/resend-client", () => ({
  resend: { emails: { send: boundary.send } }, FROM_EMAIL: "qa@example.test", FROM_NAME: "QA",
}))
vi.mock("@/lib/email/ma-contact-email-authorization", () => ({
  isMaContactEmailAddressSuppressed: boundary.suppressed,
}))
vi.mock("@/lib/env", () => ({ env: { RENEW_STAFF_NOTIFICATION_EMAIL: "staff@example.test" } }))

import { dispatchBusinessReview } from "@/lib/email/business-source-dispatch"
import { sendLockedOpportunityInterestEmail } from "@/lib/email/locked-opportunity-interest"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"

const input = {
  matchId: "97000000-0000-4000-8000-000000000081",
  expressedAt: "2026-10-07T10:00:00.123Z", idempotencyKey: "direct-interest-exact-episode",
  repreneurId: "97000000-0000-4000-8000-000000000004", repreneurName: "QA Person",
  repreneurEmail: "qa@example.test", opportunityId: "97000000-0000-4000-8000-000000000071",
  opportunityReference: "SYNTHETIC", opportunityTitle: "QA opportunity", hasOtherActivePursuit: false,
}

function fixture() {
  const review: StaffEmailReview = {
    id: "97000000-0000-4000-8000-000000000091", source_kind: "business",
    source_operation_id: "97000000-0000-4000-8000-000000000092",
    opportunity_id: input.opportunityId, match_id: null, upstream_evidence_id: null, contact_link_id: null,
    template_key: "locked_opportunity_interest", recipient_email: "staff@example.test",
    template_version: "qa-copy-version", attachment_snapshot: [], version: 1,
    subject: "Individually reviewed subject", body_text: "Individually reviewed words",
    retained_html: "<p>Individually reviewed words</p>", state: "sending", namespace: "REAL",
    source_context: { kind: "direct_interest", input, idempotencyKey: input.idempotencyKey },
    provider_message_id: null, delivery_evidence_id: null, delivery_error: null,
    prepared_policy: { auto_send: false, version: 1 },
    archived_at: null, archived_by: null, restored_at: null, restored_by: null,
    created_by: "system", created_at: input.expressedAt, edited_by: null, edited_at: null,
    approved_by: "qa-staff", approved_at: input.expressedAt, attempted_at: null, outcome_at: null,
    cancelled_by: null, cancelled_at: null, cancel_reason: null,
  }
  const match = {
    id: input.matchId, repreneur_id: input.repreneurId, opportunity_id: input.opportunityId,
    status: "interested", interest_expressed_at: input.expressedAt,
    interest_notification_sent_at: null as string | null,
  }
  const notice = { status: "pending", provider_message_id: null as string | null }
  let current = true
  const database = {
    from(table: string) {
      const equals: Record<string, unknown> = {}
      let updates: Record<string, unknown> | null = null
      const query = {
        select() { return query },
        eq(key: string, value: unknown) { equals[key] = value; return query },
        in() { return query },
        is() { return query },
        update(value: Record<string, unknown>) { updates = value; return query },
        async maybeSingle() {
          if (table === "staff_email_reviews") return { data: review, error: null }
          if (table === "opportunity_interest_direct_notices") return { data: notice, error: null }
          if (table === "opportunity_matches") {
            if (updates) {
              const exact = Object.entries(equals).every(([key, value]) => match[key as keyof typeof match] === value)
              if (!exact) return { data: null, error: null }
              Object.assign(match, updates)
            }
            return { data: match, error: null }
          }
          throw new Error(`Unexpected external table ${table}`)
        },
      }
      return query
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "email_business_prepare") {
        review.state = "pending"
        return { data: review, error: null }
      }
      if (name === "w192_begin_direct_interest_notice") return { data: current, error: null }
      if (name === "w192_complete_direct_interest_notice") {
        notice.status = String(args.p_outcome)
        notice.provider_message_id = args.p_provider_message_id as string | null
        return { data: args.p_outcome, error: null }
      }
      if (name === "email_business_finish") {
        review.state = args.p_state as StaffEmailReview["state"]
        review.provider_message_id = args.p_provider_id as string | null
        return { data: null, error: null }
      }
      if (name === "email_review_capture_envelope") return { data: null, error: null }
      if (name === "email_business_authorize_attempt") return { data: true, error: null }
      throw new Error(`Unexpected external RPC ${name}`)
    },
  }
  boundary.database.mockReturnValue(database)
  return { review, match, notice, withdrawBeforeAttempt: () => { current = false } }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("QA_MAIL_MODE", "allowlist")
  vi.stubEnv("QA_BUSINESS_STAFF_CC", "copy-one@example.test,copy-two@example.test")
  boundary.suppressed.mockResolvedValue(false)
  boundary.send.mockResolvedValue({ data: { id: "qa-exact-reviewed-receipt" }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

it("records the exact source sent clock after staff-reviewed provider acceptance", async () => {
  const state = fixture()
  expect(state.match.interest_notification_sent_at).toBeNull()
  await expect(dispatchBusinessReview(state.review, "exact-token", "qa-staff"))
    .resolves.toMatchObject({ success: true, state: "sent" })
  expect(state.notice).toEqual({ status: "sent", provider_message_id: "qa-exact-reviewed-receipt" })
  expect(state.match.interest_notification_sent_at).toEqual(expect.any(String))
  expect(boundary.send).toHaveBeenCalledWith(expect.objectContaining({
    subject: "Individually reviewed subject", text: "Individually reviewed words",
  }), { idempotencyKey: input.idempotencyKey })
})

it("keeps a newly prepared review queued without accepting or consuming the source clock", async () => {
  const state = fixture()
  await expect(sendLockedOpportunityInterestEmail(input))
    .resolves.toMatchObject({ success: false, queued: true })
  expect(state.review.state).toBe("pending")
  expect(state.match.interest_notification_sent_at).toBeNull()
  expect(state.notice).toEqual({ status: "pending", provider_message_id: null })
  expect(boundary.send).not.toHaveBeenCalled()
})

it("does not consume the source clock when withdrawal wins before provider I/O", async () => {
  const state = fixture()
  state.withdrawBeforeAttempt()
  await expect(dispatchBusinessReview(state.review, "exact-token", "qa-staff"))
    .resolves.toMatchObject({ success: false, state: "failed" })
  expect(state.match.interest_notification_sent_at).toBeNull()
  expect(boundary.send).not.toHaveBeenCalled()
})

it.each([
  { result: { data: null, error: null }, state: "uncertain" },
  { result: { data: null, error: { message: "Synthetic rejection" } }, state: "failed" },
])("does not consume the source clock for a $state provider outcome", async outcome => {
  const state = fixture()
  boundary.send.mockResolvedValue(outcome.result)
  await expect(dispatchBusinessReview(state.review, "exact-token", "qa-staff"))
    .resolves.toMatchObject({ success: false, state: outcome.state })
  expect(state.match.interest_notification_sent_at).toBeNull()
})

it("does not attach an older accepted receipt's clock to a newly expressed interest", async () => {
  const state = fixture()
  boundary.send.mockImplementation(async () => {
    state.match.interest_expressed_at = "2026-10-07T11:00:00.123Z"
    return { data: { id: "qa-exact-reviewed-receipt" }, error: null }
  })
  await expect(dispatchBusinessReview(state.review, "exact-token", "qa-staff"))
    .resolves.toMatchObject({ success: true, state: "sent" })
  expect(state.notice.provider_message_id).toBe("qa-exact-reviewed-receipt")
  expect(state.match.interest_notification_sent_at).toBeNull()
  expect(boundary.send).toHaveBeenCalledOnce()
})
