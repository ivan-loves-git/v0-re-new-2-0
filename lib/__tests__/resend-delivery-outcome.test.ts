import { describe, expect, it } from "vitest"
import {
  classifyResendDeliveryOutcome,
  fingerprintResendDeliveryRequest,
} from "@/lib/email/resend-delivery-outcome"

describe("Resend delivery outcome classification", () => {
  it("requires a provider message ID before considering a send conclusive", () => {
    expect(
      classifyResendDeliveryOutcome({
        data: { id: "provider-message-id" },
        error: null,
      }),
    ).toEqual({
      outcome: "sent",
      providerMessageId: "provider-message-id",
    })

    expect(
      classifyResendDeliveryOutcome({ data: {}, error: null }),
    ).toMatchObject({ outcome: "pending" })
  })

  it.each(["application_error", "internal_server_error"])(
    "keeps %s provider responses pending because acceptance is ambiguous",
    (name) => {
      expect(
        classifyResendDeliveryOutcome({
          data: null,
          error: {
            name,
            message: "Unable to fetch data. The request could not be resolved.",
          },
        }),
      ).toEqual({
        outcome: "pending",
        error: "Unable to fetch data. The request could not be resolved.",
      })
    },
  )

  it.each([
    "concurrent_idempotent_requests",
    "invalid_idempotent_request",
    "rate_limit_exceeded",
    "future_unknown_error",
  ])("fails closed for the ambiguous error %s", (name) => {
    expect(
      classifyResendDeliveryOutcome({
        data: null,
        error: { name, message: "Ambiguous provider response" },
      }),
    ).toMatchObject({ outcome: "pending" })
  })

  it.each([
    "missing_required_field",
    "invalid_idempotency_key",
    "validation_error",
  ])("finalizes the conclusive provider rejection %s as failed", (name) => {
    expect(
      classifyResendDeliveryOutcome({
        data: null,
        error: { name, message: "Request rejected" },
      }),
    ).toEqual({ outcome: "failed", error: "Request rejected" })
  })

  it("fingerprints the exact provider request for safe same-key replay", () => {
    const request = {
      from: "Re-New <contact@example.test>",
      to: ["recipient@example.test"],
      subject: "Follow-up",
      html: "<p>Body</p>",
      text: "Body",
    }
    const fingerprint = fingerprintResendDeliveryRequest(request)

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(fingerprintResendDeliveryRequest({ ...request })).toBe(fingerprint)
    expect(
      fingerprintResendDeliveryRequest({ ...request, subject: "Changed" }),
    ).not.toBe(fingerprint)
  })
})
