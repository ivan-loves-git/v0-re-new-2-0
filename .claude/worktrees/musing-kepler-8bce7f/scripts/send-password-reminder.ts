#!/usr/bin/env npx tsx
/**
 * Password reminder email - tells team to use "Forgot Password" after easy-access was retired
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
 *   Test (Ivan only):  npx tsx scripts/send-password-reminder.ts --test
 *   Full team:         npx tsx scripts/send-password-reminder.ts --team
 */

import * as fs from "fs"
import * as path from "path"

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8")
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, "")
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

import { Resend } from "resend"
import { FOUNDERS_TEAM_2_0 } from "../lib/distribution-lists"

const resend = new Resend(process.env.RESEND_API_KEY)

const PLATFORM_URL = "https://app.re-new.team"

const AUTHORIZED_EMAILS = FOUNDERS_TEAM_2_0.contacts.map((c) => c.email)

function createPasswordReminderEmail(name: string, recipientEmail: string) {
  const emailListHtml = AUTHORIZED_EMAILS.map((email) => {
    const isRecipient = email.toLowerCase() === recipientEmail.toLowerCase()
    if (isRecipient) {
      return `<li style="margin: 4px 0; font-family: ui-monospace, monospace; font-size: 13px;"><strong style="color: #0f172a; background: #fef3c7; padding: 1px 6px; border-radius: 3px;">${email} (you)</strong></li>`
    }
    return `<li style="margin: 4px 0; font-family: ui-monospace, monospace; font-size: 13px; color: #64748b;">${email}</li>`
  }).join("\n")

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
    .body-text { color: #334155; font-size: 14px; margin: 0 0 16px 0; line-height: 1.6; }
    .muted { color: #64748b; }
    .divider { color: #cbd5e1; font-size: 16px; text-align: center; margin: 24px 0; letter-spacing: 8px; }
    .steps-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .steps-title { color: #0369a1; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; }
    .step { margin: 8px 0; font-size: 14px; color: #334155; }
    .step-number { color: #0369a1; font-weight: 600; }
    .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 3px; font-family: ui-monospace, monospace; font-weight: 500; }
    .email-list-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .email-list-title { color: #475569; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; }
    .email-list { list-style: none; padding: 0; margin: 0; }
    .note { color: #64748b; font-size: 13px; margin: 16px 0 0 0; font-style: italic; }
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
    <p class="body-text">The easy-access login has been retired (security upgrade &mdash; you're welcome).</p>
    <p class="body-text">To get back in, you'll need to set a personal password. Takes about 30 seconds. Here's how:</p>

    <div class="steps-box">
      <p class="steps-title">🔑 Set your password</p>
      <p class="step"><span class="step-number">1.</span> Go to <a href="${PLATFORM_URL}/auth/login" style="color: #0369a1;">${PLATFORM_URL}</a></p>
      <p class="step"><span class="step-number">2.</span> Click <strong>"Forgot password?"</strong></p>
      <p class="step"><span class="step-number">3.</span> Enter your registered email: <span class="highlight">${recipientEmail}</span></p>
      <p class="step"><span class="step-number">4.</span> Check your inbox for the reset link</p>
      <p class="step"><span class="step-number">5.</span> Set a new password (8+ characters)</p>
      <p class="step"><span class="step-number">6.</span> You're in.</p>
    </div>

    <a href="${PLATFORM_URL}/auth/forgot-password" class="cta">Reset My Password &rarr;</a>

    <p class="divider">&bull;&bull;&bull;</p>

    <div class="email-list-box">
      <p class="email-list-title">Currently authorized emails:</p>
      <ul class="email-list">
        ${emailListHtml}
      </ul>
      <p class="note">Need to add a different email? Ask Ivan &mdash; otherwise it'll land in the waitlist as a repreneur or seller request.</p>
    </div>

    <p class="divider">&bull;&bull;&bull;</p>

    <div class="signature">
      <p class="sig-line">Now if you'll excuse me, I have notifications to notify.</p>
      <p class="sig-name">Wavy 🌊</p>
      <p class="sig-title">Chief Notification Officer</p>
      <p class="sig-team">Re-New team</p>
    </div>
  </div>
</body>
</html>
`
}

async function sendPasswordReminder(to: string, name: string, registeredEmail: string) {
  console.log(`📤 Sending password reminder to ${name} <${to}>...`)

  try {
    const { data, error } = await resend.emails.send({
      from: "Wavy 🌊 <notifications@news.re-new.team>",
      to: [to],
      subject: "🔑 Quick heads-up: time to set your password",
      html: createPasswordReminderEmail(name, registeredEmail),
    })

    if (error) {
      console.error(`   ❌ Error for ${to}:`, error)
      return false
    }

    console.log(`   ✅ Sent! (Resend ID: ${data?.id})`)
    return true
  } catch (err) {
    console.error(`   ❌ Failed for ${to}:`, err)
    return false
  }
}

async function sendToTeam() {
  console.log(`\n📧 Password Reminder`)
  console.log("─".repeat(50))
  console.log(`Sending to ${FOUNDERS_TEAM_2_0.contacts.length} team members...\n`)

  let sent = 0
  let failed = 0

  for (const contact of FOUNDERS_TEAM_2_0.contacts) {
    const firstName = contact.name.split(" ")[0]
    const success = await sendPasswordReminder(contact.email, firstName, contact.email)
    if (success) sent++
    else failed++
    // 500ms delay between emails to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.log(`\n${"─".repeat(50)}`)
  console.log(`Done! ✅ ${sent} sent, ${failed ? `❌ ${failed} failed` : "0 failed"}`)
}

async function sendTest() {
  console.log(`\n📧 Password Reminder (TEST MODE)`)
  console.log("─".repeat(50))
  console.log(`Sending test to ivanpaudice@me.com...\n`)

  // Send test using Ivan's registered email for personalization
  await sendPasswordReminder("ivanpaudice@me.com", "Ivan", "ivanpaudice@icloud.com")

  console.log(`\n${"─".repeat(50)}`)
  console.log(`Test complete. Check ivanpaudice@me.com inbox.`)
}

// Main
if (!process.env.RESEND_API_KEY) {
  console.error("❌ Error: RESEND_API_KEY not found. Make sure .env.local is in the project root.")
  process.exit(1)
}

const args = process.argv.slice(2)

if (args.includes("--team")) {
  console.log("\n⚠️  Sending to ALL team members in 3 seconds... (Ctrl+C to cancel)")
  setTimeout(() => sendToTeam(), 3000)
} else if (args.includes("--test")) {
  sendTest()
} else {
  console.log(`
Usage:
  npx tsx scripts/send-password-reminder.ts --test    Send test to ivanpaudice@me.com
  npx tsx scripts/send-password-reminder.ts --team    Send to all 8 team members
`)
}
