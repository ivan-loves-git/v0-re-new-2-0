import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { describe, expect, it, vi } from "vitest"

import { createCatalog, type Queryable } from "@/lib/mcp/catalog"
import {
  cancelledAuthorizeLocation,
  connectionCopy,
  hasValidAuthorizeRequest,
  isSameOriginPost,
  issuedCodeLocation,
  lacksDisplayName,
  nextAuthorizeStep,
} from "@/lib/mcp/authorize-flow"
import {
  QueryRejected,
  isExposedTableName,
  redactSecrets,
  validateColumnPath,
  validateSelect,
} from "@/lib/mcp/data-exposure"
import {
  authorizationServerMetadata,
  checkMcpStaff,
  protectedResourceMetadata,
  unauthenticatedResponse,
} from "@/lib/mcp/http"
import {
  areAllowedMcpRedirectUris,
  isAllowedMcpRedirectUri,
  mcpRedirectDestination,
  pickMcpAuthorizeParams,
  safeMcpContinuation,
} from "@/lib/mcp/oauth-policy"
import { formatRowPage, planRowQuery, type RowQueryPlan } from "@/lib/mcp/read-rows"
import { createWaveMcpServer } from "@/lib/mcp/server"

const ORIGIN = "https://app.re-new.team"
const exposed = new Set(["opportunities", "ma_firms", "ma_offices", "app_user_roles"])

function authorizeParams(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    client_id: "client-1",
    redirect_uri: "http://localhost:53682/callback",
    response_type: "code",
    code_challenge: "challenge",
    code_challenge_method: "S256",
    state: "state-1",
    ...overrides,
  })
}

