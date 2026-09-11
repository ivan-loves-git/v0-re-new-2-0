import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"
import { InterviewReminderEmail } from "@/lib/email/templates/interview-reminder"

describe("interview reminder privacy", () => {
  it("does not expose generic activity notes", async () => {
    const html = await render(InterviewReminderEmail({ repreneur: { id: "id", firstName: "Camille", lastName: "Test", email: "camille@example.test" }, metadata: { interviewAt: "2026-09-14", notes: "internal-only secret" } }))
    expect(html).not.toContain("internal-only secret")
    expect(html).toContain("14")
  })
  it("requires a real scheduled date", () => {
    expect(() => InterviewReminderEmail({ repreneur: { id: "id", firstName: "Camille", lastName: "Test", email: "camille@example.test" } })).toThrow("scheduled date")
  })
})
