export type ExternalPursuitOperationLockToken = string

export type ExternalPursuitOperationLockChange = Readonly<{
  token: ExternalPursuitOperationLockToken
  delta: 1 | -1
}>

export type ExternalPursuitOperationLockHandler = (
  change: ExternalPursuitOperationLockChange,
) => void

export type ExternalPursuitOperationLocks = ReadonlyMap<
  ExternalPursuitOperationLockToken,
  number
>

/**
 * Compose independent child locks without allowing one child to release a
 * lock held by another. Counts also make repeated acquisition by one token
 * safe until every matching release has arrived.
 */
export function updateExternalPursuitOperationLocks(
  current: ExternalPursuitOperationLocks,
  change: ExternalPursuitOperationLockChange,
) {
  const next = new Map(current)
  const count = next.get(change.token) ?? 0

  if (change.delta === 1) {
    next.set(change.token, count + 1)
  } else if (count <= 1) {
    next.delete(change.token)
  } else {
    next.set(change.token, count - 1)
  }

  return next
}

export function hasExternalPursuitOperationLocks(
  locks: ExternalPursuitOperationLocks,
) {
  return locks.size > 0
}
