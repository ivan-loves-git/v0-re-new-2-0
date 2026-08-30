import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("WAVE PDR trigger search-path hardening", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260830222500_wave_pdr_trigger_search_path_hardening.sql",
    ),
    "utf8",
  );

  it("pins both production-advisor findings to an empty search path", () => {
    expect(migration).toContain(
      "ALTER FUNCTION public.wave_pdr_proposal_intake_provenance_immutable()",
    );
    expect(migration).toContain(
      "ALTER FUNCTION public.wave_pdr_historical_work_cards_read_only()",
    );
    expect(migration.match(/SET search_path = '';/g)).toHaveLength(2);
  });
});
