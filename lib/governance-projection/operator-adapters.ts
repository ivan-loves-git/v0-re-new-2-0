import type { ProjectionRefreshAdapters } from "@/lib/governance-projection/refresh";

type QueryResult = Promise<{
  data: { snapshot_digest?: string } | null;
  error: unknown;
}>;
type ApplyRow = {
  snapshot_id: string;
  snapshot_digest: string;
  applied: boolean;
};
const SNAPSHOT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[0-9a-f]{64}$/i;

export type ProjectionOperatorClient = {
  from(table: "wave_governance_projection_current"): {
    select(columns: "snapshot_digest"): {
      eq(column: "projection_key", value: "current"): {
        maybeSingle(): QueryResult;
        single(): QueryResult;
      };
    };
  };
  rpc(
    name: "apply_wave_governance_snapshot",
    input: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
};

/** Maps provider errors to stable operator messages; raw provider bodies never escape the command. */
export function createProjectionOperatorAdapters(
  client: ProjectionOperatorClient,
  collect: ProjectionRefreshAdapters["collect"],
): ProjectionRefreshAdapters {
  const current = () =>
    client
      .from("wave_governance_projection_current")
      .select("snapshot_digest")
      .eq("projection_key", "current");
  return {
    collect,
    currentDigest: async () => {
      const { data, error } = await current().maybeSingle();
      if (error) throw new Error("cannot read current snapshot");
      return data?.snapshot_digest ?? "";
    },
    apply: async ({ projection, digest, canonicalText, expectedDigest }) => {
      const { data, error } = await client.rpc("apply_wave_governance_snapshot", {
        p_source_commit: projection.sourceCommit,
        p_registry_revision: projection.registryRevision,
        p_retrieved_at: projection.retrievedAt,
        p_snapshot_at: projection.snapshotAt,
        p_payload: projection,
        p_validation: { result: "valid", schema_version: projection.schemaVersion },
        p_canonical_text: canonicalText,
        p_snapshot_digest: digest,
        p_expected_current_digest: expectedDigest,
        p_actor: "codex-manual-governance-refresh",
      });
      if (
        error ||
        !Array.isArray(data) ||
        data.length !== 1 ||
        !data[0] ||
        typeof data[0] !== "object"
      )
        throw new Error("snapshot apply failed");
      const row = data[0] as Partial<ApplyRow>;
      if (
        typeof row.snapshot_id !== "string" ||
        !SNAPSHOT_ID.test(row.snapshot_id) ||
        typeof row.snapshot_digest !== "string" ||
        !DIGEST.test(row.snapshot_digest) ||
        typeof row.applied !== "boolean"
      )
        throw new Error("snapshot apply failed");
      return { digest: row.snapshot_digest, applied: row.applied };
    },
    readback: async () => {
      const { data, error } = await current().single();
      if (error || !data?.snapshot_digest)
        throw new Error("snapshot readback failed");
      return data.snapshot_digest;
    },
  };
}
