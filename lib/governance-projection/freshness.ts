export const GOVERNANCE_PROJECTION_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Keeps the clock read outside React render while preserving a strict 24h gate. */
export function isGovernanceProjectionStale(
  snapshotAt: string,
  nowMs = Date.now(),
) {
  const snapshotMs = new Date(snapshotAt).valueOf();
  return !Number.isFinite(snapshotMs) || nowMs - snapshotMs > GOVERNANCE_PROJECTION_STALE_AFTER_MS;
}
