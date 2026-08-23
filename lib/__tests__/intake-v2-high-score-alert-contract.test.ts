import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("intake v2 high-score alert contract", () => {
  const source = readFileSync(
    resolve(process.cwd(), "lib/actions/intake-v2.ts"),
    "utf8",
  )

  it("sends the high-score alert after welcome, only for priority recommendations", () => {
    expect(source).toContain("isHighScoreRecommendation")
    expect(source).toContain('templateKey: "high_score_alert"')
    expect(source).toContain("HighScoreAlertEmail")
    expect(source.indexOf("WelcomeEmail")).toBeLessThan(source.indexOf("HighScoreAlertEmail"))
    expect(source).not.toContain("TODO: Send high score alert")
  })
})
