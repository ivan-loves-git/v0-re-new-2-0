import { describe, expect, it } from "vitest"
import {
  createPortalAccessSnapshot,
  getPortalAccessConfirmationCopy,
  type PortalAccessConfirmationStatus,
} from "@/lib/portal-access-confirmation"

function status(
  overrides: Partial<PortalAccessConfirmationStatus> = {},
): PortalAccessConfirmationStatus {
  return {
    repreneurEmail: "alex@example.com",
    portalEmailValidationError: null,
    enabled: false,
    repairable: true,
    identityIssue: null,
    authIdentityCount: 0,
    hasAuthUser: false,
    hasCredentialAccount: false,
    linkedUserId: null,
    roleId: null,
    roleEmail: null,
    roleRepreneurId: null,
    accessEnabledAt: null,
    lastAccessEmailSentAt: null,
    activeSessionCount: 0,
    ...overrides,
  }
}

describe("portal access confirmation", () => {
  it("explains a first enable without implying a credential or session reset", () => {
    const copy = getPortalAccessConfirmationCopy("enable", status())

    expect(copy).toEqual({
      title: "Enable portal access?",
      confirmLabel: "Enable and send link",
      recipient: "alex@example.com",
      description:
        "A portal login will be created and a setup link will be emailed to alex@example.com. No existing credentials or active sessions will be changed.",
    })
  })

  it("explains that a repair rotates credentials and revokes sessions", () => {
    const copy = getPortalAccessConfirmationCopy(
      "enable",
      status({
        hasAuthUser: true,
        hasCredentialAccount: true,
        authIdentityCount: 1,
        activeSessionCount: 2,
      }),
    )

    expect(copy.title).toBe("Repair portal access?")
    expect(copy.confirmLabel).toBe("Repair and send link")
    expect(copy.description).toContain("credential will be replaced")
    expect(copy.description).toContain("2 active sessions will be revoked")
    expect(copy.description).toContain("alex@example.com")
  })

  it("explains that a healthy resend leaves credentials and sessions unchanged", () => {
    const copy = getPortalAccessConfirmationCopy(
      "resend",
      status({
        enabled: true,
        hasAuthUser: true,
        hasCredentialAccount: true,
        authIdentityCount: 1,
        activeSessionCount: 1,
      }),
    )

    expect(copy.title).toBe("Resend portal access link?")
    expect(copy.confirmLabel).toBe("Send one link")
    expect(copy.description).toContain("One new access link")
    expect(copy.description).toContain("Credentials will stay unchanged")
    expect(copy.description).toContain("1 active session will remain signed in")
  })

  it("explains that disable sends no email and retains the login record", () => {
    const copy = getPortalAccessConfirmationCopy(
      "disable",
      status({
        enabled: true,
        hasAuthUser: true,
        hasCredentialAccount: true,
        authIdentityCount: 1,
        activeSessionCount: 3,
      }),
    )

    expect(copy.title).toBe("Disable portal access?")
    expect(copy.confirmLabel).toBe("Disable access")
    expect(copy.description).toContain("No email will be sent")
    expect(copy.description).toContain("3 active sessions will be revoked")
    expect(copy.description).toContain(
      "Outstanding unused access and password-reset links will stop working",
    )
    expect(copy.description).toContain(
      "login identity and password record will be retained",
    )
  })

  it("freezes every field that can change an action consequence", () => {
    expect(
      createPortalAccessSnapshot(
        status({
          enabled: true,
          roleId: "role-1",
          linkedUserId: "user-1",
          activeSessionCount: 2,
        }),
      ),
    ).toEqual({
      accessEnabledAt: null,
      activeSessionCount: 2,
      authIdentityCount: 0,
      enabled: true,
      hasAuthUser: false,
      hasCredentialAccount: false,
      identityIssue: null,
      lastAccessEmailSentAt: null,
      linkedUserId: "user-1",
      portalEmailValidationError: null,
      recipient: "alex@example.com",
      repairable: true,
      roleEmail: null,
      roleId: "role-1",
      roleRepreneurId: null,
    })
  })
})
