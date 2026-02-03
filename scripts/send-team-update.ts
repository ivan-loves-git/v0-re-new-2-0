#!/usr/bin/env npx tsx
/**
 * Send product updates to the Founders & Team 2.0 distribution list
 *
 * Usage:
 *   npx tsx scripts/send-team-update.ts "Subject" "Message body"
 *   npx tsx scripts/send-team-update.ts "Subject" --file path/to/message.md
 *   npx tsx scripts/send-team-update.ts "Subject" "Message" --test   # Sends only to Ivan
 *   npx tsx scripts/send-team-update.ts "Subject" "Message" --attach /path/to/file.pdf
 *
 * Example:
 *   npx tsx scripts/send-team-update.ts "New Features!" "We shipped X." --test
 *   npx tsx scripts/send-team-update.ts "New Features!" "We shipped X."  # Sends to all
 *   npx tsx scripts/send-team-update.ts "Status Update" "See attached." --attach ~/Downloads/report.pdf --test
 *
 * Note: Requires RESEND_API_KEY in .env.local
 */

import { Resend } from "resend"
import { render } from "@react-email/render"
import * as React from "react"
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

// Import distribution list
import {
  FOUNDERS_TEAM_2_0,
  getEmailsOnly,
} from "../lib/distribution-lists"

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@re-new.com"
const FROM_NAME = "Re-New"

// Convert simple markdown to HTML
function parseMarkdown(text: string): string {
  return text
    // Convert *text* to <em>text</em>
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Convert **text** to <strong>text</strong>
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
}

