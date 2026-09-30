import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { BulkEmailConfirmation } from "@/app/(dashboard)/emails/bulk/[id]/bulk-confirmation"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

type BatchRecord = Parameters<typeof BulkEmailConfirmation>[0]["initial"]
function record(acknowledgedBy: string | null): BatchRecord {
  return {
    batch: {
      id: "22200000-0000-4000-8000-000000000001", prepared_by: "synthetic-staff",
      prepared_at: "2026-09-30T10:00:00Z", confirmed_by: null, confirmed_at: null,
      item_count: 2, page_query: {}, manifest_sha256: "a".repeat(64),
    },
    items: [1, 2].map((ordinal) => ({
      batch_id: "22200000-0000-4000-8000-000000000001", ordinal,
      review_id: `22200000-0000-4000-8000-00000000000${ordinal + 1}`,
      review_snapshot: {
        id: `22200000-0000-4000-8000-00000000000${ordinal + 1}`, version: 3,
        source_kind: "ma", source_operation_id: `synthetic-operation-${ordinal}`,
        opportunity_id: `synthetic-opportunity-${ordinal}`, match_id: null,
        upstream_evidence_id: null, contact_link_id: null,
        recipient_email: `person${ordinal}@example.invalid`, namespace: "REAL",
        template_key: "ma_process_follow_up", template_version: "synthetic-template-v1",
        subject: `Fictional subject ${ordinal}`, body_text: `Complete fictional body ${ordinal}\nEnd of complete message <script>alert(1)</script>`,
        attachment_snapshot: [],
      },
      members_snapshot: [], snapshot_sha256: "b".repeat(64),
      acknowledged_by: acknowledgedBy, acknowledged_at: acknowledgedBy ? "2026-09-30T10:01:00Z" : null,
      state: "not_attempted", started_at: null, finished_at: null, outcome_detail: null,
    })),
  }
}
function render(initial: BatchRecord) {
  return renderToStaticMarkup(createElement(BulkEmailConfirmation, { initial, embedded: true }))
}
function sendButton(html: string) {
  return html.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*Send 2 emails<\/button>/)?.[0]
}

describe("complete-message confirmation inside the queue dialog", () => {
  it("shows every full message and its own acknowledgement before final confirmation", () => {
    const html = render(record(null))
    expect(html).toContain("Complete fictional body 1")
    expect(html).toContain("Complete fictional body 2")
    expect(html).toContain("End of complete message &lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).toContain('aria-label="Acknowledge complete message 1"')
    expect(html).toContain('aria-label="Acknowledge complete message 2"')
    expect(sendButton(html)).toContain('disabled=""')
  })
  it("requires all exact messages to be acknowledged by the preparing staff member", () => {
    expect(sendButton(render(record("another-staff")))).toContain('disabled=""')
    const partial = record("synthetic-staff")
    partial.items[1].acknowledged_by = null
    expect(sendButton(render(partial))).toContain('disabled=""')
    expect(sendButton(render(record("synthetic-staff")))).not.toContain('disabled=""')
  })
  it("shows a real matching recipient label and smaller email without inferring a mismatched name", () => {
    const initial = record(null)
    const first = initial.items[0]
    initial.recipients = {
      [first.review_id]: { recipient_email: first.review_snapshot.recipient_email, recipient_name: "Fictional Person" },
      [initial.items[1].review_id]: { recipient_email: "different@example.invalid", recipient_name: "Wrong Person" },
    }
    const html = render(initial)
    expect(html).toContain("Fictional Person")
    expect(html).toMatch(/<p class="[^"]*text-xs[^"]*">person1@example.invalid<\/p>/)
    expect(html).not.toContain("Wrong Person")
  })
})
