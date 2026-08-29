import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { validateIntakeTargetThesis } from "@/lib/repreneur-target-thesis"

const platformRoot = process.cwd()
const source = (relativePath: string) => readFileSync(`${platformRoot}/${relativePath}`, "utf8")

describe("W-161 optional absolute EBITDA thesis range", () => {
  it("keeps the same nullable kEUR range in intake, shared saves, and portal reads", () => {
    for (const relativePath of [
      "lib/actions/intake-v2.ts",
      "lib/actions/repreneur-profile.ts",
      "lib/data/portal-profile.ts",
      "components/portal/repreneur-target-thesis-editor.tsx",
    ]) {
      const content = source(relativePath)
      expect(content).toContain("target_ebitda_min_keur")
      expect(content).toContain("target_ebitda_max_keur")
    }
  })

  it("uses the new detail in the Matching 2.1 candidate while allowing it to complete a thesis", () => {
    const scorer = source("lib/utils/opportunity-match-scoring.ts")
    const completeness = source("lib/repreneur-target-thesis-completeness.ts")

    expect(scorer).toContain("target_ebitda_min_keur")
    expect(scorer).toContain("target_ebitda_max_keur")
    expect(scorer).toContain("2.1-candidate-2026-08-29")
    expect(completeness).toContain("target_ebitda_min_keur")
    expect(completeness).toContain("target_ebitda_max_keur")
  })

  it("rejects invalid public-intake targets before any database access and leaves blank bounds optional", () => {
    expect(validateIntakeTargetThesis({
      target_revenue_min_meur: null,
      target_revenue_max_meur: null,
      target_ebitda_min_keur: null,
      target_ebitda_max_keur: null,
      target_ebitda_margin_min_pct: null,
      target_staff_size_min: null,
      target_staff_size_max: null,
    })).toBeNull()
    expect(validateIntakeTargetThesis({
      target_revenue_min_meur: null,
      target_revenue_max_meur: null,
      target_ebitda_min_keur: 500,
      target_ebitda_max_keur: 100,
      target_ebitda_margin_min_pct: null,
      target_staff_size_min: null,
      target_staff_size_max: null,
    })).toBe("La borne minimale d’EBITDA ne peut pas dépasser la borne maximale.")
  })
})
