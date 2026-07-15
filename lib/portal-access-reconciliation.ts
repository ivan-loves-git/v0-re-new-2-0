export type PortalAccessIdentityIssue =
  | "assigned_to_another_repreneur"
  | "inconsistent_link"
  | "missing_auth_user"
  | "missing_credential"
  | "multiple_auth_users"
  | "staff_email"

export interface PortalRoleCandidate {
  id: string
  user_id: string | null
  email: string | null
  role: string
  repreneur_id: string | null
}

export interface PortalRoleReconciliationPlan {
  targetRoleId: string | null
  redundantRoleIds: string[]
}

export function normalizePortalEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

export function planPortalRoleReconciliation({
  roles,
  repreneurId,
  email,
  authUserId,
}: {
  roles: PortalRoleCandidate[]
  repreneurId: string
  email: string
  authUserId: string
}): PortalRoleReconciliationPlan {
  const matchesIdentity = (role: PortalRoleCandidate) =>
    normalizePortalEmail(role.email) === email || role.user_id === authUserId

  const staffRole = roles.find(
    (role) =>
      role.role === "staff" &&
      (matchesIdentity(role) || role.repreneur_id === repreneurId),
  )
  if (staffRole) {
    throw new Error(
      "This email is assigned to staff access. Staff identities cannot also be used for repreneur portal access.",
    )
  }

  const repreneurRoles = roles.filter((role) => role.role === "repreneur")
  const identityConflict = repreneurRoles.find(
    (role) =>
      matchesIdentity(role) &&
      role.repreneur_id !== null &&
      role.repreneur_id !== repreneurId,
  )
  if (identityConflict) {
    throw new Error(
      "This login identity is already linked to another repreneur. Portal access was not changed.",
    )
  }

  const exactRoles = repreneurRoles.filter(
    (role) => role.repreneur_id === repreneurId,
  )
  const unlinkedIdentityRoles = repreneurRoles.filter(
    (role) => role.repreneur_id === null && matchesIdentity(role),
  )
  const targetRole =
    exactRoles.find(matchesIdentity) ??
    exactRoles[0] ??
    unlinkedIdentityRoles[0] ??
    null

  const redundantRoleIds = [...exactRoles, ...unlinkedIdentityRoles]
    .filter((role, index, candidates) => {
      if (role.id === targetRole?.id) return false
      return (
        candidates.findIndex((candidate) => candidate.id === role.id) === index
      )
    })
    .map((role) => role.id)

  return {
    targetRoleId: targetRole?.id ?? null,
    redundantRoleIds,
  }
}
