import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  GOVERNANCE_PROJECTION_SCHEMA_VERSION,
  GOVERNANCE_SOURCE_REPOSITORY,
  governanceProjectionDigest,
  type GovernanceProjection,
} from "@/lib/governance-projection/model";

export type CurrentGovernanceProjection =
  | { state: "unavailable"; reason: "no_snapshot" | "read_failed" }
  | {
      state: "available";
      snapshotId: string;
      digest: string;
      projection: GovernanceProjection;
    };

/** The sole WAVE/AI read seam. It never contacts GitHub or falls back to PDR. */
export async function readCurrentGovernanceProjection(): Promise<CurrentGovernanceProjection> {
  const client = createAdminClient();
  const { data, error } = await client
    .from("wave_governance_projection_current_read")
    .select(
      "snapshot_id, snapshot_digest, payload, validation, retrieved_at, snapshot_at",
    )
    .eq("projection_key", "current")
    .maybeSingle();
  if (error) return { state: "unavailable", reason: "read_failed" };
  if (!data) return { state: "unavailable", reason: "no_snapshot" };
  const projection = data.payload as GovernanceProjection;
  if (
    !projection ||
    projection.schemaVersion !== GOVERNANCE_PROJECTION_SCHEMA_VERSION ||
    projection.sourceRepository !== GOVERNANCE_SOURCE_REPOSITORY ||
    !Array.isArray(projection.issues) ||
    !Array.isArray(projection.legacyExclusions) ||
    typeof data.snapshot_digest !== "string" ||
    governanceProjectionDigest(projection) !== data.snapshot_digest
  )
    return { state: "unavailable", reason: "read_failed" };
  return {
    state: "available",
    snapshotId: data.snapshot_id as string,
    digest: data.snapshot_digest as string,
    projection,
  };
}
