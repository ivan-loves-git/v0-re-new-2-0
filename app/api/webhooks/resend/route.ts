import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { env } from "@/lib/env"
import { startCriticalOperation } from "@/lib/observability/critical-operation"
import { Webhook } from "svix"
import { resolveResendWebhookUpdate, type ResendWebhookEventType } from "@/lib/email/resend-webhook-transition"

// Resend webhook event types
type ResendEventType = ResendWebhookEventType

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
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
  secret: string
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
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      )
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
    const supabase = createAdminClient()

    // Find the email log by resend_id
    const { data: emailLog, error: fetchError } = await supabase
      .from("email_logs")
      .select("id, status")
      .eq("resend_id", event.data.email_id)
      .single()

    if (fetchError || !emailLog) {
      // Email not found in our logs - might be from before we started tracking
      trace.failure("not_found")
      return NextResponse.json({ message: "Email not tracked" })
    }

    const updates = resolveResendWebhookUpdate(emailLog.status, event.type, event.created_at)
    if (!updates) {
      trace.success()
      return NextResponse.json({ message: "Webhook already finalized", event: event.type })
    }

    // Update the email log
    const { error: updateError } = await supabase
      .from("email_logs")
      .update(updates)
      .eq("id", emailLog.id)

    if (updateError) {
      trace.failure("persistence_failed")
      return NextResponse.json(
        { error: "Failed to update" },
        { status: 500 }
      )
    }

    trace.success()
    return NextResponse.json({
      message: "Webhook processed",
      event: event.type,
      email_id: event.data.email_id,
    })
  } catch {
    trace.failure("internal_error")
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Handle Resend webhook verification (GET request)
export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint active" })
}
