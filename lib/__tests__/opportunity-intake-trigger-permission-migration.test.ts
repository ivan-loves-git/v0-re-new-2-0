import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL(
    "../../scripts/089_opportunity_source_guard_execution_context.sql",
    import.meta.url,
  ),
  "utf8",
)

describe("opportunity intake source guard execution context", () => {
  it("runs the trigger guard as its owner without exposing the private ledger", () => {
    expect(migration).toContain(
      "ALTER FUNCTION public.guard_ma_interaction_opportunity_source_office()\n  SECURITY DEFINER",
    )
    expect(migration).toContain("SET search_path = ''")
    expect(migration).toContain(
      "FROM PUBLIC, anon, authenticated, service_role",
    )
    expect(migration).not.toMatch(
      /GRANT\s+(SELECT|INSERT|UPDATE|DELETE)[\s\S]*ma_source_email_send_reservations/i,
    )
  })
})
