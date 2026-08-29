import { createHash } from "node:crypto"

export interface ReviewedPlatformTitle {
  reference: string
  publicTitle: string
}

export interface CurrentOpportunityTitle {
  id: string
  reference: string
  publicTitle: string | null
  isDemo: boolean
}

export type TitleReconciliationOutcome =
  | { kind: "no_op"; reference: string }
  | {
      kind: "guarded_update"
      id: string
      reference: string
      expectedPublicTitle: string | null
      nextPublicTitle: string
    }
  | { kind: "blocker"; reference: string }
  | { kind: "conflict"; reference: string }

export interface TitleReconciliationSummary {
  noOps: number
  guardedUpdates: number
  blockers: number
  conflicts: number
}

export const W163_RECEIPT_FORMAT = "w163-private-dry-run-receipt/v1"

export interface W163PrivateDryRunReceipt {
  format: typeof W163_RECEIPT_FORMAT
  sourceDigest: string
  aggregate: {
    reviewedTargets: number
    noOps: number
    guardedUpdates: number
    blockers: number
    conflicts: number
  }
  stateFingerprint: string
}

function canonicalTargetState(
  reviewedTitles: readonly ReviewedPlatformTitle[],
  currentOpportunities: readonly CurrentOpportunityTitle[],
) {
  const currentByReference = new Map<string, CurrentOpportunityTitle[]>()
  for (const current of currentOpportunities) {
    const matches = currentByReference.get(current.reference) ?? []
    matches.push(current)
    currentByReference.set(current.reference, matches)
  }

  return [...reviewedTitles]
    .sort((left, right) => left.reference.localeCompare(right.reference))
    .map((reviewed) => ({
      reference: reviewed.reference,
      reviewedPublicTitle: reviewed.publicTitle,
      matches: [...(currentByReference.get(reviewed.reference) ?? [])]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((current) => ({
          id: current.id,
          reference: current.reference,
          publicTitle: current.publicTitle,
          isDemo: current.isDemo,
        })),
    }))
}

export function fingerprintW163ResolvedTargetState(
  reviewedTitles: readonly ReviewedPlatformTitle[],
  currentOpportunities: readonly CurrentOpportunityTitle[],
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalTargetState(reviewedTitles, currentOpportunities)))
    .digest("hex")
}

export function createW163PrivateDryRunReceipt(
  sourceDigest: string,
  reviewedTitles: readonly ReviewedPlatformTitle[],
  currentOpportunities: readonly CurrentOpportunityTitle[],
): W163PrivateDryRunReceipt {
  const { summary } = reconcileReviewedPlatformTitles(reviewedTitles, currentOpportunities)
  return {
    format: W163_RECEIPT_FORMAT,
    sourceDigest,
    aggregate: {
      reviewedTargets: reviewedTitles.length,
      ...summary,
    },
    stateFingerprint: fingerprintW163ResolvedTargetState(reviewedTitles, currentOpportunities),
  }
}

export function validateW163PrivateDryRunReceipt(
  receipt: unknown,
  expected: W163PrivateDryRunReceipt,
): void {
  if (!receipt || typeof receipt !== "object") {
    throw new Error("a valid private dry-run receipt is required")
  }

  const candidate = receipt as Partial<W163PrivateDryRunReceipt>
  if (candidate.format !== W163_RECEIPT_FORMAT) {
    throw new Error("the private dry-run receipt format is not supported")
  }
  if (candidate.sourceDigest !== expected.sourceDigest) {
    throw new Error("the private dry-run receipt source digest does not match")
  }
  if (candidate.stateFingerprint !== expected.stateFingerprint) {
    throw new Error("the private dry-run receipt current-state fingerprint does not match")
  }

  const aggregate = candidate.aggregate
  if (
    !aggregate ||
    aggregate.reviewedTargets !== expected.aggregate.reviewedTargets ||
    aggregate.noOps !== expected.aggregate.noOps ||
    aggregate.guardedUpdates !== expected.aggregate.guardedUpdates ||
    aggregate.blockers !== expected.aggregate.blockers ||
    aggregate.conflicts !== expected.aggregate.conflicts
  ) {
    throw new Error("the private dry-run receipt aggregate counts do not match")
  }
}

export function reconcileReviewedPlatformTitles(
  reviewedTitles: readonly ReviewedPlatformTitle[],
  currentOpportunities: readonly CurrentOpportunityTitle[],
): { outcomes: TitleReconciliationOutcome[]; summary: TitleReconciliationSummary } {
  const byReference = new Map<string, CurrentOpportunityTitle[]>()
  for (const opportunity of currentOpportunities) {
    const matches = byReference.get(opportunity.reference) ?? []
    matches.push(opportunity)
    byReference.set(opportunity.reference, matches)
  }

  const outcomes = reviewedTitles.map((reviewed): TitleReconciliationOutcome => {
    const matches = byReference.get(reviewed.reference) ?? []
    if (matches.length !== 1) return { kind: matches.length === 0 ? "blocker" : "conflict", reference: reviewed.reference }

    const opportunity = matches[0]
    if (opportunity.isDemo) return { kind: "blocker", reference: reviewed.reference }
    if (opportunity.publicTitle === reviewed.publicTitle) return { kind: "no_op", reference: reviewed.reference }

    return {
      kind: "guarded_update",
      id: opportunity.id,
      reference: reviewed.reference,
      expectedPublicTitle: opportunity.publicTitle,
      nextPublicTitle: reviewed.publicTitle,
    }
  })

  return {
    outcomes,
    summary: outcomes.reduce<TitleReconciliationSummary>((summary, outcome) => {
      if (outcome.kind === "no_op") summary.noOps += 1
      if (outcome.kind === "guarded_update") summary.guardedUpdates += 1
      if (outcome.kind === "blocker") summary.blockers += 1
      if (outcome.kind === "conflict") summary.conflicts += 1
      return summary
    }, { noOps: 0, guardedUpdates: 0, blockers: 0, conflicts: 0 }),
  }
}
