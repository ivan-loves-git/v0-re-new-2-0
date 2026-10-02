import { describe, expect, it, vi } from "vitest"
import {
  initialReviewSearch,
  emailReviewSelectionContext,
  reviewQueueNavigationParams,
  reviewSearchReducer,
  readReviewedMessageForConfirmation,
} from "@/lib/email/review-ui-transitions"

describe("review queue search navigation", () => {
  it("preserves selection across pure reorder only while the same visible IDs, versions and eligibility context remain", () => {
    const options = {
      view: "active" as const,
      page: 1,
      search: "",
      purpose: "all" as const,
      sort: "prepared" as const,
      direction: "asc" as const,
    }
    const rows = [
      {
        id: "review-a",
        version: 1,
        archived_at: null,
        state: "pending" as const,
        archive_eligible: true,
      },
      {
        id: "review-b",
        version: 2,
        archived_at: null,
        state: "pending" as const,
        archive_eligible: true,
      },
    ]
    const context = emailReviewSelectionContext(options, rows)
    expect(
      emailReviewSelectionContext(
        { ...options, sort: "recipient", direction: "desc" },
        [...rows].reverse(),
      ),
    ).toBe(context)
    expect(
      emailReviewSelectionContext(options, [
        { ...rows[0], version: 2 },
        rows[1],
      ]),
    ).not.toBe(context)
    expect(
      emailReviewSelectionContext(options, [
        { ...rows[0], archive_eligible: false },
        rows[1],
      ]),
    ).not.toBe(context)
    expect(emailReviewSelectionContext(options, rows.slice(1))).not.toBe(
      context,
    )
    expect(
      emailReviewSelectionContext({ ...options, search: "new" }, rows),
    ).not.toBe(context)
  })
  it("keeps the saved manifest and view/sort context while a new search returns to page one", () => {
    const params = reviewQueueNavigationParams(
      "reviewBatch=saved-manifest&tab=review",
      {
        view: "archived",
        page: 3,
        search: "old",
        purpose: "ma_process_follow_up",
        sort: "recipient",
        direction: "desc",
      },
      "new",
      { reviewPage: "4" },
    )
    expect(params.get("reviewBatch")).toBe("saved-manifest")
    expect(params.get("tab")).toBe("review")
    expect(params.get("reviewSearch")).toBe("new")
    expect(params.has("reviewPage")).toBe(false)
    expect(params.get("reviewFilter")).toBe("archived")
    expect(params.get("reviewPurpose")).toBe("ma_process_follow_up")
    expect(params.get("reviewDirection")).toBe("desc")
  })
  it("retains newer input when an older submitted search settles", () => {
    let state = initialReviewSearch("")
    state = reviewSearchReducer(state, { type: "typed", value: "older" })
    state = reviewSearchReducer(state, { type: "submitted", value: "older" })
    state = reviewSearchReducer(state, { type: "typed", value: "newer" })
    state = reviewSearchReducer(state, { type: "url", value: "older" })
    expect(state.value).toBe("newer")
    expect(state.urlValue).toBe("older")
  })
  it("retains newer typing when an older double-space search settles in canonical form", () => {
    let state = initialReviewSearch("")
    state = reviewSearchReducer(state, { type: "typed", value: "Adam  Smith" })
    state = reviewSearchReducer(state, {
      type: "submitted",
      value: "Adam  Smith",
    })
    state = reviewSearchReducer(state, {
      type: "typed",
      value: "Adam  Smith Jr",
    })
    state = reviewSearchReducer(state, { type: "url", value: "Adam Smith" })
    expect(state.value).toBe("Adam  Smith Jr")
    expect(state.urlValue).toBe("Adam Smith")
    const params = reviewQueueNavigationParams(
      "",
      {
        view: "active",
        page: 1,
        search: "",
        purpose: "all",
        sort: "prepared",
        direction: "asc",
      },
      "Adam  Smith Jr",
      { reviewPage: null },
    )
    expect(params.get("reviewSearch")).toBe("Adam Smith Jr")
  })
  it("accepts back/forward URL navigation and retires outstanding input requests", () => {
    let state = initialReviewSearch("previous")
    state = reviewSearchReducer(state, { type: "typed", value: "newer" })
    state = reviewSearchReducer(state, { type: "submitted", value: "newer" })
    state = reviewSearchReducer(state, { type: "history", value: "" })
    expect(state.value).toBe("")
    expect(state.urlValue).toBe("")
    expect(state.submitted).toEqual({})
    state = reviewSearchReducer(state, { type: "url", value: "" })
    expect(state.value).toBe("")
  })
})

describe("canonical edited-message handoff to confirmation", () => {
  const review = {
    id: "review-1",
    version: 4,
    subject: "Retained subject",
    body_text: "Retained complete body",
    state: "pending",
  }
  it("saves with the old CAS version, reads the exact saved version and never sends or acknowledges", async () => {
    const saved = {
      review: {
        ...review,
        version: 5,
        subject: "Edited subject",
        body_text: "Edited complete body",
      },
    }
    const edit = vi.fn().mockResolvedValue({ success: true })
    const read = vi.fn().mockResolvedValue(saved)
    const record = await readReviewedMessageForConfirmation(
      review,
      "Edited subject",
      "Edited complete body",
      { edit, read },
    )
    expect(edit).toHaveBeenCalledWith(
      "review-1",
      4,
      "Edited subject",
      "Edited complete body",
    )
    expect(read).toHaveBeenCalledWith("review-1")
    expect(record).toBe(saved)
  })
  it("keeps a failed save or concurrent content/version change out of confirmation", async () => {
    const read = vi.fn()
    await expect(
      readReviewedMessageForConfirmation(
        review,
        "Edited subject",
        "Edited complete body",
        {
          edit: vi.fn().mockRejectedValue(new Error("CAS changed")),
          read,
        },
      ),
    ).rejects.toThrow("CAS changed")
    expect(read).not.toHaveBeenCalled()
    await expect(
      readReviewedMessageForConfirmation(
        review,
        "Edited subject",
        "Edited complete body",
        {
          edit: vi.fn().mockResolvedValue({ success: true }),
          read: vi.fn().mockResolvedValue({
            review: {
              ...review,
              version: 6,
              subject: "Someone else's words",
            },
          }),
        },
      ),
    ).rejects.toThrow("changed")
  })
  it("shows the exact canonical trimming result while preserving internal newlines", async () => {
    const saved = {
      review: {
        ...review,
        version: 5,
        subject: "Saved subject",
        body_text: "Line one\n\nLine two",
      },
    }
    const result = await readReviewedMessageForConfirmation(
      review,
      "  Saved subject  ",
      "  Line one\n\nLine two  ",
      {
        edit: vi.fn().mockResolvedValue({ success: true }),
        read: vi.fn().mockResolvedValue(saved),
      },
    )
    expect(result.review.body_text).toBe("Line one\n\nLine two")
  })
})
