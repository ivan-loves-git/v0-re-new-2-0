import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  `${process.cwd()}/scripts/104_set_based_follow_up_suggestions.sql`,
  "utf8",
)

describe("set-based follow-up suggestions migration", () => {
  it("keeps the 14-day stale-contact calculation, ordering, top ten, and total in one database query", () => {
    expect(migration).toContain("p_now TIMESTAMPTZ")
    expect(migration).toContain("p_now - INTERVAL '14 days'")
    expect(migration).toContain("COUNT(*) OVER ()")
    expect(migration).toContain("ORDER BY days_since_contact DESC, source_updated_at ASC NULLS FIRST, id ASC")
    expect(migration).toContain("LIMIT 10")
    expect(migration).toContain("MAX(n.created_at)")
    expect(migration).toContain("MAX(a.created_at)")
  })

  it("is private to server-side service-role calls and pins the function search path", () => {
    expect(migration).toContain("SECURITY DEFINER")
    expect(migration).toContain("SET search_path = public, pg_temp")
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.get_follow_up_suggestions(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;",
    )
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_follow_up_suggestions(TIMESTAMPTZ) TO service_role;",
    )
  })
})
