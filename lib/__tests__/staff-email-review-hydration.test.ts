import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/emails",
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/lib/actions/staff-email-review", () => ({
  approveAndSendStaffEmailReview: vi.fn(),
  cancelStaffEmailReview: vi.fn(),
  editStaffEmailReview: vi.fn(),
  getStaffEmailReview: vi.fn(),
}))

import { ReviewDetail } from "@/app/(dashboard)/emails/review/[id]/review-detail"
import { ReviewQueue, ReviewQueueDetailDescription } from "@/app/(dashboard)/emails/components/review-queue"
import { SingleEmailConfirmation } from "@/app/(dashboard)/emails/components/single-confirmation"
import { approveAndSendStaffEmailReview, editStaffEmailReview, getStaffEmailReview } from "@/lib/actions/staff-email-review"

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
  archived_at: null,
  archived_by: null,
  restored_at: null,
  restored_by: null,
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
  display: { recipient: null, opportunity: null },
  events: [
    {
      id: "18600000-0000-4000-8000-000000000006",
      event_kind: "prepared",
      actor: "staff-id",
      occurred_at: "2026-09-24T17:48:21.000Z",
      version: 1,
      detail: {},
    },
  ],
  catalogueEnabled: true,
  archiveEligible: false,
  catalogue: {
    template_key: review.template_key,
    subject: "Synthetic subject",
    body_markdown: "Synthetic body",
    body_editable: true,
    is_active: true,
    version: "test-version",
  },
  asOf: "2026-09-24T19:00:00.000Z",
  members: [],
  replies: [],
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

describe("staff email queue preparation description", () => {
  const creatorId = "18600000-0000-4000-8000-000000000099"

  it.each(["ma", "e4", "e6", "e7"] as const)(
    "describes a %s draft without presenting its creator UUID as a name",
    (sourceKind) => {
      const html = renderToStaticMarkup(createElement(ReviewQueueDetailDescription, {
        purposeLabel: "Process follow-up",
        review: { ...review, source_kind: sourceKind, created_by: creatorId },
      }))
      expect(html).toBe("Process follow-up · Prepared for review")
      expect(html).not.toContain(creatorId)
    },
  )

  it("retains the factual automated 45-day rule attribution for freshness drafts", () => {
    const html = renderToStaticMarkup(createElement(ReviewQueueDetailDescription, {
      purposeLabel: "Source freshness",
      review: { ...review, source_kind: "freshness", created_by: creatorId },
    }))
    expect(html).toBe("Source freshness · Prepared by the automated 45-day rule")
  })
})