describe("staff Claude connection sign-in", () => {
  it("lets registered clients return codes only to Claude Code's listener or the Claude app's callback", () => {
    expect(mcpRedirectDestination("http://localhost:53682/callback")).toBe("claude_code")
    expect(mcpRedirectDestination("http://127.0.0.1:9000/callback")).toBe("claude_code")
    expect(mcpRedirectDestination("https://claude.ai/api/mcp/auth_callback")).toBe("claude_app")
    expect(mcpRedirectDestination("https://claude.com/api/mcp/auth_callback")).toBe("claude_app")

    expect(isAllowedMcpRedirectUri("https://claude.ai/api/mcp/auth_callback?next=https://evil.example")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://claude.ai/api/mcp/other")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://claude.ai.evil.example/api/mcp/auth_callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("http://claude.ai/api/mcp/auth_callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://claude.ai/api/mcp/auth_callback,https://evil.example/cb")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://localhost/callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("https://evil.example/callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("http://localhost.evil.example/callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("http://localhost:1/cb,https://evil.example/cb")).toBe(false)
    expect(isAllowedMcpRedirectUri("http://user:pass@localhost/callback")).toBe(false)
    expect(isAllowedMcpRedirectUri("javascript:alert(1)")).toBe(false)
    expect(areAllowedMcpRedirectUris(["http://localhost/cb", "https://evil.example"])).toBe(false)
    expect(areAllowedMcpRedirectUris([])).toBe(false)
  })

  it("returns from the login page only to WAVE's own authorize step", () => {
    const continuation = "/api/mcp/authorize?client_id=a&state=b"
    expect(safeMcpContinuation(continuation)).toBe(continuation)
    for (const hostile of [
      "//evil.example/api/mcp/authorize?x=1",
      "https://evil.example/api/mcp/authorize?x=1",
      "/api/mcp/authorize/../../routing?x=1",
      "/api/mcp/authorize?\\evil",
      "/routing",
      null,
    ]) {
      expect(safeMcpContinuation(hostile)).toBeNull()
    }
  })

  it("forwards only the known OAuth fields", () => {
    const picked = pickMcpAuthorizeParams(
      new URLSearchParams({ client_id: "a", prompt: "none", callbackURL: "https://evil.example" }),
    )
    expect([...picked.keys()]).toEqual(["client_id"])
  })

  it("sends signed-out people to login, refuses non-staff and asks staff to confirm", () => {
    const params = authorizeParams()
    const login = nextAuthorizeStep(params, null)
    expect(login.kind).toBe("login")
    const loginUrl = new URL((login as { location: string }).location, ORIGIN)
    expect(loginUrl.pathname).toBe("/auth/login")
    expect(safeMcpContinuation(loginUrl.searchParams.get("mcp_continue"))).toBe(
      `/api/mcp/authorize?${params.toString()}`,
    )

    expect(nextAuthorizeStep(params, "repreneur")).toEqual({ kind: "forbidden" })
    expect(nextAuthorizeStep(params, "unassigned")).toEqual({ kind: "forbidden" })
    expect(nextAuthorizeStep(params, "staff")).toEqual({
      kind: "confirm",
      location: `/auth/connect?${params.toString()}`,
    })
  })

  it("rejects requests without PKCE or with a non-Claude callback before anything else", () => {
    expect(hasValidAuthorizeRequest(authorizeParams())).toBe(true)
    expect(nextAuthorizeStep(authorizeParams({ code_challenge_method: "plain" }), "staff")).toEqual({ kind: "invalid" })
    expect(nextAuthorizeStep(authorizeParams({ redirect_uri: "https://evil.example/cb" }), null)).toEqual({ kind: "invalid" })
    const withoutChallenge = authorizeParams()
    withoutChallenge.delete("code_challenge")
    expect(nextAuthorizeStep(withoutChallenge, "staff")).toEqual({ kind: "invalid" })
  })

  it("names the real destination and warns against forwarded Claude app sign-ins", () => {
    const code = connectionCopy("claude_code", "colin@example.test")
    expect(code.title).toBe("Connect Claude Code to WAVE")
    expect(code.description).toContain("Claude Code on this computer")
    expect(code.warning).toBeNull()

    const app = connectionCopy("claude_app", "colin@example.test")
    expect(app.title).toBe("Connect the Claude app to WAVE")
    expect(app.description).toContain("The Claude account that started this connection")
    expect(app.caution).toContain("started this from the Claude app yourself just now")
    expect(app.warning).toContain("If someone sent you this link, press Cancel")
  })

  it("tells Claude Code's listener when the staff member cancels", () => {
    const cancelled = new URL(cancelledAuthorizeLocation(authorizeParams()))
    expect(`${cancelled.origin}${cancelled.pathname}`).toBe("http://localhost:53682/callback")
    expect(cancelled.searchParams.get("error")).toBe("access_denied")
    expect(cancelled.searchParams.get("state")).toBe("state-1")
  })

  it("stops before issuing a code when the account has no display name", () => {
    expect(lacksDisplayName({ name: "Colin" })).toBe(false)
    expect(lacksDisplayName({ name: "  " })).toBe(true)
    expect(lacksDisplayName({ name: null })).toBe(true)
  })

  it("accepts the confirmation only from a WAVE page", () => {
    expect(isSameOriginPost(new Headers({ origin: ORIGIN }), ORIGIN)).toBe(true)
    expect(isSameOriginPost(new Headers({ origin: "https://evil.example" }), ORIGIN)).toBe(false)
    expect(isSameOriginPost(new Headers(), ORIGIN)).toBe(false)
  })

  it("passes on Better Auth's code only as a redirect to the requested callback", () => {
    const callback = "https://claude.ai/api/mcp/auth_callback"
    const redirect = (location: string, status = 302) =>
      new Response(null, { status, headers: { location } })

    expect(issuedCodeLocation(redirect(`${callback}?code=abc&state=s`), callback)).toBe(`${callback}?code=abc&state=s`)
    expect(issuedCodeLocation(redirect("https://evil.example/cb?code=abc"), callback)).toBeNull()
    expect(issuedCodeLocation(redirect(`${callback}?error=invalid_scope`), callback)).toBeNull()
    expect(issuedCodeLocation(new Response("{}", { status: 400 }), callback)).toBeNull()
  })

  it("publishes discovery documents that point sign-in at WAVE's staff step", () => {
    expect(protectedResourceMetadata(ORIGIN)).toMatchObject({
      resource: `${ORIGIN}/api/mcp`,
      authorization_servers: [ORIGIN],
    })
    expect(authorizationServerMetadata(ORIGIN)).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/api/mcp/authorize`,
      token_endpoint: `${ORIGIN}/api/auth/mcp/token`,
      registration_endpoint: `${ORIGIN}/api/auth/mcp/register`,
      code_challenge_methods_supported: ["S256"],
    })
    const challenge = unauthenticatedResponse(ORIGIN)
    expect(challenge.status).toBe(401)
    expect(challenge.headers.get("www-authenticate")).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp"`,
    )
  })
})

