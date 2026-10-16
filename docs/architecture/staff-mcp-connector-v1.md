# Staff Claude connection v1

Product Change: [#265](https://github.com/re-new-team/renew-governance/issues/265), released 16 October 2026. Claude app connector: Ticket [#273](https://github.com/re-new-team/renew-governance/issues/273).

WAVE staff can connect Claude Code or the Claude app to WAVE and ask questions about WAVE data, then build their own analyses and documents. The connection is **read-only** and **staff-only**.

The Claude app's sign-in delivers access to whichever Claude account started it. WAVE's confirmation page therefore tells staff never to approve a sign-in someone else sent them; Ivan accepted this risk in #273.

## Connect

You need a WAVE staff account with a display name.

### Claude app (claude.ai, desktop or web)

1. Settings → Connectors → **Add custom connector**. Name `WAVE`, URL `https://app.re-new.team/api/mcp`.
2. Authentication: keep **Sign in now** (OAuth). OAuth client: keep the detected **Register automatically**. Leave request headers empty and transport on **Streamable HTTP**.
3. Press **Connect**. The normal WAVE login page opens. Sign in.
4. WAVE shows **Connect the Claude app to WAVE**. Press **Allow read access** only if you started this yourself just now.
5. In a new chat, enable the WAVE connector and ask "list the WAVE tables".

On a Team or Enterprise Claude plan, an owner may need to add the connector for the organisation first.

### Claude Code

Once per Mac (`--scope user` makes WAVE available in every folder):

```bash
claude mcp add --scope user --transport http wave https://app.re-new.team/api/mcp
```

1. Start Claude Code, type `/mcp`, choose `wave` and **Authenticate**.
2. The browser opens the normal WAVE login page. Sign in.
3. WAVE asks you to confirm. Press **Allow read access**, then return to Claude Code.
4. Check it works: ask Claude "list the WAVE tables".

Press **Allow** only for a sign-in you started yourself in Claude Code moments before. **Cancel** tells Claude Code the connection was refused.

Claude stays connected while it is used; after 30 days without use it asks you to sign in again.

If WAVE says **Staff accounts only**, the account you signed in with is not a staff account. If it says **One detail missing**, your account has no display name; ask Ivan to add it.

## What Claude can and cannot do

- Read every public WAVE table and view a staff member can see: opportunities, repreneurs, matches, offers, the M&A directory, interactions, email history, tasks, notes and the rest.
- Never read the login system (`user`, `session`, `account`, `verification`, `rateLimit`, the OAuth tables) or the retired Strategic PDR and its governance snapshots (`pdr_*`, `wave_pdr_*`, `wave_governance_*`, per #212). Columns named like password, secret, token, API key or credential are removed from every row, including keys inside JSON values, and cannot be filtered or sorted on. This also hides `leadership_assessments.token` (the assessment link, which lets its holder submit) and `opportunity_memo_grant_attempts.token`; staff still see the assessment link in WAVE.
- Never write. The endpoint has no write, RPC, SQL, file or Storage tool; it only issues PostgREST reads.
- Private document files (memos, NDAs, CVs in Storage) are out of scope for v1.

Tools: `list_tables`, `describe_table`, `query_table` (select with embedded related tables, AND filters, ordering by up to 5 columns, paging; default 50 rows, maximum 1000 per call). One answer stays under about 60,000 characters so it fits Claude Code's tool-result limit: wide rows are cut from the end and `next_offset` continues; a single row larger than that is still returned whole. `list_tables` shows only tables the read path can reach.

## How access is enforced

| Step | Rule |
| --- | --- |
| Discovery | `/.well-known/oauth-protected-resource[/api/mcp]` and `/.well-known/oauth-authorization-server` describe the endpoint. |
| Client registration | Better Auth `mcp` plugin at `/api/auth/mcp/register`. Only Claude's callbacks are accepted: loopback for Claude Code (`http://localhost`, `127.0.0.1`, `[::1]`) and exactly `https://claude.ai/api/mcp/auth_callback` or `https://claude.com/api/mcp/auth_callback` for the Claude app. Queries on the hosted callback and commas are refused because the plugin stores the list comma-joined. |
| Confirmation page | Names the destination WAVE enforces ("Claude Code on this computer" or "the Claude account that started this connection"), never the client's self-chosen name. For the Claude app it adds: if someone sent you this link, press Cancel. |
| Sign-in | `/api/mcp/authorize` (WAVE code): signed-out → WAVE login and back; non-staff → refused; staff → `/auth/connect` confirmation. PKCE S256 is required. |
| Code issue | Only the confirmation page's same-origin POST asks Better Auth for a code, in-process. The plugin's public `/api/auth/mcp/authorize`, `/api/auth/mcp/get-session`, `/api/auth/oauth2/consent` and `/api/auth/.well-known/*` return 404. |
| Tokens | Access tokens last 1 hour. Each refresh deletes the presented token row, so a used refresh token or previous access token stops working. |
| Every request | `/api/mcp` checks the bearer token and the user's **current** staff role in `app_user_roles`. |

Tokens live in `oauthApplication`, `oauthAccessToken` and `oauthConsent` (migration `20261016120000`), with RLS on and no access for `anon`, `authenticated` or `service_role`. Each tool call logs `wave_mcp.tool_call` with user id, tool, table and outcome, never record content.

## Operations

- **Remove someone's access:** remove their staff role. Their next request is refused.
- **Disconnect every Claude client for a person immediately:** delete their rows in `oauthAccessToken`. This is a production data action and needs its own authority.
- A staff account without a display name cannot complete sign-in (Better Auth's token step needs it); WAVE explains this before issuing a code.

## Verification

- Behavior tests: `lib/__tests__/staff-mcp-connector.test.ts`.
- Disposable PostgreSQL rehearsal of the migration and the real Better Auth flow: `bash scripts/rehearse-staff-mcp-oauth.sh` (in CI `Verify`). On macOS set `LC_ALL=en_US.UTF-8` if PostgreSQL refuses to start.
