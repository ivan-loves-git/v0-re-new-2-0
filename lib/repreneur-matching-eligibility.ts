export type RepreneurOfferAssignment = {
  status?: string | null
  offer?: { name?: string | null; price?: number | string | null } | Array<{ name?: string | null; price?: number | string | null }> | null
}

export type MatchingRepreneurIdentity = {
  first_name?: string | null
  last_name?: string | null
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
