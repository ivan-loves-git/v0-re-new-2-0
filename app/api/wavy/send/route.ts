import { NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { resend, FROM_EMAIL, FROM_NAME } from "@/lib/email/resend-client"
import { isMaContactEmailAddressSuppressed } from "@/lib/email/ma-contact-email-authorization"
import { createAdminClient } from "@/lib/supabase/admin"

interface SendRequest {
  to: string
  subject: string
  body: string
  repreneurId?: string
  testRecipient?: string
}

export async function POST(request: Request) {
  const access = await getCurrentUserAccess()
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (access.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body: SendRequest = await request.json()
    const { to, subject, body: emailBody, repreneurId, testRecipient } = body

    // Validate required fields
    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      )
    }

    // Determine actual recipient (test mode overrides)
    const actualRecipient = testRecipient || to

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(actualRecipient)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    if (await isMaContactEmailAddressSuppressed(actualRecipient)) {
      return NextResponse.json(
        {
          error:
            "Email blocked because this contact has opted out of campaign and general outreach.",
        },
        { status: 403 },
      )
    }

    // Convert plain text body to simple HTML
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    p {
      margin: 0 0 16px 0;
    }
  </style>
</head>
<body>
  ${emailBody.split('\n\n').map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n  ')}
</body>
</html>
`

    // Prefix subject in test mode so recipient knows who it's for
    const actualSubject = testRecipient
      ? `[TEST pour ${to}] ${subject}`
      : subject

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [actualRecipient],
      subject: actualSubject,
      html: htmlBody,
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Log the activity if we have a repreneur ID (skip logging in test mode)
    if (repreneurId && !testRecipient) {
      const supabase = createAdminClient()

      // Add an activity record
      await supabase.from("activities").insert({
        repreneur_id: repreneurId,
        activity_type: "email_sent",
        description: `Email sent via Wavy: "${subject}"`,
        metadata: {
          to,
          subject,
          resend_id: data?.id,
          sent_by: access.user.email,
        },
      })

      // Also add a note for visibility
      await supabase.from("notes").insert({
        repreneur_id: repreneurId,
        content: `[Email envoyé via Wavy]\n\nSujet: ${subject}\n\n${emailBody.substring(0, 500)}${emailBody.length > 500 ? '...' : ''}`,
        created_by: access.user.email,
        note_type: "email",
      })
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
    })
  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    )
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
