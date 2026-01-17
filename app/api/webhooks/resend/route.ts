import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import crypto from "crypto"

// Resend webhook event types
type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained"

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
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    // Signature verification is mandatory
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured - webhook disabled")
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      )
    }

    const payload = await request.text()
    const signature = request.headers.get("resend-signature")

    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.error("Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const event: ResendWebhookPayload = JSON.parse(payload)
    const supabase = createAdminClient()

    // Map Resend event to our status
    const statusMap: Record<ResendEventType, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
    }

    const newStatus = statusMap[event.type]
    if (!newStatus) {
      return NextResponse.json({ message: "Event type not tracked" })
    }

    // Find the email log by resend_id
    const { data: emailLog, error: fetchError } = await supabase
      .from("email_logs")
      .select("id, status")
      .eq("resend_id", event.data.email_id)
      .single()

    if (fetchError || !emailLog) {
      // Email not found in our logs - might be from before we started tracking
      console.log(`Email ${event.data.email_id} not found in logs`)
      return NextResponse.json({ message: "Email not tracked" })
    }

    // Prepare updates based on event type
    const updates: Record<string, unknown> = { status: newStatus }

    switch (event.type) {
      case "email.opened":
        updates.opened_at = event.created_at
        break
      case "email.clicked":
        updates.clicked_at = event.created_at
        break
      case "email.bounced":
        updates.bounced_at = event.created_at
        break
      case "email.delivered":
        updates.delivered_at = event.created_at
        break
    }

    // Update the email log
    const { error: updateError } = await supabase
      .from("email_logs")
      .update(updates)
      .eq("id", emailLog.id)

    if (updateError) {
      console.error("Failed to update email log:", updateError)
      return NextResponse.json(
        { error: "Failed to update" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Webhook processed",
      event: event.type,
      email_id: event.data.email_id,
    })
  } catch (err) {
    console.error("Webhook processing error:", err)
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
