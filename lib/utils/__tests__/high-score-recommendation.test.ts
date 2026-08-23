import { describe, expect, it } from "vitest"
import { isHighScoreRecommendation } from "../scoring-v2"

describe("isHighScoreRecommendation", () => {
  it("is true only for Deal Flow and priority interview", () => {
    expect(isHighScoreRecommendation("deal_flow")).toBe(true)
    expect(isHighScoreRecommendation("priority_interview")).toBe(true)
    expect(isHighScoreRecommendation("interview")).toBe(false)
    expect(isHighScoreRecommendation("starter_pack")).toBe(false)
  })
})
