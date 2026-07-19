import { describe, expect, it } from "vitest"
import { businessDaysSince, deriveMaWorkflowRecommendation } from "@/lib/utils/ma-workflow-recommendations"

const now = new Date("2026-06-11T12:00:00.000Z")

const baseOpportunity = {
  status: "active",
  date_added: "2026-06-01T12:00:00.000Z",
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: "2026-06-01T12:00:00.000Z",
}

const baseActiveMatch = {
  pursuit_stage: "interest",
  pursuit_stage_updated_at: "2026-06-04T12:00:00.000Z",
  updated_at: "2026-06-04T12:00:00.000Z",
}

describe("businessDaysSince", () => {
  it("counts weekdays and skips weekends", () => {
    expect(businessDaysSince("2026-06-04T12:00:00.000Z", now)).toBe(5)
  })
})

describe("deriveMaWorkflowRecommendation", () => {
  it("recommends an NDA/info memo request after five business days in an active pursuit", () => {
    const recommendation = deriveMaWorkflowRecommendation({
      opportunity: baseOpportunity,
      activeMatch: baseActiveMatch,
      interactions: [],
      now,
    })

    expect(recommendation?.templateKey).toBe("ma_nda_info_memo_request")
    expect(recommendation?.title).toBe("5-business-day NDA/info memo request due")
  })

  it("recommends a process follow-up when the NDA/info memo request was already sent", () => {
    const recommendation = deriveMaWorkflowRecommendation({
      opportunity: baseOpportunity,
      activeMatch: baseActiveMatch,
      interactions: [
        {
          template_key: "ma_nda_info_memo_request",
          status: "sent",
          sent_at: "2026-06-04T12:00:00.000Z",
          created_at: "2026-06-04T12:00:00.000Z",
        },
      ],
      now,
    })

    expect(recommendation?.templateKey).toBe("ma_process_follow_up")
    expect(recommendation?.title).toBe("5-business-day NDA/info memo follow-up due")
  })

  it("does not treat the info-memo stage as complete without a real memo file", () => {
    const recommendation = deriveMaWorkflowRecommendation({
      opportunity: baseOpportunity,
      activeMatch: { ...baseActiveMatch, pursuit_stage: "info_memo_received" },
      interactions: [],
      memoAvailable: false,
      now,
    })

    expect(recommendation?.templateKey).toBe("ma_nda_info_memo_request")
  })

  it("stops NDA/info-memo messaging when an actual memo is available", () => {
    const recommendation = deriveMaWorkflowRecommendation({
      opportunity: baseOpportunity,
      activeMatch: baseActiveMatch,
      interactions: [],
      memoAvailable: true,
      now,
    })

    expect(recommendation).toBeNull()
  })

  it("recommends a first opportunity freshness check after 90 calendar days", () => {
    const recommendation = deriveMaWorkflowRecommendation({
      opportunity: {
        ...baseOpportunity,
        date_added: "2026-03-01T12:00:00.000Z",
        created_at: "2026-03-01T12:00:00.000Z",
        updated_at: "2026-03-01T12:00:00.000Z",
      },
      activeMatch: null,
      interactions: [],
      now,
    })

    expect(recommendation?.templateKey).toBe("ma_opportunity_validity_check")
    expect(recommendation?.title).toBe("3-month opportunity freshness check due")
  })

  it("recommends a monthly source re-check after the last validity check ages out", () => {
    const recommendation = deriveMaWorkflowRecommendation({
      opportunity: {
        ...baseOpportunity,
        date_added: "2026-01-01T12:00:00.000Z",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
      },
      activeMatch: null,
      interactions: [
        {
          template_key: "ma_opportunity_validity_check",
          status: "sent",
          sent_at: "2026-05-01T12:00:00.000Z",
          created_at: "2026-05-01T12:00:00.000Z",
        },
      ],
      now,
    })

    expect(recommendation?.templateKey).toBe("ma_opportunity_validity_check")
    expect(recommendation?.title).toBe("Monthly M&A source re-check due")
  })

  it("does not recommend source freshness checks for closed opportunities", () => {
    const recommendation = deriveMaWorkflowRecommendation({
      opportunity: {
        ...baseOpportunity,
        status: "closed",
        date_added: "2026-01-01T12:00:00.000Z",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
      },
      activeMatch: null,
      interactions: [],
      now,
    })

    expect(recommendation).toBeNull()
  })
})
