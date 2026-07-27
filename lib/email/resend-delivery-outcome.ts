import { createHash } from "node:crypto"

const CONCLUSIVE_REJECTION_NAMES = new Set([
  "missing_required_field",
  "invalid_idempotency_key",
  "invalid_access",
  "invalid_parameter",
  "invalid_region",
  "missing_api_key",
  "invalid_api_Key",
  "invalid_from_address",
  "validation_error",
  "not_found",
  "method_not_allowed",
])

interface ResendDeliveryResponse {
  data: { id?: string | null } | null
  error: { name: string; message: string } | null
}

export interface ResendDeliveryRequest {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
}

export type ResendDeliveryOutcome =
  | { outcome: "sent"; providerMessageId: string }
  | { outcome: "failed"; error: string }
  | { outcome: "pending"; error: string }

export function classifyResendDeliveryOutcome(
  response: ResendDeliveryResponse,
): ResendDeliveryOutcome {
  const providerMessageId = response.data?.id?.trim()
  if (!response.error && providerMessageId) {
    return { outcome: "sent", providerMessageId }
  }

  if (response.error && CONCLUSIVE_REJECTION_NAMES.has(response.error.name)) {
    return { outcome: "failed", error: response.error.message }
  }

  return {
    outcome: "pending",
    error:
      response.error?.message ??
      "The provider response did not include conclusive delivery evidence.",
  }
}

export function fingerprintResendDeliveryRequest(
  request: ResendDeliveryRequest,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        from: request.from,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
      }),
    )
    .digest("hex")
}
