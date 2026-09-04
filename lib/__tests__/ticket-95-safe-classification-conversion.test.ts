import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DemoClassificationLockNotice } from "@/components/demo-classification-control-state"
import {
  DEMO_CLASSIFICATION_MATCH_LOCK_MESSAGE,
  demoClassificationMutationRow,
  demoClassificationWriteErrorMessage,
} from "@/lib/demo-classification"

describe("safe REAL/DEMO classification conversion", () => {
  it("turns database lock errors into the same plain-language matched-state explanation", () => {
    for (const message of [
      "ticket_95_classification_locked",
      "w164_matched_opportunity_reclassification_denied",
      "w164_matched_repreneur_reclassification_denied",
    ]) {
      expect(
        demoClassificationWriteErrorMessage({ message }, "opportunity"),
      ).toBe(DEMO_CLASSIFICATION_MATCH_LOCK_MESSAGE)
    }
  })

  it("never exposes an unexpected database error to staff", () => {
    expect(
      demoClassificationWriteErrorMessage(
        { message: "private_table_detail: endpoint=9500" },
        "repreneur",
      ),
    ).toBe("We could not update this repreneur classification. Please try again.")
  })

  it("accepts only a complete persisted RPC readback", () => {
    expect(
      demoClassificationMutationRow([
        {
          entity_id: "entity-1",
          is_demo: true,
          changed: true,
          changed_at: "2026-09-04T13:00:00.000Z",
          changed_by: "staff-1",
        },
      ]),
    ).toEqual({
      entity_id: "entity-1",
      is_demo: true,
      changed: true,
      changed_at: "2026-09-04T13:00:00.000Z",
      changed_by: "staff-1",
    })
    expect(demoClassificationMutationRow([])).toBeNull()
    expect(demoClassificationMutationRow({ entity_id: "entity-1" })).toBeNull()
  })

  it("renders match history as a non-actionable locked state with attribution", () => {
    const html = renderToStaticMarkup(
      createElement(DemoClassificationLockNotice, {
        state: {
          lockReason: "matched",
          updatedAt: "2026-09-04T13:00:00.000Z",
          updatedByLabel: "staff-member",
        },
      }),
    )

    expect(html).toContain("Classification locked")
    expect(html).toContain("match history")
    expect(html).toContain("separately reviewed data-treatment plan")
    expect(html).toContain("staff-member")
    expect(html).toContain('dateTime="2026-09-04T13:00:00.000Z"')
    expect(html).not.toContain("<button")
  })

  it("fails the UI closed when match history cannot be verified", () => {
    const html = renderToStaticMarkup(
      createElement(DemoClassificationLockNotice, {
        state: {
          lockReason: "unavailable",
          updatedAt: null,
          updatedByLabel: null,
        },
      }),
    )

    expect(html).toContain("temporarily locked")
    expect(html).toContain("could not verify")
    expect(html).not.toContain("<button")
  })
})
