export const GOVERNANCE_PROJECTION_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Keeps the clock read outside React render while preserving a strict 24h gate. */
export function isGovernanceProjectionStale(
  lastValidatedAt: string,
  nowMs = Date.now(),
) {
  const validatedMs = new Date(lastValidatedAt).valueOf();
  return !Number.isFinite(validatedMs) || nowMs - validatedMs > GOVERNANCE_PROJECTION_STALE_AFTER_MS;
}
