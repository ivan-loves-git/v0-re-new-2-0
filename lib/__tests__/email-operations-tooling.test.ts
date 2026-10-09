import { describe, expect, it } from "vitest"
import { runEmailOperations } from "../../scripts/email-operations.mjs"

const source = "https://iiuqcdnmxhtyispnykgf.supabase.co"
const env = {
  NEXT_PUBLIC_SUPABASE_URL: source,
  RESEND_API_KEY: "canary-resend-secret",
  VERCEL_TOKEN: "canary-vercel-secret",
  SUPABASE_SERVICE_ROLE_KEY: "canary-service-secret",
  QA_PRIMARY_EMAIL: "owned@example.invalid",
  QA_REPRENEUR_EMAIL: "repr@example.invalid",
  QA_REPRENEUR_PASSWORD: "canary-password",
}
const domainData = [
  { id: "e39154e8-80d9-4ace-9d2b-92bec7a81762", name: "news.re-new.team", status: "verified", open_tracking: false, click_tracking: false },
  { id: "07954ee8-5bd0-4dff-bbcb-f8bb5ea39a8b", name: "access.re-new.team", status: "pending", open_tracking: false, click_tracking: false },
]
const reviewId = "00000000-0000-4000-8000-000000000001"
const messageId = "00000000-0000-4000-8000-000000000002"
const body = "Release QA — synthetic message only."
const subject = "[TEST] Receipt QA"
const cc = ["bertrand@re-new.team", "contact@re-new.team"]

