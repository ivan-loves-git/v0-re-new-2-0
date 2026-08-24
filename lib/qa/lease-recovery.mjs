const RECOVERABLE_LEASE_STATUSES = new Set(["active", "recovering"])

// This is intentionally narrower than “not active”: an interrupted cleanup
// may leave an expired recovery claim, but a live claim and every unknown
// state remain unavailable until the database says otherwise.
export function isRecoverableExpiredLease(lease, now = Date.now()) {
  if (!RECOVERABLE_LEASE_STATUSES.has(lease?.status)) return false
  const expiresAt = new Date(lease.expires_at).getTime()
  return Number.isFinite(expiresAt) && expiresAt <= now
}
