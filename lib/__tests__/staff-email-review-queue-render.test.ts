import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ReviewQueue } from "@/app/(dashboard)/emails/components/review-queue"
import {
  parseEmailReviewQueueOptions,
  type EmailReviewQueueRow,
} from "@/lib/email/review-queue-query"

vi.mock("next/navigation", () => ({
  usePathname: () => "/emails",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const validId = "22100000-0000-4000-8000-000000000001"

function row(id: string): EmailReviewQueueRow {
  return {
    id,
    source_kind: "ma",
    template_key: "ma_process_follow_up",
    subject: id === validId ? "Safe review" : "Hostile ID review",
    body_preview: "Fictional review text",
    recipient_email: "person@example.invalid",
    namespace: "REAL",
    state: "pending",
    version: 1,
    created_at: "2026-09-27T02:37:00Z",
    recipient_name: "Example Person",
    recipient_avatar_url: null,
    company_name: "Example Firm",
    purpose_key: "ma_process_follow_up",
    purpose_label: "Process follow-up",
    archived_at: null,
    archive_eligible: true,
  }
}

function render(reviews: EmailReviewQueueRow[]) {
  return renderToStaticMarkup(
    createElement(ReviewQueue, {
      queue: {
        ...parseEmailReviewQueueOptions({}),
        reviews,
        total: reviews.length,
        pageSize: 25,
        activeCount: reviews.length,
        archivedCount: 0,
        allCount: reviews.length,
      },
    }),
  )
}

describe("staff email queue navigation and compact time", () => {
  it("offers one page-scoped selection and grouped review controls without empty bulk bars", () => {
    const html = render([row(validId)])
    expect(html).toContain("Pending review")
    expect(html).toContain("Collapse groups")
    expect(html).toContain("Display")
    expect(html.match(/role="checkbox"/g)).toHaveLength(2)
    expect(html).not.toContain("Bounded bulk send selection")
    expect(html).not.toContain("Archive selected")
    expect(html).not.toContain("Restore selected")
  })

  it("keeps uncertain, failed, sent and archived records in truthful groups", () => {
    const html = render([
      row(validId),
      {
        ...row("22100000-0000-4000-8000-000000000002"),
        state: "uncertain",
        archive_eligible: false,
      },
      { ...row("22100000-0000-4000-8000-000000000003"), state: "failed" },
      {
        ...row("22100000-0000-4000-8000-000000000004"),
        state: "sent",
        archive_eligible: false,
      },
      {
        ...row("22100000-0000-4000-8000-000000000005"),
        archived_at: "2026-09-29T10:00:00Z",
      },
    ])
    expect(html).toContain('aria-label="Collapse Outcome uncertain"')
    expect(html).toContain('aria-label="Collapse Failed"')
    expect(html).toContain('aria-label="Collapse Accepted by provider"')
    expect(html).toContain('aria-label="Collapse Archived"')
    // Header plus three eligible draft controls; uncertain and sent have none.
    expect(html.match(/role="checkbox"/g)).toHaveLength(4)
    expect(html).not.toContain("Simulated")
  })

  it("shows the Paris date and hour without compact minutes, retaining the exact timestamp title", () => {
    const html = render([row(validId)])
    expect(html).toContain(">27 Sep 4AM</span></time>")
    expect(html).not.toContain(">27 Sep 4:37AM</span></time>")
    expect(html).toMatch(/<time\b[^>]*title="[^"]*4:37:00[^"]*"/)
  })

  it("treats hostile message text as escaped text and tooltip, never navigation", () => {
    const subject = 'javascript:alert(1) "<img src=x onerror=alert(2)>'
    const html = render([{ ...row(validId), subject }])
    expect(
      html.match(new RegExp(`href="/emails/review/${validId}"`, "g")),
    ).toHaveLength(2)
    expect(html).toContain(
      'title="javascript:alert(1) &quot;&lt;img src=x onerror=alert(2)&gt;"',
    )
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain("<img src=x")
    expect(html).not.toMatch(/<a\b[^>]*\btitle=/)
  })

  it("renders both real review links and no navigation for a hostile ID", () => {
    const html = render([row(validId), row("javascript:alert(1)")])
    expect(
      html.match(new RegExp(`href="/emails/review/${validId}"`, "g")),
    ).toHaveLength(2)
    expect(html).toContain("Hostile ID review")
    expect(html).toContain("Unavailable")
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain("/emails/review/javascript")
  })
})
