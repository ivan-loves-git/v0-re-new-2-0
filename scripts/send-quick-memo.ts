#!/usr/bin/env npx tsx
/**
 * Send quick internal memos - simple text format, no fancy header
 *
 * Usage:
 *   npx tsx scripts/send-quick-memo.ts "Subject" "Message body"
 *   npx tsx scripts/send-quick-memo.ts "Subject" "Message" --attach /path/to/file.pdf
 *   npx tsx scripts/send-quick-memo.ts "Subject" "Message" --test
 *
 * Note: Requires RESEND_API_KEY in .env.local
 */

import { Resend } from "resend"
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

import {
  FOUNDERS_TEAM_2_0,
  getEmailsOnly,
} from "../lib/distribution-lists"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "notifications@news.re-new.team"
const FROM_NAME = "Wavy 🌊"

// Convert simple markdown to HTML
function parseMarkdown(text: string): string {
  return text
    // Convert ***text*** to bold italic
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    // Convert **text** to bold
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Convert *text* to italic
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
}

function buildQuickMemoHtml(message: string): string {
  // Detect signature block (starts with "Wavy")
  const signatureMatch = message.match(/\n\nWavy 🌊\n.*\n.*$/s)
  const bodyText = signatureMatch
    ? message.slice(0, message.indexOf("\n\nWavy 🌊"))
    : message

  // Convert paragraphs
  const bodyHtml = bodyText
    .split("\n\n")
    .map((para) => `<p style="margin: 0 0 14px 0; line-height: 1.5;">${parseMarkdown(para)}</p>`)
    .join("")

  // Always add styled signature
  const signatureHtml = `
    <div style="margin-top: 20px;">
      <p style="margin: 0 0 2px 0; font-weight: 600; font-size: 12px; color: #1f2937;">Wavy 🌊</p>
      <p style="margin: 0 0 1px 0; font-size: 11px; color: #9ca3af;">Chief Notification Officer</p>
      <p style="margin: 0; font-size: 11px; color: #9ca3af;">Re-New team</p>
    </div>
  `

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1f2937; line-height: 1.5; padding: 20px; max-width: 600px; margin: 0 auto;">
  ${bodyHtml}
  ${signatureHtml}
</body>
</html>
`
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log(`
Usage:
  npx tsx scripts/send-quick-memo.ts "Subject" "Message body"

Options:
  --test              Send only to ivanpaudice@me.com
  --attach <path>     Attach a file

Example:
  npx tsx scripts/send-quick-memo.ts "Quick update" "Here's the thing..." --test
`)
    process.exit(1)
  }

  const subject = args[0]
  const message = args[1]

  if (!process.env.RESEND_API_KEY) {
    console.error("Error: RESEND_API_KEY not found in .env.local")
    process.exit(1)
  }

  // Parse --attach flag
  const attachIndex = args.indexOf("--attach")
  let attachmentPath: string | null = null
  if (attachIndex !== -1 && args[attachIndex + 1]) {
    attachmentPath = args[attachIndex + 1]
    if (attachmentPath.startsWith("~")) {
      attachmentPath = attachmentPath.replace("~", process.env.HOME || "")
    }
    if (!fs.existsSync(attachmentPath)) {
      console.error(`Error: Attachment file not found: ${attachmentPath}`)
      process.exit(1)
    }
  }

  const recipients = getEmailsOnly(FOUNDERS_TEAM_2_0)
  const isTest = args.includes("--test")
  const finalRecipients = isTest ? ["ivanpaudice@me.com"] : recipients

  console.log("\n📧 Quick Memo")
  console.log("─".repeat(50))
  console.log(`From: ${FROM_NAME} <${FROM_EMAIL}>`)
  console.log(`To: ${isTest ? "ivanpaudice@me.com (TEST)" : `${recipients.length} recipients`}`)
  console.log(`Subject: ${subject}`)
  if (attachmentPath) {
    console.log(`Attachment: ${path.basename(attachmentPath)}`)
  }
  console.log("─".repeat(50))

  const emailHtml = buildQuickMemoHtml(message)

  // Build email payload
  const emailPayload: {
    from: string
    to: string[]
    subject: string
    html: string
    attachments?: { filename: string; content: Buffer }[]
  } = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: finalRecipients,
    subject: isTest ? `[TEST] ${subject}` : subject,
    html: emailHtml,
  }

  if (attachmentPath) {
    emailPayload.attachments = [
      {
        filename: path.basename(attachmentPath),
        content: fs.readFileSync(attachmentPath),
      },
    ]
  }

  if (!isTest) {
    console.log("\n⚠️  Sending to ALL recipients in 3 seconds... (Ctrl+C to cancel)")
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  console.log("\n📤 Sending...")

  try {
    const { data, error } = await resend.emails.send(emailPayload)
    if (error) {
      console.error("❌ Error:", error)
      process.exit(1)
    }
    console.log("✅ Sent!")
    console.log(`   Resend ID: ${data?.id}`)
  } catch (err) {
    console.error("❌ Failed:", err)
    process.exit(1)
  }
}

main()
