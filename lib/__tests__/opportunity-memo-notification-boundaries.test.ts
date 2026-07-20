import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const migrationSource = fs.readFileSync(
  path.join(root, "scripts/069_opportunity_memo_notification.sql"),
  "utf8",
)
const matchActionSource = fs.readFileSync(
  path.join(root, "lib/actions/opportunity-matches.ts"),
  "utf8",
)
const documentActionSource = fs.readFileSync(
  path.join(root, "lib/actions/opportunity-documents.ts"),
  "utf8",
)
const notificationDataSource = fs.readFileSync(
  path.join(root, "lib/data/opportunity-memo-notification.ts"),
  "utf8",
)
const notificationTriggerSource = fs.readFileSync(
  path.join(root, "lib/trigger-opportunity-memo-notification.ts"),
  "utf8",
)

describe("opportunity memo notification boundaries", () => {
  it("claims only an active pursuit after NDA completion and a real approved memo", () => {
    expect(migrationSource).toContain("om.status = 'active_pursuit'")
    expect(migrationSource).toContain("om.nda_status IN ('signed', 'waived')")
    expect(migrationSource).not.toContain("om.nda_status IN ('sent'")
    expect(migrationSource).toContain("d.document_type = 'deal_book'")
    expect(migrationSource).toContain("d.visibility = 'approved_for_repreneur'")
    expect(migrationSource).toContain("BTRIM(d.storage_path)")
    expect(migrationSource).toContain("BTRIM(d.external_url)")
  })

  it("keeps once-only and retry semantics in the database", () => {
    expect(migrationSource).toContain("match_id UUID NOT NULL UNIQUE")
    expect(migrationSource).toContain("opportunity_memo_notifications.sent_at IS NULL")
    expect(migrationSource).toContain("n.status IN ('pending', 'failed')")
    expect(migrationSource).toContain("INTERVAL '15 minutes'")
    expect(migrationSource).toContain("AND sent_at IS NULL")
  })

  it("skips completed and leased pursuits before choosing the next candidate", () => {
    expect(migrationSource).toContain("LEFT JOIN public.opportunity_memo_notifications n")
    expect(migrationSource).toContain("n.match_id IS NULL")
    expect(migrationSource).toContain("n.sent_at IS NULL")
    expect(migrationSource).toContain("n.status IN ('pending', 'failed')")
    expect(migrationSource).toContain("n.status = 'sending'")
  })

  it("resolves only the active repreneur and public opportunity title", () => {
    expect(migrationSource).toContain("JOIN public.repreneurs r ON r.id = om.repreneur_id")
    expect(migrationSource).toContain("BTRIM(r.email)")
    expect(migrationSource).toContain("BTRIM(o.public_title)")
    expect(migrationSource).not.toContain("ma_sources")
    expect(migrationSource).not.toContain("source_label")
    expect(migrationSource).not.toContain("contact_email")
  })

  it("triggers at both sides of the eligibility boundary", () => {
    expect(matchActionSource.match(/await triggerOpportunityMemoNotification/g)).toHaveLength(2)
    expect(matchActionSource).toContain("matchId,")
    expect(documentActionSource.match(/await triggerOpportunityMemoNotification/g)).toHaveLength(2)
  })

  it("evaluates every eligible pursuit when a memo becomes available", () => {
    expect(notificationDataSource).toContain('.eq("status", "active_pursuit")')
    expect(notificationDataSource).toContain('.in("nda_status", ["signed", "waived"])')
    expect(notificationTriggerSource).toContain("notifyOpportunityMemoCandidates")
    expect(notificationTriggerSource).toContain("matchIds,")
  })

  it("keeps the delivery records and functions service-role only", () => {
    expect(migrationSource).toContain("ENABLE ROW LEVEL SECURITY")
    expect(migrationSource).toContain("FROM PUBLIC, anon, authenticated")
    expect(migrationSource).toContain("TO service_role")
    expect(migrationSource).toContain("SECURITY DEFINER")
    expect(migrationSource).toContain("SET search_path = public")
  })
})