describe("staff gate on every MCP request", () => {
  const bearer = new Headers({ authorization: "Bearer token-1" })

  it("serves only a current staff account", async () => {
    const findRole = vi.fn(async () => "staff" as const)
    await expect(
      checkMcpStaff(bearer, { findTokenUserId: async () => "user-1", findRole }),
    ).resolves.toEqual({ status: "staff", userId: "user-1" })
    expect(findRole).toHaveBeenCalledWith("user-1")

    await expect(
      checkMcpStaff(bearer, { findTokenUserId: async () => "user-2", findRole: async () => "repreneur" }),
    ).resolves.toEqual({ status: "forbidden" })
    await expect(
      checkMcpStaff(bearer, { findTokenUserId: async () => "user-3", findRole: async () => "unassigned" }),
    ).resolves.toEqual({ status: "forbidden" })
  })

  it("asks for sign-in when the token is missing, unknown or its user is gone", async () => {
    const neverCalled = vi.fn()
    await expect(
      checkMcpStaff(new Headers(), { findTokenUserId: neverCalled, findRole: neverCalled }),
    ).resolves.toEqual({ status: "unauthenticated" })
    expect(neverCalled).not.toHaveBeenCalled()
    await expect(
      checkMcpStaff(bearer, { findTokenUserId: async () => null, findRole: neverCalled }),
    ).resolves.toEqual({ status: "unauthenticated" })
    await expect(
      checkMcpStaff(bearer, { findTokenUserId: async () => "user-1", findRole: async () => null }),
    ).resolves.toEqual({ status: "unauthenticated" })
  })
})

describe("what the staff connection can read", () => {
  it("hides the login system and the retired PDR", () => {
    for (const table of ["user", "session", "account", "verification", "rateLimit", "oauthAccessToken", "pdr_requests", "wave_pdr_screening_records", "wave_governance_snapshots", "wave_governance_projection_current_read"]) {
      expect(isExposedTableName(table)).toBe(false)
    }
    for (const table of ["opportunities", "repreneurs", "ma_contacts", "email_logs", "app_user_roles"]) {
      expect(isExposedTableName(table)).toBe(true)
    }
  })

  it("removes secret columns from rows and from embedded related rows", () => {
    expect(
      redactSecrets([
        { id: 1, name: "A", lease_token: "x", finalize_secret_hash: "h", input_tokens: 12, office: { name: "B", api_key: "k" } },
      ]),
    ).toEqual([{ id: 1, name: "A", input_tokens: 12, office: { name: "B" } }])
  })

  it("embeds only readable tables and never names a secret column, even under an alias", () => {
    expect(validateSelect("id, name, ma_offices(name, city)", exposed)).toBe("id,name,ma_offices(name,city)")
    expect(validateSelect("*, office:ma_offices!inner(name)", exposed)).toBe("*,office:ma_offices!inner(name)")
    expect(validateSelect(undefined, exposed)).toBe("*")

    const rejected = (select: string) => () => validateSelect(select, exposed)
    expect(rejected("*, user(*)")).toThrow(QueryRejected)
    expect(rejected("*, u:session(*)")).toThrow(QueryRejected)
    expect(rejected("*, user_id(*)")).toThrow(QueryRejected)
    expect(rejected("id, x:lease_token")).toThrow(QueryRejected)
    expect(rejected("id, metadata->>api_key")).toThrow(QueryRejected)
    expect(rejected("id; drop table x")).toThrow(QueryRejected)
    expect(rejected("ma_offices(name")).toThrow(QueryRejected)
  })

  it("never filters or sorts on a secret column, so it cannot be guessed", () => {
    expect(validateColumnPath("status", exposed)).toBe("status")
    expect(validateColumnPath("ma_offices.city", exposed)).toBe("ma_offices.city")
    expect(validateColumnPath("metadata->>source", exposed)).toBe("metadata->>source")
    expect(() => validateColumnPath("claim_token", exposed)).toThrow(QueryRejected)
    expect(() => validateColumnPath("metadata->>refresh_token", exposed)).toThrow(QueryRejected)
    expect(() => validateColumnPath("session.userId", exposed)).toThrow(QueryRejected)
    expect(() => validateColumnPath("name or 1=1", exposed)).toThrow(QueryRejected)
  })

  it("plans a bounded read and rejects malformed filters", () => {
    expect(
      planRowQuery(
        {
          table: "opportunities",
          filters: [
            { column: "title", operator: "ilike", value: "%dupont%" },
            { column: "status", operator: "in", value: ["active", "paused"] },
            { column: "closed_at", operator: "is", value: null },
          ],
          order: [{ column: "created_at", ascending: false }],
        },
        exposed,
      ),
    ).toEqual({
      table: "opportunities",
      select: "*",
      filters: [
        { column: "title", operator: "ilike", value: "%dupont%" },
        { column: "status", operator: "in", value: ["active", "paused"] },
        { column: "closed_at", operator: "is", value: null },
      ],
      order: [{ column: "created_at", referencedTable: undefined, ascending: false, nullsFirst: false }],
      limit: 50,
      offset: 0,
    })

    const rejected = (input: Parameters<typeof planRowQuery>[0]) => () => planRowQuery(input, exposed)
    expect(rejected({ table: "session" })).toThrow(QueryRejected)
    expect(rejected({ table: "opportunities", limit: 5000 })).toThrow(QueryRejected)
    expect(rejected({ table: "opportunities", filters: [{ column: "status", operator: "eq", value: null }] })).toThrow(QueryRejected)
    expect(rejected({ table: "opportunities", filters: [{ column: "status", operator: "in", value: "active" }] })).toThrow(QueryRejected)
    expect(rejected({ table: "opportunities", filters: [{ column: "status", operator: "is", value: "active" }] })).toThrow(QueryRejected)
    expect(rejected({ table: "opportunities", order: Array.from({ length: 6 }, () => ({ column: "id" })) })).toThrow(QueryRejected)
  })

  it("pages results and keeps one answer to a readable size", () => {
    const plan: RowQueryPlan = { table: "opportunities", select: "*", filters: [], order: [], limit: 100, offset: 0 }
    const page = JSON.parse(formatRowPage(plan, { rows: [{ id: 1, lease_token: "x" }], total: 250 }))
    expect(page).toMatchObject({ total_rows: 250, returned_rows: 1, next_offset: 1, rows: [{ id: 1 }] })
    expect(page.rows[0]).not.toHaveProperty("lease_token")

    const wide = Array.from({ length: 100 }, (_, id) => ({ id, body: "x".repeat(10_000) }))
    const cut = JSON.parse(formatRowPage(plan, { rows: wide, total: 100 }))
    expect(cut.truncated).toBe(true)
    expect(cut.returned_rows).toBeLessThan(100)
    expect(cut.next_offset).toBe(cut.returned_rows)
  })
})

