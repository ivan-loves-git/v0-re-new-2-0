import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

describe("PDR GitHub Product Change provenance contract", () => {
  it("requires one complete canonical immutable link without rewriting history", () => {
    const migration = source("supabase/migrations/20260830130040_wave_pdr_github_product_change_provenance.sql")
    expect(migration).toContain("github_product_change_number INTEGER")
    expect(migration).toContain("github_product_change_number IS NOT NULL")
    expect(migration).toContain("github_product_change_url IS NOT NULL")
    expect(migration).toContain("github_product_change_correlation_id IS NOT NULL")
    expect(migration).toContain("github_product_change_linked_at IS NOT NULL")
    expect(migration).toContain("github_product_change_linked_by IS NOT NULL")
    expect(migration).toContain("https://github.com/re-new-team/renew-governance/issues/")
    expect(migration).toContain("wave-pdr-proposal:")
    expect(migration).toContain("pdr_proposals_github_product_change_number_unique")
    expect(migration).toContain("pdr_proposals_github_product_change_correlation_unique")
    expect(migration).toContain("BEFORE UPDATE OF github_product_change_number")
    expect(migration).toContain("wave_pdr_product_change_provenance_immutable")
    expect(migration).toContain("SET search_path = ''")
    expect(migration).not.toContain("UPDATE public.pdr_proposals")
  })

  it("renders a discussion link only when the adapter projects provenance", () => {
    const page = source("app/(dashboard)/strategic-pdr/requests/[requestId]/page.tsx")
    expect(page).toContain("request.githubProductChange ?")
    expect(page).toContain("Open / discuss Product Change #")
    expect(page).toContain("in GitHub")
  })
})
