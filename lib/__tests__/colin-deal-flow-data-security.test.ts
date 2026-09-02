import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Colin Deal Flow data and audit hardening", () => {
  const migration = source(
    "supabase/migrations/20260902202154_colin_data_security_corrections.sql",
  );
  const apply = source(
    "scripts/20260902_apply_colin_deal_flow_data_correction.sql",
  );
  const rollback = source(
    "scripts/20260902_rollback_colin_deal_flow_data_correction.sql",
  );

  it("enables RLS only on the five approved immutable audit tables", () => {
    for (const table of [
      "w021_opportunity_publication_events",
      "w021_opportunity_publication_runs",
      "w021_opportunity_publication_rollbacks",
      "w128_draft_activation_runs",
      "w128_draft_activation_rollbacks",
    ]) {
      expect(migration).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      );
    }
    expect(migration).not.toContain("CREATE POLICY");
    expect(migration).not.toContain("GRANT ");
    expect(migration).not.toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("source_identity_to_verify BOOLEAN NOT NULL DEFAULT FALSE");
    expect(migration).toContain("ma_opportunity_source_review_required");
    expect(migration).toContain("RETURN TRUE;");
  });

  it("requires an exact preflight, retains before-images, and does not rewrite source identity", () => {
    expect(apply).toContain("expected_sector_rows CONSTANT INTEGER := 130");
    expect(apply).toContain("expected_active_real_rows CONSTANT INTEGER := 155");
    expect(apply).toContain("expected_canonical_rows CONSTANT INTEGER := 25");
    expect(apply).toContain("colin_data_correction_apply");
    expect(apply).toContain("COALESCE(current_setting('renew.colin_data_correction_apply', true), '')");
    expect(rollback).toContain("COALESCE(current_setting('renew.colin_data_correction_rollback', true), '')");
    expect(apply).toContain("colin_20260902_data_correction");
    expect(apply).toContain(
      "colin_data_correction_source_marker_preflight_failed",
    );
    expect(apply).not.toContain("assign_acme_provisional_source");
    expect(apply).not.toContain("UPDATE public.ma_firms");
    expect(apply).not.toContain("UPDATE public.ma_offices");
    expect(apply).not.toContain("UPDATE public.ma_contacts");
    expect(apply).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(rollback).toContain("rollback_blocked_by_later_edit");
  });
});
