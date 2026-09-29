import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ReviewQueue } from "@/app/(dashboard)/emails/components/review-queue"
import { parseEmailReviewQueueOptions, type EmailReviewQueueRow } from "@/lib/email/review-queue-query"

vi.mock("next/navigation", () => ({
  usePathname: () => "/emails",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const validId = "22100000-0000-4000-8000-000000000001"

function row(id: string): EmailReviewQueueRow {
  return {
    id, source_kind: "ma", template_key: "ma_process_follow_up",
    subject: id === validId ? "Safe review" : "Hostile ID review",
    body_preview: "Fictional review text", recipient_email: "person@example.invalid",
    namespace: "REAL", state: "pending", version: 1,
    created_at: "2026-09-27T02:37:00Z", recipient_name: "Example Person",
    recipient_avatar_url: null, company_name: "Example Firm",
    purpose_key: "ma_process_follow_up", purpose_label: "Process follow-up",
  }
}

function render(reviews: EmailReviewQueueRow[]) {
  return renderToStaticMarkup(createElement(ReviewQueue, { queue: {
    ...parseEmailReviewQueueOptions({}), reviews, total: reviews.length,
    pageSize: 25, activeCount: reviews.length, allCount: reviews.length,
  } }))
}

describe("staff email queue navigation and compact time", () => {
  it("shows the Paris date and hour without compact minutes, retaining the exact timestamp title", () => {
    const html = render([row(validId)])
    const time = html.match(/<time\b[^>]*>([\s\S]*?)<\/time>/)?.[1]?.replace(/<[^>]*>/g, "")
    expect(time).toBe("27 Sept 4 AM")
    expect(html).toMatch(/<time\b[^>]*title="[^"]*4:37:00[^"]*"/)
  })

  it("renders both real review links and no navigation for a hostile ID", () => {
    const html = render([row(validId), row("javascript:alert(1)")])
    expect(html.match(new RegExp(`href="/emails/review/${validId}"`, "g"))).toHaveLength(2)
    expect(html).toContain("Hostile ID review")
    expect(html).toContain("Unavailable")
    expect(html).not.toContain("href=\"javascript:")
    expect(html).not.toContain("/emails/review/javascript")
  })
})