// Simple email template for team updates
function TeamUpdateEmail({
  subject,
  message,
}: {
  subject: string
  message: string
}) {
  // Split message into body and signature (separated by ---)
  const parts = message.split(/\n---\n/)
  const bodyText = parts[0]
  const signatureText = parts.length > 1 ? parts[1] : null

  // Parse body paragraphs
  const bodyParagraphs = bodyText.split("\n\n").map((para, i) =>
    React.createElement("p", {
      key: i,
      style: {
        color: "#1f2937",
        fontSize: "16px",
        lineHeight: "1.6",
        margin: "0 0 16px 0",
      },
      dangerouslySetInnerHTML: { __html: parseMarkdown(para) },
    })
  )

  // Parse signature if present
  const signatureElement = signatureText
    ? React.createElement(
        "div",
        {
          style: {
            borderTop: "1px solid #e5e7eb",
            marginTop: "24px",
            paddingTop: "20px",
          },
        },
        React.createElement("p", {
          style: {
            color: "#6b7280",
            fontSize: "14px",
            lineHeight: "1.5",
            margin: 0,
            fontStyle: "italic",
          },
          dangerouslySetInnerHTML: {
            __html: parseMarkdown(signatureText.split("\n\n")[0]),
          },
        }),
        signatureText.includes("Wavy") &&
          React.createElement(
            "div",
            { style: { marginTop: "16px" } },
            React.createElement(
              "p",
              {
                style: {
                  color: "#1f2937",
                  fontSize: "14px",
                  fontWeight: "600",
                  margin: "0 0 2px 0",
                },
              },
              "Wavy 🌊"
            ),
            React.createElement(
              "p",
              {
                style: {
                  color: "#6b7280",
                  fontSize: "13px",
                  margin: "0 0 2px 0",
                },
              },
              "Chief Notification Officer"
            ),
            React.createElement(
              "p",
              {
                style: {
                  color: "#6b7280",
                  fontSize: "13px",
                  margin: 0,
                },
              },
              "Re-New team"
            )
          )
      )
    : null

  return React.createElement(
    "html",
    null,
    React.createElement("head", null),
    React.createElement(
      "body",
      {
        style: {
          backgroundColor: "#f4f4f5",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          margin: 0,
          padding: "20px 0",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            backgroundColor: "#ffffff",
            margin: "0 auto",
            maxWidth: "600px",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          },
        },
        // Header
        React.createElement(
          "div",
          {
            style: {
              backgroundColor: "#2563eb",
              padding: "24px",
              textAlign: "center" as const,
            },
          },
          React.createElement(
            "span",
            {
              style: {
                color: "#ffffff",
                fontSize: "28px",
                fontWeight: "bold",
              },
            },
            "Re-New"
          )
        ),
        // Content
        React.createElement(
          "div",
          { style: { padding: "32px 24px" } },
          React.createElement(
            "h1",
            {
              style: {
                color: "#1f2937",
                fontSize: "22px",
                fontWeight: "600",
                margin: "0 0 20px 0",
              },
            },
            subject
          ),
          ...bodyParagraphs,
          signatureElement
        ),
        // Footer
        React.createElement("hr", {
          style: { borderColor: "#e5e7eb", margin: 0 },
        }),
        React.createElement(
          "div",
          { style: { padding: "16px 24px", textAlign: "center" as const } },
          React.createElement(
            "p",
            { style: { color: "#9ca3af", fontSize: "12px", margin: 0 } },
            "Internal update from the Re-New platform"
          )
        )
      )
    )
  )
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log(`
Usage:
  npx tsx scripts/send-team-update.ts "Subject" "Message body"
  npx tsx scripts/send-team-update.ts "Subject" --file path/to/message.md

Options:
  --test              Send only to ivanpaudice@me.com (recommended first)
  --attach <path>     Attach a file (PDF, etc.)

Example:
  npx tsx scripts/send-team-update.ts "New Features!" "We shipped X." --test
  npx tsx scripts/send-team-update.ts "New Features!" "We shipped X."
  npx tsx scripts/send-team-update.ts "Status" "See attached." --attach ~/file.pdf --test
`)
    process.exit(1)
  }

  const subject = args[0]
  let message: string

  if (args[1] === "--file") {
    const filePath = args[2]
    if (!filePath) {
      console.error("Error: --file requires a path")
      process.exit(1)
    }
    message = fs.readFileSync(filePath, "utf-8")
  } else {
    message = args[1]
  }

  // Parse --attach flag
  const attachIndex = args.indexOf("--attach")
  let attachmentPath: string | null = null
  if (attachIndex !== -1 && args[attachIndex + 1]) {
    attachmentPath = args[attachIndex + 1]
    // Expand ~ to home directory
    if (attachmentPath.startsWith("~")) {
      attachmentPath = attachmentPath.replace("~", process.env.HOME || "")
    }
    if (!fs.existsSync(attachmentPath)) {
      console.error(`Error: Attachment file not found: ${attachmentPath}`)
      process.exit(1)
    }
  }

  // Check API key
  if (!process.env.RESEND_API_KEY) {
    console.error("Error: RESEND_API_KEY not found in .env.local")
    process.exit(1)
  }

  const recipients = getEmailsOnly(FOUNDERS_TEAM_2_0)

  console.log("\n📧 Team Update Email")
  console.log("─".repeat(50))
  console.log(`From: ${FROM_NAME} <${FROM_EMAIL}>`)
  console.log(`To: ${recipients.length} recipients`)
  console.log(`Subject: ${subject}`)
  if (attachmentPath) {
    console.log(`Attachment: ${path.basename(attachmentPath)}`)
  }
  console.log("─".repeat(50))
  console.log("\nRecipients:")
  FOUNDERS_TEAM_2_0.contacts.forEach((c) => {
    console.log(`  • ${c.name} <${c.email}>`)
  })
  console.log("\nMessage preview:")
  console.log(message.substring(0, 200) + (message.length > 200 ? "..." : ""))
  console.log("─".repeat(50))

  // Render email HTML
  const emailHtml = await render(
    React.createElement(TeamUpdateEmail, { subject, message })
  )

  // Test mode - send only to Ivan
  const isTest = args.includes("--test")
  const finalRecipients = isTest ? ["ivanpaudice@me.com"] : recipients
  const subjectPrefix = isTest ? "[TEST] " : ""

  if (isTest) {
    console.log("\n🧪 TEST MODE - sending only to ivanpaudice@me.com")
  } else {
    console.log("\n⚠️  Ready to send to ALL recipients.")
    console.log("    Run with --test to send only to yourself first.")
    console.log("    Press Ctrl+C to cancel, or wait 3 seconds to send...")
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  // Send email
  console.log("\n📤 Sending...")

  try {
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
      subject: subjectPrefix + subject,
      html: emailHtml,
    }

    // Add attachment if provided
    if (attachmentPath) {
      const fileContent = fs.readFileSync(attachmentPath)
      emailPayload.attachments = [
        {
          filename: path.basename(attachmentPath),
          content: fileContent,
        },
      ]
    }

    const { data, error } = await resend.emails.send(emailPayload)

    if (error) {
      console.error("❌ Error:", error)
      process.exit(1)
    }

    console.log("✅ Email sent successfully!")
    console.log(`   Resend ID: ${data?.id}`)
  } catch (err) {
    console.error("❌ Failed to send:", err)
    process.exit(1)
  }
}

main()
