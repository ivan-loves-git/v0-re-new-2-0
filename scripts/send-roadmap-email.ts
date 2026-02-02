/**
 * Product update email script
 *
 * CATEGORY: Ivan's triggered emails
 * These emails are NOT automated. Ivan must explicitly ask Claude to send them.
 *
 * WORKFLOW:
 * 1. Claude always sends a test email to ivanpaudice@me.com first
 * 2. Ivan reviews the test email
 * 3. Only after Ivan confirms, Claude sends to the full team
 *
 * Usage:
 *   Test (single):  npx tsx scripts/send-roadmap-email.ts [email] [name] [version]
 *   Full team:      npx tsx scripts/send-roadmap-email.ts --team [version]
 *
 * Versions: 1 = Minimal (default), 2 = Centered, 3 = Timeline
 */

import { Resend } from "resend"
import { FOUNDERS_TEAM_2_0 } from "../lib/distribution-lists"

const resend = new Resend(process.env.RESEND_API_KEY)

const ROADMAP_URL = "https://app.re-new.team/guide/roadmap"

// VERSION 1: Minimal - Clean, lots of whitespace
function createEmailV1(name: string) {
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
    .intro { color: #64748b; font-size: 14px; margin: 0 0 20px 0; line-height: 1.6; }
    .divider { color: #cbd5e1; font-size: 16px; text-align: center; margin: 20px 0; letter-spacing: 8px; }
    .version { color: #3b82f6; font-size: 13px; font-weight: 500; margin: 0 0 8px 0; }
    h1 { color: #0f172a; font-size: 20px; font-weight: 600; margin: 0 0 24px 0; line-height: 1.3; }
    .updates { margin: 0 0 32px 0; }
    .update { padding: 16px 0; border-bottom: 1px solid #f1f5f9; }
    .update:last-child { border-bottom: none; }
    .update-title { color: #0f172a; font-size: 14px; font-weight: 600; margin: 0 0 4px 0; }
    .update-desc { color: #64748b; font-size: 13px; margin: 0 0 8px 0; }
    .tags { margin: 0; }
    .tag { display: inline-block; font-size: 10px; padding: 3px 8px; border-radius: 4px; margin-right: 6px; font-family: ui-monospace, monospace; }
    .tag-security { background: #dcfce7; color: #166534; }
    .tag-auth { background: #dbeafe; color: #1e40af; }
    .tag-refactor { background: #fef3c7; color: #92400e; }
    .tag-feature { background: #e0e7ff; color: #3730a3; }
    .tag-fix { background: #fce7f3; color: #9d174d; }
    .tag-perf { background: #cffafe; color: #0e7490; }
    .tag-meta { background: #f1f5f9; color: #64748b; }
    .cta { display: inline-block; color: #3b82f6; font-size: 14px; font-weight: 500; text-decoration: none; margin-bottom: 20px; }
    .signature { padding-top: 0; }
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
    <p class="intro">I've learned a new trick. You know how I send these updates? Now I can write emails for you too. Pick a repreneur, choose a template, and I'll draft something personalized. Magic? No, just me getting better at my job.</p>

    <p class="divider">•••</p>

    <p class="version">v0.9.0</p>
    <h1>I can write your emails now. Plus: smarter pipeline sorting.</h1>

    <div class="updates">
      <div class="update">
        <p class="update-title">🤖 AI email generator</p>
        <p class="update-desc">Select a repreneur, pick a template, hit generate. I'll draft a personalized email you can review and send. Find it in the Emails section.</p>
        <p class="tags">
          <span class="tag tag-feature">feature</span>
        </p>
      </div>
      <div class="update">
        <p class="update-title">🌐 New domain live</p>
        <p class="update-desc">Wave now lives at app.re-new.team. Update your bookmarks!</p>
        <p class="tags">
          <span class="tag tag-feature">feature</span>
        </p>
      </div>
      <div class="update">
        <p class="update-title">📊 Leads auto-sorted by potential</p>
        <p class="update-desc">Pipeline now shows highest-scoring candidates first. No manual sorting needed.</p>
        <p class="tags">
          <span class="tag tag-feature">feature</span>
        </p>
      </div>
      <div class="update">
        <p class="update-title">🚦 Declined vs Rejected</p>
        <p class="update-desc">New status for internal decisions. "Declined" = you decided not to proceed. "Rejected" = you sent them a rejection email.</p>
        <p class="tags">
          <span class="tag tag-feature">feature</span>
        </p>
      </div>
      <div class="update">
        <p class="update-title">🧹 Bug fixes</p>
        <p class="update-desc">Profile data now displays correctly. Dead navigation links removed. Various stability improvements.</p>
        <p class="tags">
          <span class="tag tag-fix">fix</span>
        </p>
      </div>
    </div>

    <a href="${ROADMAP_URL}" class="cta">View full roadmap →</a>

    <p class="divider">•••</p>

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

// VERSION 2: Centered - Elegant, centered layout
function createEmailV2(name: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #334155; background: #f1f5f9; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; text-align: center; }
    .card { background: #ffffff; border-radius: 16px; padding: 48px 32px; margin-bottom: 16px; }
    .logo { margin-bottom: 24px; }
    .logo img { height: 28px; }
    .badge { display: inline-block; background: #eff6ff; color: #3b82f6; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500; margin-bottom: 20px; }
    h1 { color: #0f172a; font-size: 20px; font-weight: 600; margin: 0 0 8px 0; }
    .subtitle { color: #64748b; font-size: 14px; margin: 0 0 32px 0; }
    .updates { text-align: left; margin: 0 0 32px 0; }
    .update { display: flex; gap: 12px; padding: 14px; background: #f8fafc; border-radius: 10px; margin-bottom: 8px; }
    .update-icon { font-size: 16px; }
    .update-text { flex: 1; }
    .update-title { color: #0f172a; font-size: 13px; font-weight: 600; margin: 0; }
    .update-desc { color: #64748b; font-size: 12px; margin: 4px 0 0 0; }
    .cta { display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; }
    .footer { padding: 24px; color: #94a3b8; font-size: 13px; }
    .footer-name { color: #3b82f6; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="https://cdn.prod.website-files.com/68a87ebceebd6aec9fa8d6b3/68b6fe358d32a837b0522d9a_Logo.svg" alt="Re-New">
      </div>

      <div class="badge">v0.8.1 – v0.8.3</div>
      <h1>Hey ${name} 👋</h1>
      <p class="subtitle">Quick update on what changed this week</p>

      <div class="updates">
        <div class="update">
          <span class="update-icon">🔒</span>
          <div class="update-text">
            <p class="update-title">Security hardened</p>
            <p class="update-desc">10 fixes: SQL injection, API auth, webhooks</p>
          </div>
        </div>
        <div class="update">
          <span class="update-icon">⚡</span>
          <div class="update-text">
            <p class="update-title">Better Auth migration</p>
            <p class="update-desc">TypeScript-first, same login flow</p>
          </div>
        </div>
        <div class="update">
          <span class="update-icon">🧹</span>
          <div class="update-text">
            <p class="update-title">1.6k lines removed</p>
            <p class="update-desc">Dead code cleanup, faster builds</p>
          </div>
        </div>
      </div>

      <a href="${ROADMAP_URL}" class="cta">View Roadmap</a>
    </div>

    <div class="footer">
      <span class="footer-name">Wavy 🌊</span> · Chief Notification Officer
    </div>
  </div>
</body>
</html>
`
}

// VERSION 3: Timeline - Vertical line like the roadmap
function createEmailV3(name: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #334155; background: #f8fafc; margin: 0; padding: 40px 20px; }
    .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { padding: 32px 32px 24px; border-bottom: 1px solid #f1f5f9; }
    .header img { height: 24px; }
    .content { padding: 32px; }
    .greeting { color: #64748b; font-size: 14px; margin: 0 0 4px 0; }
    .name { color: #0f172a; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; }
    .intro { color: #475569; font-size: 14px; margin: 0 0 28px 0; }
    .timeline { position: relative; padding-left: 24px; margin: 0 0 28px 0; }
    .timeline::before { content: ''; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 2px; background: #e2e8f0; }
    .item { position: relative; padding-bottom: 20px; }
    .item:last-child { padding-bottom: 0; }
    .item::before { content: ''; position: absolute; left: -24px; top: 6px; width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; border: 2px solid #fff; }
    .item-title { color: #0f172a; font-size: 14px; font-weight: 600; margin: 0 0 4px 0; }
    .item-desc { color: #64748b; font-size: 13px; margin: 0; }
    .cta { display: inline-block; background: #3b82f6; color: white; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 500; text-decoration: none; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; }
    .sig { color: #64748b; font-size: 13px; margin: 0 0 8px 0; font-style: italic; }
    .sig-name { color: #3b82f6; font-size: 14px; font-weight: 600; margin: 0; }
    .sig-title { color: #94a3b8; font-size: 11px; margin: 2px 0 0 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://cdn.prod.website-files.com/68a87ebceebd6aec9fa8d6b3/68b6fe358d32a837b0522d9a_Logo.svg" alt="Re-New">
    </div>

    <div class="content">
      <p class="greeting">Hey,</p>
      <p class="name">${name} 👋</p>
      <p class="intro">Since you're one of my creators, here's what I've been up to this week.</p>

      <div class="timeline">
        <div class="item">
          <p class="item-title">v0.8.3 · Better Auth</p>
          <p class="item-desc">Migrated to TypeScript-first auth. Same login, better control.</p>
        </div>
        <div class="item">
          <p class="item-title">v0.8.2 · Task Management</p>
          <p class="item-desc">New /tasks page for tracking V1.0 launch activities.</p>
        </div>
        <div class="item">
          <p class="item-title">v0.8.1 · Security Audit</p>
          <p class="item-desc">10 security fixes, 1.6k lines removed, 6 new indexes.</p>
        </div>
      </div>

      <a href="${ROADMAP_URL}" class="cta">View Full Roadmap →</a>
    </div>

    <div class="footer">
      <p class="sig">Back to work. Someone has to keep this ship running.</p>
      <p class="sig-name">Wavy 🌊</p>
      <p class="sig-title">Chief Notification Officer</p>
    </div>
  </div>
</body>
</html>
`
}

function createEmailHtml(name: string, version: number = 1) {
  switch (version) {
    case 1: return createEmailV1(name)
    case 2: return createEmailV2(name)
    case 3: return createEmailV3(name)
    default: return createEmailV1(name)
  }
}

async function sendRoadmapEmail(to: string, name: string, version: number = 1) {
  const versionLabel = version === 1 ? "Minimal" : version === 2 ? "Centered" : "Timeline"
  console.log(`Sending version ${version} (${versionLabel}) to ${name} <${to}>...`)

  try {
    const { data, error } = await resend.emails.send({
      from: "Wavy 🌊 <notifications@news.re-new.team>",
      to: [to],
      subject: `Wave product update: v0.9.0`,
      html: createEmailHtml(name, version),
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

async function sendToTeam(version: number = 1) {
  console.log(`\nSending to ${FOUNDERS_TEAM_2_0.contacts.length} team members...\n`)

  for (const contact of FOUNDERS_TEAM_2_0.contacts) {
    const firstName = contact.name.split(" ")[0]
    await sendRoadmapEmail(contact.email, firstName, version)
    // Small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`\nDone! Sent to ${FOUNDERS_TEAM_2_0.contacts.length} recipients.`)
}

// Usage:
// Single recipient: npx tsx scripts/send-roadmap-email.ts [email] [name] [version]
// Full team:        npx tsx scripts/send-roadmap-email.ts --team [version]
const args = process.argv.slice(2)

if (args[0] === "--team") {
  const version = parseInt(args[1] || "1")
  sendToTeam(version)
} else {
  const recipient = args[0] || "ivanpaudice@me.com"
  const name = args[1] || "Ivan"
  const version = parseInt(args[2] || "1")
  sendRoadmapEmail(recipient, name, version)
}