describe("Email Operations public tooling", () => {
  it("rejects an unrelated source project before making any external request", async () => {
    const requests: string[] = []
    const result = await runEmailOperations({
      command: "role", execute: true, qaRecipient: env.QA_REPRENEUR_EMAIL,
      env: { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" },
      fetchImpl: async url => { requests.push(String(url)); throw new Error("must not run") },
    })
    expect(result).toMatchObject({ state: "blocked", reason: "source_project_mismatch" })
    expect(requests).toEqual([])
  })

  it("identifies an unrelated Resend account without any mutation", async () => {
    const methods: string[] = []
    const result = await runEmailOperations({ command: "preflight", env, browser: "Aside", fetchImpl: async (url, init) => {
      methods.push(init?.method ?? "GET")
      return new Response(JSON.stringify(new URL(String(url)).origin === "https://api.resend.com"
        ? { data: [{ id: "11111111-1111-4111-8111-111111111111", name: "other-project.example", status: "verified" }], has_more: false }
        : { id: "prj_oCfBq06JCw4KKkPeMGrHX9M7Jt4c", accountId: "team_ZBRRlhayqlLIURUcxtq6pky0" }), { status: 200 })
    } })
    expect(result).toMatchObject({ state: "blocked", resend: { state: "mismatch", expectedDomain: "news.re-new.team", observedDomains: ["other-project.example"] } })
    expect(methods.every(method => method === "GET")).toBe(true)
  })

  it("keeps insufficient API rights and pending verification explicit, using the selected browser", async () => {
    const result = await runEmailOperations({ command: "preflight", env, browser: "Aside", fetchImpl: async url => {
      return new URL(String(url)).origin === "https://api.resend.com"
        ? new Response(JSON.stringify({ data: domainData, has_more: false }))
        : new Response(JSON.stringify({ error: env.VERCEL_TOKEN }), { status: 403 })
    } })
    expect(result).toMatchObject({
      state: "unavailable", readOnly: true,
      vercel: { state: "unknown", access: "forbidden", fallback: { browser: "Aside", session: "not_observed" } },
      resend: { state: "matched", domains: [{ verification: "verified" }, { verification: "pending" }] },
    })
    expect(JSON.stringify(result)).not.toContain(env.VERCEL_TOKEN)
  })

  it("keeps role verification read-only until execution and an owned QA identity are explicit", async () => {
    const result = await runEmailOperations({ command: "role", env, qaRecipient: env.QA_REPRENEUR_EMAIL,
      fetchImpl: async () => { throw new Error("dry-run must not request a session") },
    })
    expect(result).toMatchObject({ state: "requires_execution", readOnly: true })
  })

  it("signs out after a failed role check without exporting the session or error payload", async () => {
    const requests: string[] = []
    const result = await runEmailOperations({ command: "role", execute: true, env, qaRecipient: env.QA_REPRENEUR_EMAIL,
      fetchImpl: async url => {
        const path = new URL(String(url)).pathname
        requests.push(path)
        if (path === "/api/auth/sign-in/email") return new Response("canary-login-body", { headers: { "set-cookie": "better-auth.session_token=canary-session; HttpOnly; Secure" } })
        if (path === "/emails") throw new Error("canary-session canary-password")
        return new Response("{}")
      },
    })
    expect(result).toMatchObject({ state: "failed", loginSucceeded: true, qaSessionClosed: true, sessionMaterialPersisted: false })
    expect(requests).toContain("/api/auth/sign-out")
    expect(JSON.stringify(result)).not.toMatch(/canary-/)
  })

  it("refuses receipt lookup unless the QA recipient is explicitly the configured owned address", async () => {
    const requests: string[] = []
    const result = await runEmailOperations({ command: "receipt", env, qaRecipient: "someone-else@example.invalid", reviewId: "00000000-0000-4000-8000-000000000001",
      fetchImpl: async url => { requests.push(String(url)); throw new Error("must not run") },
    })
    expect(result).toMatchObject({ state: "blocked", reason: "explicit_owned_qa_receipt_required" })
    expect(requests).toEqual([])
  })

  it("verifies retained copy and envelope while keeping accepted-but-undelivered QA mail pending", async () => {
    const result = await runEmailOperations({ command: "receipt", env, qaRecipient: env.QA_PRIMARY_EMAIL, reviewId,
      fetchImpl: async url => {
        const path = new URL(String(url)).pathname
        let value
        if (path === "/domains") value = { data: domainData, has_more: false }
        else if (path === "/rest/v1/staff_email_reviews") value = [{ id: reviewId, state: "sent", source_kind: "business", recipient_email: env.QA_PRIMARY_EMAIL, provider_message_id: messageId, subject, body_text: body }]
        else if (path === `/emails/${messageId}`) value = { id: messageId, from: "Re-New <noreply@news.re-new.team>", to: [env.QA_PRIMARY_EMAIL], cc, subject, text: body, last_event: "sent" }
        else if (path === "/rest/v1/email_operations_history") value = [{ provider_message_id: messageId, subject, body_text: body, cc, status: "sent" }]
        else if (path === "/rest/v1/email_provider_events") value = [{ event_type: "email.sent", recipient_kind: "primary" }, { event_type: "email.delivered", recipient_kind: "copy" }]
        else throw new Error("unapproved endpoint")
        return new Response(JSON.stringify(value))
      },
    })
    expect(result).toMatchObject({ state: "pending", delivery: "pending", copyMatches: true, envelopeMatches: true, historyMatches: true, readOnly: true })
    expect(JSON.stringify(result)).not.toContain(body)
    expect(JSON.stringify(result)).not.toMatch(/canary-/)
  })

  it("checks all domain pages before classifying the expected provider account", async () => {
    const result = await runEmailOperations({ command: "preflight", env, fetchImpl: async url => {
      const request = new URL(String(url))
      if (request.hostname === "api.vercel.com") return new Response(JSON.stringify({ id: "prj_oCfBq06JCw4KKkPeMGrHX9M7Jt4c", accountId: "team_ZBRRlhayqlLIURUcxtq6pky0" }))
      return new Response(JSON.stringify(request.searchParams.has("after")
        ? { data: domainData, has_more: false }
        : { data: [{ id: "11111111-1111-4111-8111-111111111111", name: "other.example" }], has_more: true }))
    } })
    expect(result).toMatchObject({ state: "pending", resend: { state: "matched" }, vercel: { state: "matched" } })
  })

  it("blocks a different Vercel team even when the expected project ID is returned", async () => {
    const result = await runEmailOperations({ command: "preflight", env, fetchImpl: async url => new Response(JSON.stringify(
      new URL(String(url)).origin === "https://api.resend.com" ? { data: domainData, has_more: false }
        : { id: "prj_oCfBq06JCw4KKkPeMGrHX9M7Jt4c", accountId: "team_someone_else", token: env.VERCEL_TOKEN },
    )) })
    expect(result).toMatchObject({ state: "blocked", vercel: { state: "mismatch", observed: "unrecognized_project_or_team" } })
    expect(JSON.stringify(result)).not.toMatch(/canary-/)
  })

  it("blocks a receipt from an unrelated provider before reading its message or application rows", async () => {
    const urls: string[] = []
    const result = await runEmailOperations({ command: "receipt", env, reviewId, qaRecipient: env.QA_PRIMARY_EMAIL,
      fetchImpl: async url => {
        urls.push(String(url))
        return new Response(JSON.stringify({ data: [], has_more: false }))
      },
    })
    expect(result).toMatchObject({ state: "blocked", reason: "resend_project_not_proven" })
    expect(urls.every(url => new URL(url).pathname === "/domains")).toBe(true)
  })

  it.each([true, false])("reports actual access denial separately from logout success (%s)", async logoutSucceeds => {
    const result = await runEmailOperations({ command: "role", env, execute: true, qaRecipient: env.QA_REPRENEUR_EMAIL,
      fetchImpl: async url => {
        const path = new URL(String(url)).pathname
        if (path === "/api/auth/sign-in/email") return new Response("{}", { headers: { "set-cookie": "__Secure-better-auth.session_token=canary-session; HttpOnly; Secure" } })
        if (path === "/emails") return new Response(null, { status: 307, headers: { location: "/portal/deals" } })
        return new Response("{}", { status: logoutSucceeds ? 200 : 503 })
      },
    })
    expect(result).toMatchObject({ state: logoutSucceeds ? "verified" : "failed", staffEmailsDenied: true, qaSessionClosed: logoutSucceeds })
    expect(JSON.stringify(result)).not.toMatch(/canary-/)
  })

  it("keeps malformed provider identity responses unknown instead of proving a match", async () => {
    const result = await runEmailOperations({ command: "preflight", env, fetchImpl: async url => new Response(JSON.stringify(
      new URL(String(url)).origin === "https://api.resend.com" ? { data: [null], has_more: false } : { error: env.VERCEL_TOKEN },
    )) })
    expect(result).toMatchObject({ state: "unavailable", resend: { state: "unknown" }, vercel: { state: "unknown" } })
    expect(JSON.stringify(result)).not.toMatch(/canary-/)
  })

  it("blocks dependent receipt reads when the separate configured access domain is missing", async () => {
    const paths: string[] = []
    const result = await runEmailOperations({ command: "receipt", env, reviewId, qaRecipient: env.QA_PRIMARY_EMAIL,
      fetchImpl: async url => {
        const path = new URL(String(url)).pathname
        paths.push(path)
        if (path !== "/domains") throw new Error("dependent read must be blocked")
        return new Response(JSON.stringify({ data: [domainData[0]], has_more: false }))
      },
    })
    expect(result).toMatchObject({ state: "blocked", reason: "resend_project_not_proven" })
    expect(paths.every(path => path === "/domains")).toBe(true)
  })
})
