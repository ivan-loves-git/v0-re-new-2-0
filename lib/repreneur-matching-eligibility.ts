export type RepreneurOfferAssignment = {
  status?: string | null
  offer?: { name?: string | null; price?: number | string | null } | Array<{ name?: string | null; price?: number | string | null }> | null
}

export type MatchingRepreneurIdentity = {
  first_name?: string | null
  last_name?: string | null
  is_demo?: boolean | null
}

export type ManualRecommendationRepreneur = {
  /** UAT 7 adds this explicit classification to the canonical repreneur row. */
  is_demo?: boolean | null
}

export type InvitedRepreneurIdentity = {
  role?: string | null
  repreneur_id?: string | null
  user_id?: string | null
}

/** Staff recommendation is manual; the explicit DEMO flag remains a veto. */
export function isEligibleForManualRecommendation(
  repreneur: ManualRecommendationRepreneur | null | undefined,
) {
  return repreneur !== null && repreneur !== undefined && repreneur.is_demo !== true
}

/** Portal invitation is the operating boundary for staff proposals. */
export function hasInvitedLinkedIdentity(
  role: InvitedRepreneurIdentity | null | undefined,
  repreneurId: string,
) {
  return role?.role === "repreneur" && role.repreneur_id === repreneurId && Boolean(role.user_id)
}

export function isTestMarkedMatchingProfile(identity: MatchingRepreneurIdentity) {
  return [identity.first_name, identity.last_name].some((value) =>
    /^test(?:$|[\d _-])/.test(value?.trim().toLowerCase() ?? ""),
  )
}

export function isAcceptedPaidMatchingClient(
  identity: MatchingRepreneurIdentity,
  assignments: RepreneurOfferAssignment[] | null | undefined,
) {
  if (identity.is_demo) return false
  if (isTestMarkedMatchingProfile(identity)) return false

  return (assignments ?? []).some((assignment) => {
    if (assignment.status !== "accepted") return false
    const offer = Array.isArray(assignment.offer) ? assignment.offer[0] : assignment.offer
    const name = offer?.name?.trim().toLowerCase() ?? ""
    const price = typeof offer?.price === "number" ? offer.price : Number(offer?.price)
    if (!name || name.includes("test") || name.includes("free")) return false
    if (name.includes("end-to-end") || name.includes("end to end")) return true
    return name.includes("deal flow") && Number.isFinite(price) && price > 0
  })
}
