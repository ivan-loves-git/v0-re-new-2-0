import { describe, expect, it } from "vitest"
import {
  emailReviewDetailPath, emailReviewSearchPattern, emailReviewSortColumn, isEmailReviewSelectable,
  parseEmailReviewQueueOptions, type EmailReviewQueueRow,
} from "@/lib/email/review-queue-query"

const row = {
  id: "22100000-0000-4000-8000-000000000001", source_kind: "ma",
  template_key: "ma_process_follow_up", subject: "Synthetic", body_preview: "Synthetic preview",
  recipient_email: "person@example.invalid", namespace: "REAL", state: "pending",
  version: 1, created_at: "2026-09-29T10:00:00Z", recipient_name: "Example Person",
  recipient_avatar_url: null, company_name: "Example Firm",
  purpose_key: "ma_process_follow_up", purpose_label: "Process follow-up",
} satisfies EmailReviewQueueRow

describe("staff email queue options", () => {
  it("defaults to active newest-first and normalizes bounded search", () => {
    expect(parseEmailReviewQueueOptions({})).toEqual({
      page: 1, view: "active", search: "", purpose: "all", sort: "prepared", direction: "desc",
    })
    expect(parseEmailReviewQueueOptions({
      reviewPage: "-8", reviewSort: "not-a-sort", reviewPurpose: "made-up",
      reviewDirection: "sideways", reviewSearch: "  A   B  ",
    })).toMatchObject({ page: 1, sort: "prepared", purpose: "all", direction: "desc", search: "A B" })
    expect(parseEmailReviewQueueOptions({ reviewSearch: "x".repeat(140) }).search).toHaveLength(120)
  })

  it("maps exactly five stable server sort keys and keeps explicit direction", () => {
    expect(["message", "purpose", "recipient", "company", "prepared"].map((sort) =>
      emailReviewSortColumn(sort as Parameters<typeof emailReviewSortColumn>[0]))).toEqual([
      "message_sort", "purpose_sort", "recipient_sort", "company_sort", "created_at",
    ])
    expect(parseEmailReviewQueueOptions({ reviewSort: "recipient", reviewDirection: "desc" }))
      .toMatchObject({ sort: "recipient", direction: "desc" })
  })

  it("treats SQL wildcard characters as literal search text", () => {
    expect(emailReviewSearchPattern("20%_\\")).toBe("%20\\%\\_\\\\%")
  })

  it("selects only pending REAL reviews for future page-scoped operations", () => {
    expect(isEmailReviewSelectable(row)).toBe(true)
    expect(isEmailReviewSelectable({ ...row, state: "uncertain" })).toBe(false)
    expect(isEmailReviewSelectable({ ...row, state: "sent" })).toBe(false)
    expect(isEmailReviewSelectable({ ...row, namespace: "DEMO" })).toBe(false)
  })

  it("builds a review path only from one valid UUID segment", () => {
    expect(emailReviewDetailPath(row.id)).toBe(`/emails/review/${row.id}`)
    for (const hostileId of [
      "javascript:alert(1)", "//example.invalid/escape", "../dashboard",
      `${row.id}?next=https://example.invalid`, `${row.id}/../../../dashboard`, "%2F%2Fexample.invalid",
    ]) {
      expect(emailReviewDetailPath(hostileId)).toBeNull()
    }
  })
})
