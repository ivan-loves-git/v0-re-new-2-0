import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  send: vi.fn(),
}))

vi.mock("pg", () => ({
  Pool: class {
    query = mocks.query
    connect = mocks.connect
  },
}))
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send }
  },
}))

import { sendRepreneurPortalSetupInvitation } from "@/lib/portal-setup-invitation"
import { isPasswordResetToken } from "@/lib/password-reset-token"

const identity = {
  repreneurId: "93000000-0000-4000-8000-000000000011",
  roleId: "93000000-0000-4000-8000-000000000021",
  userId: "synthetic-portal-user",
  email: "synthetic@example.com",
}

describe("staff portal setup invitation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("QA_MAIL_MODE", "off")
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release })
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("AS setup_user_id")) {
        return { rows: [{ setup_user_id: identity.userId, name: "<Synthetic>", email: identity.email }] }
      }
      if (sql.includes('AS user_id')) return { rows: [{ user_id: identity.userId }] }
      return { rows: [] }
    })
    mocks.send.mockResolvedValue({ data: { id: "synthetic-delivery" }, error: null })
  })

  afterEach(() => vi.unstubAllEnvs())

  it("sends a seven-day setup link in a fragment to the locked canonical identity", async () => {
    await sendRepreneurPortalSetupInvitation(identity)

    const message = mocks.send.mock.calls[0][0]
    expect(message.to).toBe("synthetic@example.com")
    expect(message.html).toContain("7 jours")
    expect(message.html).toContain("&lt;Synthetic&gt;")
    const link = new URL(message.html.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&"))
    const token = new URLSearchParams(link.hash.slice(1)).get("token")
    expect(isPasswordResetToken(token)).toBe(true)
    expect(token).toMatch(/^portal_setup_[a-f0-9]{48}$/)
    expect(link.searchParams.has("token")).toBe(false)
    expect(link.searchParams.get("intent")).toBe("portal")
  })

  it("does not mint or send when the canonical role and recipient no longer match", async () => {
    mocks.query.mockResolvedValue({ rows: [] })

    await expect(sendRepreneurPortalSetupInvitation(identity)).rejects.toThrow("Portal access changed")
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO public."verification"'))).toBe(false)
  })

  it("does not send a setup link revoked before delivery authority is checked", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("AS setup_user_id")) {
        return { rows: [{ setup_user_id: identity.userId, name: "Synthetic", email: identity.email }] }
      }
      return { rows: [] }
    })

    await expect(sendRepreneurPortalSetupInvitation(identity)).rejects.toThrow("Portal access changed before")
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("reports provider rejection without exposing provider details", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: "private provider detail" } })

    await expect(sendRepreneurPortalSetupInvitation(identity)).rejects.toThrow("The setup email provider rejected delivery.")
  })
})