describe("table catalog", () => {
  function fakeDatabase(): Queryable & { calls: string[] } {
    const calls: string[] = []
    return {
      calls,
      async query<Row>(text: string) {
        calls.push(text)
        if (text.includes("pg_class c\n    JOIN pg_namespace")) {
          return {
            rows: [
              { name: "ma_firms", kind: "table", approximate_rows: "229", description: null },
              { name: "ma_offices", kind: "table", approximate_rows: 431, description: null },
              { name: "session", kind: "table", approximate_rows: 12, description: null },
            ] as Row[],
          }
        }
        if (!text.includes("pg_constraint")) {
          return {
            rows: [
              { name: "id", type: "uuid", nullable: false, description: null },
              { name: "firm_id", type: "uuid", nullable: false, description: null },
              { name: "user_id", type: "text", nullable: true, description: null },
              { name: "claim_token", type: "uuid", nullable: true, description: null },
            ] as Row[],
          }
        }
        return {
          rows: [
            { kind: "p", source_table: "ma_offices", target_table: null, source_columns: ["id"], target_columns: [] },
            { kind: "f", source_table: "ma_offices", target_table: "ma_firms", source_columns: ["firm_id"], target_columns: ["id"] },
            { kind: "f", source_table: "ma_offices", target_table: "user", source_columns: ["user_id"], target_columns: ["id"] },
            { kind: "f", source_table: "session", target_table: "ma_offices", source_columns: ["office_id"], target_columns: ["id"] },
          ] as Row[],
        }
      },
    }
  }

  it("lists only exposed tables and describes them without secret columns or hidden relations", async () => {
    const database = fakeDatabase()
    const catalog = createCatalog(database)
    expect((await catalog.listTables()).map((table) => [table.name, table.approximateRows])).toEqual([
      ["ma_firms", 229],
      ["ma_offices", 431],
    ])
    expect(await catalog.describeTable("session")).toBeNull()

    const offices = await catalog.describeTable("ma_offices")
    expect(offices?.columns.map((column) => [column.name, column.primaryKey, column.references])).toEqual([
      ["id", true, null],
      ["firm_id", false, "ma_firms.id"],
      ["user_id", false, null],
    ])
    expect(offices?.referencedBy).toEqual([])
    expect((await catalog.describeTable("ma_firms"))?.referencedBy).toEqual(["ma_offices"])
  })

  it("describes tables when the driver returns key columns as Postgres array text", async () => {
    // Production on 16 October 2026: node-postgres returned name[] unparsed, so
    // every describe_table failed with "source_columns.forEach is not a function".
    const catalog = createCatalog({
      async query<Row>(text: string) {
        if (text.includes("pg_class c\n    JOIN pg_namespace")) {
          return {
            rows: ["opportunities", "repreneurs", "opportunity_matches"].map((name) => ({
              name,
              kind: "table",
              approximate_rows: "120",
              description: null,
            })) as Row[],
          }
        }
        if (!text.includes("pg_constraint")) {
          return {
            rows: ["opportunity_id", "repreneur_id", "status"].map((name) => ({
              name,
              type: name === "status" ? "text" : "uuid",
              nullable: name === "status",
              description: null,
            })) as Row[],
          }
        }
        return {
          rows: [
            { kind: "p", source_table: "opportunity_matches", target_table: null, source_columns: "{opportunity_id,repreneur_id}", target_columns: "{}" },
            { kind: "f", source_table: "opportunity_matches", target_table: "opportunities", source_columns: "{opportunity_id}", target_columns: "{id}" },
            { kind: "f", source_table: "opportunity_matches", target_table: "repreneurs", source_columns: "{repreneur_id}", target_columns: "{id}" },
          ] as Row[],
        }
      },
    })

    const matches = await catalog.describeTable("opportunity_matches")
    expect(matches?.columns.map((column) => [column.name, column.primaryKey, column.references])).toEqual([
      ["opportunity_id", true, "opportunities.id"],
      ["repreneur_id", true, "repreneurs.id"],
      ["status", false, null],
    ])
    expect((await catalog.describeTable("opportunities"))?.referencedBy).toEqual(["opportunity_matches"])
  })

  it("reuses the table list for five minutes", async () => {
    let now = 0
    const database = fakeDatabase()
    const catalog = createCatalog(database, () => now)
    await catalog.listTables()
    await catalog.listTables()
    expect(database.calls).toHaveLength(1)
    now = 5 * 60 * 1000
    await catalog.listTables()
    expect(database.calls).toHaveLength(2)
  })
})

