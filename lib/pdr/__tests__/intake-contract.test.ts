import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(process.cwd())
const source = (path: string) => readFileSync(resolve(root, path), "utf8")

describe("Strategic PDR intake/history boundary", () => {
  it("keeps the PDR adapter server-only and suppresses legacy attachment URLs", () => {
    const adapter = source("lib/pdr/intake-server.ts")
    expect(adapter).toContain('import "server-only"')
    expect(adapter).not.toContain(".select(\"*\")")
    expect(adapter).not.toContain("data.attachments")
    expect(adapter).toContain("wave_pdr_history_attachments")
  })

  it("enforces staff access and the explicit Ivan capability independently of UI", () => {
    const actions = source("lib/actions/strategic-pdr.ts")
    expect(actions.match(/requireStaffAccess\(\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(actions).toContain("canDispositionPdr(access.user.id)")
    expect(actions).toContain("Only Ivan can disposition Strategic PDR intake.")
    expect(actions).toContain('eq("status", PDR_DISPOSITIONABLE_PROPOSAL_STATUS)')
    expect(actions).toContain('eq("requester_actor", "Staff")')
  })

  it("uses the same narrow disposition eligibility gate in the request UI", () => {
    const detail = source("app/(dashboard)/strategic-pdr/requests/[requestId]/page.tsx")
    expect(detail).toContain("isDispositionEligiblePdrRequest")
    expect(detail).toContain("canDisposition && dispositionEligible")
  })

  it("uses a server-proxied private attachment download", () => {
    const route = source("app/api/strategic-pdr/attachments/[attachmentId]/route.ts")
    expect(route).toContain("getCurrentUserAccessFromHeaders")
    expect(route).toContain('access.role !== "staff"')
    expect(route).toContain("createSignedUrl")
    expect(route).toContain("proxyPrivateSignedStorageDownload")
  })

  it("keeps non-breaking foundation separate from the final PDR retirement gate", () => {
    const foundation = source("supabase/migrations/20260830113000_wave_pdr_staff_intake_foundation.sql")
    const retirement = source("supabase/migrations/20260830113100_wave_pdr_final_retirement.sql")
    expect(foundation).toContain("wave_pdr_governance_capabilities")
    expect(foundation).toContain("pdr-intake-attachments")
    expect(retirement).toContain("REVOKE ALL ON TABLE public.pdr_feedback")
    expect(retirement).toContain("FROM PUBLIC, anon, authenticated")
    expect(retirement).toContain("wave_pdr_historical_work_cards_are_read_only")
    expect(retirement).toContain("pdr_legacy_attachments_not_fully_private")
  })
})
