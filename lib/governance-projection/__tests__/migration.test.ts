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

  it("keeps v2 validation time on the current pointer and rejects missing schema or unsafe collection time", () => {
    const v2 = readFileSync(join(process.cwd(), "supabase/migrations/20260927160000_wave_governance_projection_v2.sql"), "utf8");
    expect(v2).toContain("ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ");
    expect(v2).toContain("SET last_validated_at=GREATEST(c.last_validated_at,p_retrieved_at)");
    expect(v2).toContain("last_validated_at=EXCLUDED.last_validated_at");
    expect(v2).toContain("p_validation->>'schema_version' IS NULL");
    expect(v2).toContain("p_payload->>'schemaVersion' IS NULL");
    expect(v2).toContain("p_retrieved_at > p_snapshot_at");
    expect(v2).toContain("p_snapshot_at > clock_timestamp() + interval '5 minutes'");
    expect(v2).not.toContain("UPDATE public.wave_governance_snapshots");
  });
});
