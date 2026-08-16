import type {
  ExternalPursuitFollowUpInput,
  ExternalPursuitFollowUpSnapshot,
} from "@/lib/types/external-pursuit"

export type FollowUpRole = "staff" | "repreneur"

function nullableText(value: string | null | undefined) {
  return value ?? ""
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return nullableText(left) === nullableText(right)
}

/**
 * Produces a true patch. A stale form therefore cannot write an untouched
 * field over a more recent staff/owner change. Next action and responsibility
 * remain one atomic pair even when just one of the two controls changed.
 */
export function externalPursuitFollowUpPatch(
  baseline: ExternalPursuitFollowUpSnapshot,
  current: ExternalPursuitFollowUpSnapshot,
  role: FollowUpRole,
): ExternalPursuitFollowUpInput | null {
  const patch: ExternalPursuitFollowUpInput = {}
  if (!sameText(baseline.nextAction, current.nextAction)
    || baseline.responsibleParty !== current.responsibleParty) {
    patch.nextAction = current.nextAction?.trim() || null
    patch.responsibleParty = current.responsibleParty ?? null
  }
  if (baseline.availability !== current.availability) patch.availability = current.availability
  if (!sameText(baseline.dueAt, current.dueAt)) patch.dueAt = current.dueAt || null
  if (!sameText(baseline.sharedNotes, current.sharedNotes)) patch.sharedNotes = current.sharedNotes ?? null
  if (role === "staff" && !sameText(baseline.staffInternalNotes, current.staffInternalNotes)) {
    patch.staffInternalNotes = current.staffInternalNotes ?? null
  }
  return Object.keys(patch).length > 0 ? patch : null
}

export type FollowUpAttempt = {
  fingerprint: string
  idempotencyKey: string
  patch: ExternalPursuitFollowUpInput
  snapshot: ExternalPursuitFollowUpSnapshot
}

/** Retains one key for the same payload until the caller confirms success. */
export function externalPursuitFollowUpAttempt(
  previous: FollowUpAttempt | null,
  patch: ExternalPursuitFollowUpInput,
  snapshot: ExternalPursuitFollowUpSnapshot,
  makeKey: () => string,
): FollowUpAttempt {
  const fingerprint = JSON.stringify(patch)
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, idempotencyKey: makeKey(), patch, snapshot }
}

/**
 * Once transport makes a result ambiguous, only the exact attempted request is
 * eligible. Current controls are deliberately ignored until that request is
 * confirmed, so reverting or adding another edit cannot bypass recovery.
 */
export function externalPursuitFollowUpSubmission({
  recovery,
  previous,
  baseline,
  current,
  role,
  makeKey,
}: {
  recovery: FollowUpAttempt | null
  previous: FollowUpAttempt | null
  baseline: ExternalPursuitFollowUpSnapshot
  current: ExternalPursuitFollowUpSnapshot
  role: FollowUpRole
  makeKey: () => string
}): FollowUpAttempt | null {
  if (recovery) return recovery
  const patch = externalPursuitFollowUpPatch(baseline, current, role)
  return patch ? externalPursuitFollowUpAttempt(previous, patch, current, makeKey) : null
}
