import type { PortalAccessIdentityIssue } from "@/lib/portal-access-reconciliation"

export type PortalAccessAction = "enable" | "resend" | "disable"

export interface PortalAccessConfirmationStatus {
  repreneurEmail: string | null
  portalEmailValidationError: string | null
  enabled: boolean
  repairable: boolean
  identityIssue: PortalAccessIdentityIssue | null
  authIdentityCount: number
  hasAuthUser: boolean
  hasCredentialAccount: boolean
  linkedUserId: string | null
  roleId: string | null
  roleEmail: string | null
  roleRepreneurId: string | null
  accessEnabledAt: string | null
  lastAccessEmailSentAt: string | null
  activeSessionCount: number
}

export interface PortalAccessConfirmationSnapshot {
  accessEnabledAt: string | null
  activeSessionCount: number
  authIdentityCount: number
  enabled: boolean
  hasAuthUser: boolean
  hasCredentialAccount: boolean
  identityIssue: PortalAccessIdentityIssue | null
  lastAccessEmailSentAt: string | null
  linkedUserId: string | null
  portalEmailValidationError: string | null
  recipient: string | null
  repairable: boolean
  roleEmail: string | null
  roleId: string | null
  roleRepreneurId: string | null
}

export interface PortalAccessConfirmationInput {
  action: PortalAccessAction
  operationKey: string
  snapshot: PortalAccessConfirmationSnapshot
}

export interface PortalAccessConfirmationCopy {
  title: string
  confirmLabel: string
  recipient: string
  description: string
}

export function createPortalAccessSnapshot(
  status: PortalAccessConfirmationStatus,
): PortalAccessConfirmationSnapshot {
  return {
    accessEnabledAt: status.accessEnabledAt,
    activeSessionCount: status.activeSessionCount,
    authIdentityCount: status.authIdentityCount,
    enabled: status.enabled,
    hasAuthUser: status.hasAuthUser,
    hasCredentialAccount: status.hasCredentialAccount,
    identityIssue: status.identityIssue,
    lastAccessEmailSentAt: status.lastAccessEmailSentAt,
    linkedUserId: status.linkedUserId,
    portalEmailValidationError: status.portalEmailValidationError,
    recipient: status.repreneurEmail,
    repairable: status.repairable,
    roleEmail: status.roleEmail,
    roleId: status.roleId,
    roleRepreneurId: status.roleRepreneurId,
  }
}

export function portalAccessSnapshotMatches(
  status: PortalAccessConfirmationStatus,
  expected: PortalAccessConfirmationSnapshot,
) {
  return (
    JSON.stringify(createPortalAccessSnapshot(status)) ===
    JSON.stringify(expected)
  )
}

export function isPortalAccessActionAvailable(
  action: PortalAccessAction,
  status: PortalAccessConfirmationStatus,
) {
  const hasValidEmail = Boolean(
    status.repreneurEmail && !status.portalEmailValidationError,
  )
  if (action === "enable") {
    return hasValidEmail && !status.enabled && status.repairable
  }
  if (action === "resend") return hasValidEmail && status.enabled
  return status.enabled || Boolean(status.portalEmailValidationError)
}

function activeSessionText(count: number, outcome: "remain" | "revoke") {
  if (count === 0) return "There are no active sessions."
  const sessions = `${count} active ${count === 1 ? "session" : "sessions"}`
  return outcome === "remain"
    ? `${sessions} will remain signed in.`
    : `${sessions} will be revoked.`
}

export function getPortalAccessConfirmationCopy(
  action: PortalAccessAction,
  status: PortalAccessConfirmationStatus,
): PortalAccessConfirmationCopy {
  const recipient = status.repreneurEmail ?? "the repreneur's current email"

  if (action === "resend") {
    return {
      title: "Resend portal access link?",
      confirmLabel: "Send one link",
      recipient,
      description: `One new access link will be emailed to ${recipient}. Credentials will stay unchanged. ${activeSessionText(status.activeSessionCount, "remain")}`,
    }
  }

  if (action === "disable") {
    return {
      title: "Disable portal access?",
      confirmLabel: "Disable access",
      recipient,
      description: `No email will be sent. The portal role will be removed. ${activeSessionText(status.activeSessionCount, "revoke")} The login identity and password record will be retained for a future safe re-enable.`,
    }
  }

  const hasExistingPortalAccess = Boolean(
    status.roleId ||
    status.linkedUserId ||
    status.hasAuthUser ||
    status.hasCredentialAccount,
  )
  if (!hasExistingPortalAccess) {
    return {
      title: "Enable portal access?",
      confirmLabel: "Enable and send link",
      recipient,
      description: `A portal login will be created and a setup link will be emailed to ${recipient}. No existing credentials or active sessions will be changed.`,
    }
  }

  const identityConsequence =
    status.authIdentityCount === 1
      ? `The existing credential will be replaced. ${activeSessionText(status.activeSessionCount, "revoke")}`
      : "The outdated portal link will be replaced with a new login. No current credential or active session for this recipient will be changed."

  return {
    title: "Repair portal access?",
    confirmLabel: "Repair and send link",
    recipient,
    description: `${identityConsequence} A fresh setup link will be emailed to ${recipient}.`,
  }
}
