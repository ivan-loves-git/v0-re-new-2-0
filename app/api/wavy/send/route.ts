import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { resend, FROM_EMAIL, FROM_NAME } from "@/lib/email/resend-client"
import { createAdminClient } from "@/lib/supabase/admin"

interface SendRequest {
  to: string
  subject: string
  body: string
  repreneurId?: string
}

export async function POST(request: Request) {
  // Check authentication
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check API key
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    )
  }

  try {
    const body: SendRequest = await request.json()
    const { to, subject, body: emailBody, repreneurId } = body

    // Validate required fields
    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
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
  ${emailBody.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n  ')}
</body>
</html>
`

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html: htmlBody,
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Log the activity if we have a repreneur ID
    if (repreneurId) {
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
          sent_by: user.email,
        },
      })

      // Also add a note for visibility
      await supabase.from("notes").insert({
        repreneur_id: repreneurId,
        content: `[Email envoyé via Wavy]\n\nSujet: ${subject}\n\n${emailBody.substring(0, 500)}${emailBody.length > 500 ? '...' : ''}`,
        created_by: user.email,
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