describe("MCP server over the stateless HTTP transport", () => {
  async function call(body: unknown, context: Parameters<typeof createWaveMcpServer>[0]) {
    const server = createWaveMcpServer(context)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    try {
      const response = await transport.handleRequest(
        new Request(`${ORIGIN}/api/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": "2025-06-18",
          },
          body: JSON.stringify(body),
        }),
      )
      return { status: response.status, body: await response.json() }
    } finally {
      await server.close()
    }
  }

  function context() {
    const audit = vi.fn()
    const readRows = vi.fn(async () => ({
      rows: [{ id: "o-1", name: "Office", claim_token: "secret" }],
      total: 1,
    }))
    const catalog = createCatalog({
      async query<Row>(text: string) {
        if (text.includes("pg_class c\n    JOIN pg_namespace")) {
          return { rows: [{ name: "ma_offices", kind: "table", approximate_rows: 1, description: null }] as Row[] }
        }
        return { rows: [] as Row[] }
      },
    })
    return { audit, readRows, catalog }
  }

  it("initializes with read-only guidance and lists three read-only tools", async () => {
    const deps = context()
    const init = await call(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } },
      deps,
    )
    expect(init.status).toBe(200)
    expect(init.body.result.instructions).toContain("read-only")

    const tools = await call({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, deps)
    expect(tools.body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "list_tables",
      "describe_table",
      "query_table",
    ])
    for (const tool of tools.body.result.tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    }
  })

  it("reads rows without secrets and records who read which table", async () => {
    const deps = context()
    const result = await call(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "query_table", arguments: { table: "ma_offices", select: "id, name", limit: 10 } } },
      deps,
    )
    const page = JSON.parse(result.body.result.content[0].text)
    expect(page.rows).toEqual([{ id: "o-1", name: "Office" }])
    expect(deps.readRows).toHaveBeenCalledWith(expect.objectContaining({ table: "ma_offices", select: "id,name", limit: 10 }))
    expect(deps.audit).toHaveBeenCalledWith({ tool: "query_table", table: "ma_offices", outcome: "ok" })
  })

  it("refuses hidden tables without reading anything", async () => {
    const deps = context()
    const result = await call(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "query_table", arguments: { table: "session" } } },
      deps,
    )
    expect(result.body.result.isError).toBe(true)
    expect(deps.readRows).not.toHaveBeenCalled()
    expect(deps.audit).toHaveBeenCalledWith({ tool: "query_table", table: "session", outcome: "rejected" })
  })
})
