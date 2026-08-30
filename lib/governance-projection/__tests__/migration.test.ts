import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("governance snapshot migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260830090000_wave_governance_projection.sql",
    ),
    "utf8",
  );
  it("keeps history immutable and the write seam narrowly privileged", () => {
    expect(sql).toContain("wave_governance_snapshot_history_is_immutable");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.wave_governance_snapshots",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.apply_wave_governance_snapshot",
    );
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });
});
