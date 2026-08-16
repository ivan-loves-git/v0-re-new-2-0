import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  externalPursuitFollowUpAttempt,
  externalPursuitFollowUpPatch,
} from "@/lib/external-pursuit-follow-up"

const baseline = {
  availability: "unknown" as const,
  nextAction: "Call the intermediary",
  responsibleParty: "owner" as const,
  dueAt: "2026-08-18",
  sharedNotes: "Original shared note",
  staffInternalNotes: "Original staff note",
}

describe("External Pursuit follow-up behavior", () => {
  it("sends only dirty fields and keeps the action pair atomic", () => {
    expect(externalPursuitFollowUpPatch(baseline, {
      ...baseline,
      nextAction: "Request the information memorandum",
    }, "staff")).toEqual({
      nextAction: "Request the information memorandum",
      responsibleParty: "owner",
    })
  })

  it("does not let a stale shared-note save overwrite a concurrent availability change", () => {
    expect(externalPursuitFollowUpPatch(baseline, {
      ...baseline,
      sharedNotes: "Owner added context",
    }, "repreneur")).toEqual({ sharedNotes: "Owner added context" })
  })

  it("retains the idempotency key after a lost response and rotates it for a changed payload", () => {
    const makeKey = vi.fn().mockReturnValueOnce("attempt-1").mockReturnValueOnce("attempt-2")
    const patch = { sharedNotes: "Owner added context" }
    const first = externalPursuitFollowUpAttempt(null, patch, makeKey)
    const retry = externalPursuitFollowUpAttempt(first, patch, makeKey)
    const changed = externalPursuitFollowUpAttempt(retry, { sharedNotes: "New context" }, makeKey)
    expect(first).toEqual(retry)
    expect(changed.idempotencyKey).toBe("attempt-2")
    expect(makeKey).toHaveBeenCalledTimes(2)
  })

  it("exposes one clean panel mount contract without owning a route", () => {
    const source = readFileSync(join(process.cwd(), "components/pursuits/external-pursuit-follow-up-panel.tsx"), "utf8")
    expect(source).toContain("ExternalPursuitFollowUpPanelProps")
    expect(source).toContain("followUp: ExternalPursuitFollowUpSnapshot")
    expect(source).toContain("updateExternalPursuitFollowUp(pursuitId, patch, attempt.idempotencyKey)")
    expect(source.indexOf("if (!result.success)")).toBeLessThan(source.indexOf("attemptRef.current = null"))
    expect(source).not.toContain("p_title")
    expect(source).not.toContain("p_stage")
  })

  it("rehearses 093 through 096 in order and preserves every W-106 detail field", () => {
    const rehearsal = readFileSync(join(process.cwd(), "scripts/rehearse-external-pursuit-follow-up.sql"), "utf8")
    const migration = readFileSync(join(process.cwd(), "scripts/096_external_pursuit_follow_up.sql"), "utf8")
    expect(rehearsal.indexOf("093_external_pursuit_foundation.sql")).toBeLessThan(rehearsal.indexOf("094_external_pursuit_service_role_privilege_hardening.sql"))
    expect(rehearsal.indexOf("094_external_pursuit_service_role_privilege_hardening.sql")).toBeLessThan(rehearsal.indexOf("095_external_pursuit_board.sql"))
    expect(rehearsal.indexOf("095_external_pursuit_board.sql")).toBeLessThan(rehearsal.indexOf("096_external_pursuit_follow_up.sql"))
    for (const field of ["external_url", "target_company", "source_channel", "revenue_meur", "ebitda_keur", "headcount"]) {
      expect(migration).toContain(`'${field}',p.${field}`)
    }
  })
})
