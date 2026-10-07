import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { env } from "@/lib/env"
import { startCriticalOperation } from "@/lib/observability/critical-operation"
import { Webhook } from "svix"
import { type ResendWebhookEventType } from "@/lib/email/resend-webhook-transition"

// Resend webhook event types
type ResendEventType = ResendWebhookEventType

interface ResendWebhookPayload {
  type: ResendEventType | "email.delivery_delayed" | "email.failed" | "email.suppressed"
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    tags?: Record<string, string>
    bounce?: { message?: string }
    failed?: { reason?: string }
    suppressed?: { type?: string; message?: string }
  }
}

// Verify webhook signature from Resend
function verifyWebhookSignature(
  payload: string,
  headers: {
    id: string | null
    timestamp: string | null
    signature: string | null
  },
  secret: string,
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false

  try {
    new Webhook(secret).verify(payload, {
      "svix-id": headers.id,
      "svix-timestamp": headers.timestamp,
      "svix-signature": headers.signature,
    })
    return true
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const trace = startCriticalOperation("email.resend_webhook")
  try {
    const webhookSecret = env.RESEND_WEBHOOK_SECRET

    // Signature verification is mandatory
    if (!webhookSecret) {
      trace.failure("configuration_error")
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
    }

    const payload = await request.text()
    if (
      !verifyWebhookSignature(
        payload,
        {
          id: request.headers.get("svix-id"),
          timestamp: request.headers.get("svix-timestamp"),
          signature: request.headers.get("svix-signature"),
        },
        webhookSecret,
      )
    ) {
      trace.failure("signature_invalid")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const event: ResendWebhookPayload = JSON.parse(payload)
    const supported = [
      "email.sent",
      "email.delivered",
      "email.opened",
      "email.clicked",
      "email.bounced",
      "email.complained",
      "email.delivery_delayed",
      "email.failed",
      "email.suppressed",
    ]
    if (!supported.includes(event.type))
      return NextResponse.json({ message: "Unsupported event ignored" })
    if (
      !event.data ||
      typeof event.data.email_id !== "string" ||
      !Array.isArray(event.data.to) ||
      !Number.isFinite(Date.parse(event.created_at))
    ) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 })
    }
    const supabase = createAdminClient()
    const { data: message, error: fetchError } = await supabase
      .from("email_operations_history")
      .select("recipient_email,cc")
      .eq("provider_message_id", event.data.email_id)
      .maybeSingle()
    if (fetchError) {
      trace.failure("persistence_failed")
      return NextResponse.json({ error: "Correlation unavailable" }, { status: 500 })
    }
    if (!message) {
      // New business requests carry a constant provider tag. Retry after the
      // exact receipt commits; access and unrelated events are acknowledged
      // without content or orphan retention and cannot disable measurement.
      if (event.data.tags?.renew_mail_class === "business") {
        trace.failure("persistence_failed")
        return NextResponse.json(
          { error: "Business receipt not yet available; retry event" },
          { status: 503 },
        )
      }
      trace.success()
      return NextResponse.json({ message: "Unowned event acknowledged without retention" })
    }
    const recipients = event.data.to
      .filter((value) => typeof value === "string")
      .map((value) => value.trim().toLowerCase())
    // A single-recipient provider event may describe a staff copy. Never let
    // that copy's failure replace primary-recipient delivery facts.
    const primary = String(message?.recipient_email ?? "")
      .trim()
      .toLowerCase()
    const copies = (Array.isArray(message?.cc) ? message.cc : []).map((value) =>
      String(value).trim().toLowerCase(),
    )
    const activity = event.type === "email.opened" || event.type === "email.clicked"
    const recipientKind = activity
      ? "unknown"
      : recipients.length === 1 && recipients[0] === primary
        ? "primary"
        : recipients.length === 1 && copies.includes(recipients[0])
          ? "copy"
          : "unknown"
    const reason =
      event.data.bounce?.message ??
      event.data.failed?.reason ??
      event.data.suppressed?.message ??
      event.data.suppressed?.type ??
      null
    const { error: updateError } = await supabase.rpc("email_provider_record_event", {
      p_id: request.headers.get("svix-id"),
      p_provider_id: event.data.email_id,
      p_type: event.type,
      p_occurred_at: event.created_at,
      p_recipient_kind: recipientKind,
      p_reason: typeof reason === "string" ? reason.slice(0, 500) : null,
      p_recipient: !activity && recipients.length === 1 ? recipients[0] : null,
    })
    if (updateError) {
      trace.failure("persistence_failed")
      return NextResponse.json({ error: "Failed to retain event" }, { status: 500 })
    }

    trace.success()
    return NextResponse.json({
      message: "Webhook processed",
      event: event.type,
      email_id: event.data.email_id,
    })
  } catch {
    trace.failure("internal_error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Handle Resend webhook verification (GET request)
export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint active" })
}
