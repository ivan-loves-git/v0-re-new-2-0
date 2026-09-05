import { describe, expect, it } from "vitest"
import { fingerprintResendDeliveryRequest, type ResendDeliveryRequest } from "@/lib/email/resend-delivery-outcome"
import { assertPursuitEmailSize, RESEND_ATTACHMENT_LIMIT_BYTES } from "@/lib/pursuit-handoff-attachments"

const request: ResendDeliveryRequest = { from: "sender@re-new.invalid", to: ["recipient@re-new.invalid"], subject: "NDA", html: "<p>NDA</p>", text: "NDA" }
describe("event-scoped pursuit delivery contract", () => {
  it("deduplicates one event but preserves a later identical qualification request", () => {
    const first = fingerprintResendDeliveryRequest(request, "e4:validation-1")
    expect(fingerprintResendDeliveryRequest({ ...request }, "e4:validation-1")).toBe(first)
    expect(fingerprintResendDeliveryRequest(request, "e4:validation-2")).not.toBe(first)
    expect(fingerprintResendDeliveryRequest(request)).not.toBe(first)
  })
  it("fingerprints actual attachment bytes and names rather than a supplied hash", () => {
    const pdf = { filename: "signed.pdf", content: Buffer.from("%PDF-one"), contentType: "application/pdf" }
    const original = fingerprintResendDeliveryRequest({ ...request, attachments: [pdf] }, "e7:gate")
    expect(fingerprintResendDeliveryRequest({ ...request, attachments: [{ ...pdf, content: Buffer.from("%PDF-two") }] }, "e7:gate")).not.toBe(original)
    expect(fingerprintResendDeliveryRequest({ ...request, attachments: [{ ...pdf, filename: "different.pdf" }] }, "e7:gate")).not.toBe(original)
  })
  it("includes MIME and message overhead when preflighting the provider limit", () => {
    const below = { ...request, attachments: [{ filename: "small.pdf", content: Buffer.from("%PDF-small"), contentType: "application/pdf" }] }
    expect(assertPursuitEmailSize(below)).toBeLessThan(RESEND_ATTACHMENT_LIMIT_BYTES)
    const nearlyFull = Buffer.alloc(Math.floor(RESEND_ATTACHMENT_LIMIT_BYTES * 3 / 4))
    expect(() => assertPursuitEmailSize({ ...request, attachments: [{ filename: "too-large.pdf", content: nearlyFull, contentType: "application/pdf" }] })).toThrow("encoded message limit")
  })
})