describe("staff email review timestamps", () => {
  it("shows the exact saved individual message with explicit acknowledgment and performs no send on opening", () => {
    const html = renderToStaticMarkup(createElement(SingleEmailConfirmation, {
      initial: {
        ...initial,
        review: { ...review, state: "pending", version: 3, subject: "Saved fictional subject", body_text: "Saved full body\n\nFinal line of saved message" },
        display: { ...initial.display, recipient: { recipient_email: review.recipient_email, recipient_name: "Fictional Person", company_name: null, purpose_label: "Process follow-up" } },
      },
    }))
    expect(html).toContain("Fictional Person")
    expect(html).toContain('Fictional Person</span> <span class="text-muted-foreground text-xs">qa-review@re-new.invalid</span>')
    expect(html).toContain("Saved fictional subject")
    expect(html).toContain("Final line of saved message")
    expect(html).toContain("Reviewed version 3")
    expect(html).toContain('aria-label="Acknowledge complete message"')
    expect(html).toMatch(/<button\b[^>]*disabled=""[^>]*>[\s\S]*?Send<\/button>/)
    expect(approveAndSendStaffEmailReview).not.toHaveBeenCalled()
    expect(editStaffEmailReview).not.toHaveBeenCalled()
    expect(getStaffEmailReview).not.toHaveBeenCalled()
  })
  it("renders the same Paris times in the detail on a UTC server and Paris browser", () => {
    const element = createElement(ReviewDetail, { initial })
    const serverHtml = renderIn("UTC", element)
    const browserHtml = renderIn("Europe/Paris", element)

    expect(serverHtml).toContain("24/09/2026 19:48:21")
    expect(serverHtml).toBe(browserHtml)
  })

  it("shows the same Paris preparation time in the queue on server and browser", () => {
    const element = createElement(ReviewQueue, {
      queue: {
        reviews: [
          {
            id: review.id,
            source_kind: review.source_kind,
            template_key: review.template_key,
            subject: review.subject,
            body_preview: review.body_text,
            recipient_email: review.recipient_email,
            namespace: review.namespace,
            state: review.state,
            version: review.version,
            created_at: review.created_at,
            recipient_name: "Synthetic Source",
            recipient_avatar_url: null,
            company_name: "Example Firm",
            purpose_key: "ma_process_follow_up",
            purpose_label: "Process follow-up",
            archived_at: null,
            archive_eligible: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        activeCount: 0,
        archivedCount: 0,
        allCount: 1,
        view: "all",
        search: "",
        purpose: "all",
        sort: "prepared",
        direction: "desc",
      },
    })
    const serverHtml = renderIn("UTC", element)
    const browserHtml = renderIn("Europe/Paris", element)

    expect(serverHtml).toContain("24 Sep 7PM")
    expect(serverHtml).toContain('title="24 September 2026 at 7:48:21 pm"')
    expect(serverHtml).toBe(browserHtml)
  })
})

describe("grouped freshness response coverage", () => {
  const member = (opportunityId: string) => ({
    opportunity_id: opportunityId,
    episode_key: "initial",
    frozen_member: {
      reference: opportunityId,
      title: opportunityId,
      firm_name: "Atlas",
      office_name: "Paris",
      basis: "recorded_source_day",
      date_added: "2026-01-01",
      source_office_id: "office",
      affiliation_id: "affiliation",
      contact_link_id: "link",
    },
  })
  const freshnessReview = {
    ...review,
    source_kind: "freshness" as const,
    outcome_at: "2026-09-24T18:03:00.000Z",
  }
  const members = [member("opportunity-a"), member("opportunity-b")]
  const reply = (opportunityId: string) => ({
    id: `reply-${opportunityId}`,
    opportunity_id: opportunityId,
    outcome: "confirmed_open",
    reply_at: "2026-09-24T18:30:00.000Z",
    evidence: "Source replied",
    recorded_by: "staff-id",
    recorded_at: "2026-09-24T18:31:00.000Z",
  })

  it("shows no responses as awaiting the whole group", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewDetail, {
        initial: { ...initial, review: freshnessReview, members, replies: [] },
      }),
    )
    expect(html).toContain("Awaiting source response")
    expect(html).toContain("0 of 2 members answered")
  })

  it("shows partial exact-member coverage", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewDetail, {
        initial: {
          ...initial,
          review: freshnessReview,
          members,
          replies: [reply("opportunity-a")],
        },
      }),
    )
    expect(html).toContain("Source response partially recorded")
    expect(html).toContain("1 of 2 members answered")
  })

  it("stops claiming a response is awaited when every member replied, including a single-member group", () => {
    const two = renderToStaticMarkup(
      createElement(ReviewDetail, {
        initial: {
          ...initial,
          review: freshnessReview,
          members,
          replies: [reply("opportunity-a"), reply("opportunity-b")],
        },
      }),
    )
    const one = renderToStaticMarkup(
      createElement(ReviewDetail, {
        initial: {
          ...initial,
          review: freshnessReview,
          members: members.slice(0, 1),
          replies: [reply("opportunity-a")],
        },
      }),
    )
    expect(two).toContain("All source responses recorded")
    expect(two).toContain("2 of 2 members answered")
    expect(one).toContain("1 of 1 member answered")
    expect(two).not.toContain("Awaiting source response")
    expect(one).not.toContain("days ago")
  })
})

describe("retained and current template provenance", () => {
  it("keeps reviewed words distinct from a changed current catalogue source", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewDetail, {
        initial: {
          ...initial,
          catalogue: {
            ...initial.catalogue!,
            version: "current-version",
            subject: "New catalogue subject",
            body_markdown: "New catalogue body",
          },
        },
      }),
    )
    expect(html).toContain("Template updated")
    expect(html).toContain("test-version")
    expect(html).toContain("current-version")
    expect(html).toContain("Synthetic subject")
    expect(html).toContain("New catalogue subject")
  })

  it("identifies E6 as code-owned without fabricating a catalogue detail", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewDetail, {
        initial: {
          ...initial,
          review: {
            ...review,
            source_kind: "e6",
            template_key: "code:e6_nda_ready",
            template_version: "w112-e6-v1",
            state: "pending",
          },
          catalogue: null,
          catalogueEnabled: true,
        },
      }),
    )
    expect(html).toContain("no editable catalogue template")
    expect(html).toContain("w112-e6-v1")
    expect(html).not.toContain("Open code:e6_nda_ready")
    expect(html).not.toContain("Catalogue template disabled")
  })
})
