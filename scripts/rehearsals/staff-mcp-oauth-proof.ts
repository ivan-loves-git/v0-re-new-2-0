import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { issuedCodeLocation } from "../../lib/mcp/authorize-flow";
import {
  staffMcpPlugin,
  staffMcpRefreshRotation,
  staffMcpRegistrationGuard,
} from "../../lib/mcp/better-auth-mcp";

// Real Better Auth + the production staff MCP settings against the disposable
// #265 database: registration guard, PKCE code issue, token exchange, bearer
// session, refresh and expiry.
const ORIGIN = "http://127.0.0.1:3265";
const CALLBACK = "http://localhost:53682/callback";

function base64url(buffer: Buffer) {
  return buffer.toString("base64url");
}

async function main() {
  const url = process.env.STAFF_MCP_REHEARSAL_DATABASE_URL;
  if (
    !url ||
    new URL(url).hostname !== "127.0.0.1" ||
    new URL(url).pathname !== "/staff_mcp"
  ) {
    throw new Error("Staff MCP rehearsal requires its disposable database");
  }
  const pool = new Pool({ connectionString: url, max: 2 });
  const auth = betterAuth({
    baseURL: ORIGIN,
    secret: "staff-mcp-rehearsal-secret-not-a-real-value",
    database: pool,
    // Sign-up exists only in this disposable instance to create a person.
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [staffMcpPlugin(ORIGIN)],
    hooks: { before: staffMcpRegistrationGuard, after: staffMcpRefreshRotation },
  });
  const call = (path: string, init?: RequestInit) =>
    auth.handler(new Request(`${ORIGIN}/api/auth${path}`, init));
  const json = { "content-type": "application/json" };
  const bearer = (token: string) =>
    new Headers({ authorization: `Bearer ${token}` });

  try {
    const signUp = await call("/sign-up/email", {
      method: "POST",
      headers: { ...json, origin: ORIGIN },
      body: JSON.stringify({
        email: "staff-265@example.test",
        password: "synthetic-rehearsal-password",
        name: "Synthetic Staff",
      }),
    });
    assert.equal(signUp.status, 200, "synthetic staff sign-up");
    const userId = ((await signUp.json()) as { user: { id: string } }).user.id;
    const cookie = signUp.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    const register = (redirect_uris: string[]) =>
      call("/mcp/register", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          client_name: "Claude Code (wave)",
          redirect_uris,
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
        }),
      });
    assert.equal(
      (await register(["https://evil.example/callback"])).status,
      400,
      "non-Claude callbacks are refused at registration",
    );
    const registered = await register([CALLBACK]);
    assert.equal(registered.status, 201, "Claude Code registers");
    const clientId = ((await registered.json()) as { client_id: string })
      .client_id;

    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash("sha256").update(verifier).digest());
    const authorizeQuery = (overrides: Record<string, string | null> = {}) => {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: CALLBACK,
        response_type: "code",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "state-265",
      });
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      return `/mcp/authorize?${params.toString()}`;
    };
    const authorize = (overrides?: Record<string, string | null>) =>
      call(authorizeQuery(overrides), { headers: { cookie } });

    const signedOut = await call(authorizeQuery());
    assert.equal(
      issuedCodeLocation(signedOut, CALLBACK),
      null,
      "no code without a signed-in person",
    );
    assert.equal(
      issuedCodeLocation(await authorize({ code_challenge: null, code_challenge_method: null }), CALLBACK),
      null,
      "no code without PKCE",
    );

    const codeFrom = async () => {
      const location = issuedCodeLocation(await authorize(), CALLBACK);
      assert.ok(location, "signed-in staff receive a code at Claude's callback");
      assert.equal(new URL(location).searchParams.get("state"), "state-265");
      return new URL(location).searchParams.get("code")!;
    };
    const token = (body: Record<string, string>) =>
      call("/mcp/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      });

    const wrongVerifier = await token({
      grant_type: "authorization_code",
      code: await codeFrom(),
      redirect_uri: CALLBACK,
      client_id: clientId,
      code_verifier: "not-the-verifier",
    });
    assert.notEqual(wrongVerifier.status, 200, "a wrong PKCE verifier is refused");

    const code = await codeFrom();
    const exchange = {
      grant_type: "authorization_code",
      code,
      redirect_uri: CALLBACK,
      client_id: clientId,
      code_verifier: verifier,
    };
    const exchanged = await token(exchange);
    assert.equal(exchanged.status, 200, "the code exchanges once");
    const tokens = (await exchanged.json()) as {
      access_token: string;
      refresh_token?: string;
      scope: string;
    };
    assert.ok(tokens.refresh_token, "offline access is granted by default");
    assert.notEqual((await token(exchange)).status, 200, "a code is single-use");

    const session = await auth.api.getMcpSession({
      headers: bearer(tokens.access_token),
    });
    assert.equal(session?.userId, userId, "the bearer token identifies the person");

    const refreshed = await token({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token!,
      client_id: clientId,
    });
    assert.equal(refreshed.status, 200, "Claude can refresh without a new sign-in");
    const next = (await refreshed.json()) as { access_token: string; refresh_token: string };
    assert.equal(
      (await auth.api.getMcpSession({ headers: bearer(next.access_token) }))?.userId,
      userId,
    );
    assert.equal(
      await auth.api.getMcpSession({ headers: bearer(tokens.access_token) }),
      null,
      "a refresh retires the previous access token",
    );
    const replayed = await token({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token!,
      client_id: clientId,
    });
    assert.notEqual(replayed.status, 200, "a used refresh token cannot be replayed");
    const successor = await token({
      grant_type: "refresh_token",
      refresh_token: next.refresh_token,
      client_id: clientId,
    });
    assert.equal(successor.status, 200, "the successor refresh token keeps working");
    const latest = (await successor.json()) as { access_token: string };

    await pool.query(
      `UPDATE public."oauthAccessToken" SET "accessTokenExpiresAt" = now() - interval '1 minute' WHERE "accessToken" = $1`,
      [latest.access_token],
    );
    assert.equal(
      await auth.api.getMcpSession({ headers: bearer(latest.access_token) }),
      null,
      "an expired access token no longer works",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
