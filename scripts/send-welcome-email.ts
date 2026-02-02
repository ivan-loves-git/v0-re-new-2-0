/**
 * Welcome email with credentials
 *
 * CATEGORY: Ivan's triggered emails
 * These emails are NOT automated. Ivan must explicitly ask Claude to send them.
 *
 * WORKFLOW:
 * 1. Claude always sends test email to ivanpaudice@me.com first
 * 2. Ivan reviews the test email
 * 3. Only after Ivan confirms, Claude sends to the full team
 *
 * Usage:
 *   Test (single):  npx tsx scripts/send-welcome-email.ts [email] [name]
 *   Full team:      npx tsx scripts/send-welcome-email.ts --team
 */

import { Resend } from "resend"
import { FOUNDERS_TEAM_2_0 } from "../lib/distribution-lists"

const resend = new Resend(process.env.RESEND_API_KEY)

const PLATFORM_URL = "https://app.re-new.team"
const PASSWORD = "Wave2025!"

function createWelcomeEmail(name: string, email: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #334155; background: #f8fafc; margin: 0; padding: 40px 20px; }
    .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; }
    .logo { margin-bottom: 32px; }
    .logo img { height: 24px; }
    .greeting { color: #0f172a; font-size: 17px; font-weight: 600; margin: 0 0 12px 0; }
    .intro { color: #64748b; font-size: 14px; margin: 0 0 24px 0; line-height: 1.6; }
    .divider { color: #cbd5e1; font-size: 16px; text-align: center; margin: 24px 0; letter-spacing: 8px; }
    .secret-box { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .secret-title { color: #92400e; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; }
    .credential { margin: 8px 0; }
    .credential-label { color: #64748b; font-size: 12px; margin: 0; }
    .credential-value { color: #0f172a; font-size: 15px; font-weight: 500; margin: 2px 0 0 0; font-family: ui-monospace, monospace; }
    .warning { color: #92400e; font-size: 12px; margin: 16px 0 0 0; font-style: italic; }
    .cta { display: inline-block; background: #3b82f6; color: white; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; margin: 24px 0; }
    .signature { padding-top: 24px; }
    .sig-line { color: #64748b; font-size: 13px; margin: 0 0 12px 0; font-style: italic; }
    .sig-name { color: #0f172a; font-size: 13px; font-weight: 600; margin: 0 0 2px 0; }
    .sig-title { color: #64748b; font-size: 12px; margin: 0 0 2px 0; }
    .sig-team { color: #64748b; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="https://cdn.prod.website-files.com/68a87ebceebd6aec9fa8d6b3/68b6fe358d32a837b0522d9a_Logo.svg" alt="Re-New">
    </div>

    <p class="greeting">Hey ${name} 👋</p>
    <p class="intro">Welcome to Wave, the Re-New internal platform. Your account is ready and waiting. Here are your super-secret credentials that you should probably memorize and then eat this email. Just kidding. But maybe don't share it on LinkedIn.</p>

    <p class="divider">•••</p>

    <div class="secret-box">
      <p class="secret-title">🔐 Top Secret Credentials</p>
      <div class="credential">
        <p class="credential-label">Platform</p>
        <p class="credential-value">${PLATFORM_URL}</p>
      </div>
      <div class="credential">
        <p class="credential-label">Email</p>
        <p class="credential-value">${email}</p>
      </div>
      <div class="credential">
        <p class="credential-label">Password</p>
        <p class="credential-value">${PASSWORD}</p>
      </div>
      <p class="warning">⚠️ This password is shared for initial access. Feel free to keep it or use "Forgot Password" to set your own.</p>
    </div>

    <a href="${PLATFORM_URL}/auth/login" class="cta">Access Wave →</a>

    <p class="divider">•••</p>

    <div class="signature">
      <p class="sig-line">Your inbox is safe with me. For now.</p>
      <p class="sig-name">Wavy 🌊</p>
      <p class="sig-title">Chief Notification Officer</p>
      <p class="sig-team">Re-New team</p>
    </div>
  </div>
</body>
</html>
`
}

async function sendWelcomeEmail(to: string, name: string) {
  console.log(`Sending welcome email to ${name} <${to}>...`)

  try {
    const { data, error } = await resend.emails.send({
      from: "Wavy 🌊 <notifications@news.re-new.team>",
      to: [to],
      subject: "🔐 Your Wave credentials (handle with care)",
      html: createWelcomeEmail(name, to),
    })

    if (error) {
      console.error("Error sending email:", error)
      return false
    }

    console.log("Email sent successfully!", data)
    return true
  } catch (err) {
    console.error("Failed to send email:", err)
    return false
  }
}

async function sendToTeam() {
  console.log(`\nSending welcome emails to ${FOUNDERS_TEAM_2_0.contacts.length} team members...\n`)

  for (const contact of FOUNDERS_TEAM_2_0.contacts) {
    const firstName = contact.name.split(" ")[0]
    await sendWelcomeEmail(contact.email, firstName)
    // Small delay between emails
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`\nDone! Sent to ${FOUNDERS_TEAM_2_0.contacts.length} recipients.`)
}

// Usage:
// Single recipient: npx tsx scripts/send-welcome-email.ts [email] [name]
// Full team:        npx tsx scripts/send-welcome-email.ts --team
const args = process.argv.slice(2)

if (args[0] === "--team") {
  sendToTeam()
} else {
  const recipient = args[0] || "ivanpaudice@me.com"
  const name = args[1] || "Ivan"
  sendWelcomeEmail(recipient, name)
}
