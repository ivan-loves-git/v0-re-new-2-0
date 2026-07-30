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

export interface PortalEmailValidation {
  email: string | null
  error: string | null
}

const portalEmailCorrection =
  "Correct the repreneur email before changing portal access or sending a link."

/**
 * Validates the canonical mailbox used for the repreneur portal. This is kept
 * deliberately separate from normalization so existing identity lookups can
 * still compare legacy records safely, while access-changing actions reject an
 * invalid recipient before opening a database connection.
 */
export function validatePortalEmail(
  value: string | null | undefined,
): PortalEmailValidation {
  const email = normalizePortalEmail(value)
  if (!email) return { email: null, error: null }

  const [localPart, domain, ...extraParts] = email.split("@")
  if (
    !localPart ||
    !domain ||
    extraParts.length > 0 ||
    localPart.length > 64 ||
    domain.length > 253 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return {
      email,
      error: `This email address is not valid: the part before @ cannot start or end with a dot or contain consecutive dots. ${portalEmailCorrection}`,
    }
  }

  const validLocalPart = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)
  const validDomain = domain
    .split(".")
    .every(
      (label) =>
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
    )
  if (!validLocalPart || !validDomain || !domain.includes(".")) {
    return {
      email,
      error: `This email address is not valid. ${portalEmailCorrection}`,
    }
  }

  return { email, error: null }
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
