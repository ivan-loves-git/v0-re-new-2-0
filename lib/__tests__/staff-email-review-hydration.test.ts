import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/actions/staff-email-review", () => ({
  approveAndSendStaffEmailReview: vi.fn(),
  cancelStaffEmailReview: vi.fn(),
  editStaffEmailReview: vi.fn(),
}))

import { ReviewDetail } from "@/app/(dashboard)/emails/review/[id]/review-detail"
import { ReviewQueue } from "@/app/(dashboard)/emails/components/review-queue"

const review: StaffEmailReview = {
  id: "18600000-0000-4000-8000-000000000001",
  source_kind: "ma",
  source_operation_id: "18600000-0000-4000-8000-000000000002",
  opportunity_id: "18600000-0000-4000-8000-000000000003",
  match_id: null,
  upstream_evidence_id: null,
  contact_link_id: "18600000-0000-4000-8000-000000000004",
  recipient_email: "qa-review@re-new.invalid",
  namespace: "REAL",
  template_key: "ma_process_follow_up",
  template_version: "test-version",
  subject: "Synthetic subject",
  body_text: "Synthetic body",
  attachment_snapshot: [],
  state: "sent",
  version: 2,
  created_by: "staff-id",
  created_at: "2026-09-24T17:48:21.000Z",
  edited_by: null,
  edited_at: null,
  approved_by: "staff-id",
  approved_at: "2026-09-24T18:01:00.000Z",
  attempted_at: "2026-09-24T18:02:00.000Z",
  outcome_at: "2026-09-24T18:03:00.000Z",
  provider_message_id: "synthetic-provider-accepted",
  delivery_evidence_id: "18600000-0000-4000-8000-000000000005",
  delivery_error: null,
  cancelled_by: null,
  cancelled_at: null,
  cancel_reason: null,
}

const initial: Parameters<typeof ReviewDetail>[0]["initial"] = {
  review,
  events: [{
    id: "18600000-0000-4000-8000-000000000006",
    event_kind: "prepared",
    actor: "staff-id",
    occurred_at: "2026-09-24T17:48:21.000Z",
    version: 1,
    detail: {},
  }],
  catalogueEnabled: true,
}

function renderIn(timeZone: string, element: ReturnType<typeof createElement>) {
  const previousTimeZone = process.env.TZ
  try {
    process.env.TZ = timeZone
    return renderToStaticMarkup(element)
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimeZone
  }
}

describe("staff email review timestamps", () => {
  it("renders the same Paris times in the detail on a UTC server and Paris browser", () => {
    const element = createElement(ReviewDetail, { initial })
    const serverHtml = renderIn("UTC", element)
    const browserHtml = renderIn("Europe/Paris", element)

    expect(serverHtml).toContain("24/09/2026 19:48:21")
    expect(serverHtml).toBe(browserHtml)
  })

  it("shows the same Paris preparation time in the queue on server and browser", () => {
    const element = createElement(ReviewQueue, { reviews: [review] })
    const serverHtml = renderIn("UTC", element)
    const browserHtml = renderIn("Europe/Paris", element)

    expect(serverHtml).toContain("24/09/2026 19:48:21")
    expect(serverHtml).toBe(browserHtml)
  })
})
