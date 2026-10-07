# Email Operations checks

These commands implement the approved retro follow-up on [#247](https://github.com/re-new-team/renew-governance/issues/247): candidates **1, 2, 3 and 5**. They check existing service state and owned QA evidence. The [routing adapter](https://github.com/re-new-team/renew-governance/blob/main/docs/agents/renew-direct-calls.md) owns action authority and phase progression.

## Start with identity and access

```sh
pnpm email:ops preflight --env-file <approved-env-file> --browser Aside
```

The approved source file replaces inherited environment values. Nothing automatically searches for credentials. An explicitly approved Vercel CLI authentication file can be supplied with `--vercel-auth-file <path>`; its token stays in memory. The command makes GET requests only, with bounded timeouts and no authenticated redirects.

Expected public identities live in [project.mjs](../../scripts/email-operations/project.mjs): Supabase source URL, Vercel project/team and both Resend domain IDs/names. Compare them with the current owning card before changing that profile. A source mismatch blocks every external request; a different provider account blocks dependent receipt checks. A matching project response proves readable metadata, not write permission.

| Result | Meaning |
| --- | --- |
| `blocked` | An identity or owned-QA guard failed; do not perform dependent operations. |
| `unavailable` | Credentials, permissions or a valid response are missing; no successful check is inferred. |
| `pending` | Identities match but domain verification or primary delivery is still pending. |
| `verified` | This command's stated checks passed; it grants no release or outbound authority. |
| `requires_execution` | The role command produced a read-only plan without creating a session. |
| `failed` | A checked invariant failed, including unsuccessful QA logout. |

Preflight reports tracking settings separately: a verified domain does not prove tracking activation or recipient activity. It does not modify DNS, domains, environment variables, webhooks or emails.

If API access is insufficient, the result preserves the explicitly selected browser and marks its session `not_observed`. Select that same browser/app through Computer Use and inspect its existing session before asking Ivan to log in. For Aside, use the native `cua.getApp("Aside")` entry point and follow its returned documentation. Do not substitute the internal browser. Authentication, terms acceptance and SMS verification remain human actions when actually required; the CLI does not claim or grant them.

## Inspect an existing owned QA receipt

```sh
pnpm email:ops receipt --env-file <approved-env-file> \
  --qa-recipient <configured-owned-QA-address> --review-id <review-uuid>
```

The explicit recipient must match `QA_PRIMARY_EMAIL`. The retained review must be sent, addressed to that owned identity and marked `[TEST]`. After proving the Resend account, the command reads that exact review, its provider receipt, retained history and recipient-classified events. It compares the sent and saved words and the primary/business-CC envelope. Only signed primary events establish primary delivery; CC activity cannot do so. Accepted mail without a delivery event stays `pending`. No new dispatch, replay, repair or cleanup occurs.

## Verify an owned repreneur's access

```sh
pnpm email:ops role --env-file <approved-env-file> --qa-recipient <configured-owned-repreneur-address>
```

This defaults to a read-only plan. Under already recorded authority for this specific QA treatment, add `--execute`. The explicit identity must match `QA_REPRENEUR_EMAIL`, with `QA_REPRENEUR_PASSWORD` in the approved source. The tool signs in only at the fixed Re-New application origin, checks that `/emails` redirects to the repreneur portal and signs out in `finally`, including failure paths. Failed or unconfirmed logout is a failed proof. Cookies, login bodies and rendered HTML never enter evidence files or output.

## Keep results small and evidence private

Default output is one status line; `--json` gives a compact selection of non-secret facts. `--evidence-file <absolute-path>` saves the same facts plus observation time in a new file with mode `0600`, outside the checkout. It refuses overwrite and symlink targets. Message bodies, recipients, credentials and sessions are not exported; retained text is represented by its SHA-256 and comparison results.

Exit 0 means this command verified its stated checks or completed a read-only role plan. Exit 1 covers pending, unavailable, blocked or failed proof. Exit 2 is invalid input/source/evidence destination. Always read the state; exit 0 is not permission to send, modify or release.

For candidate and CI state, reuse `pnpm agent:pr-status --pr <number> --json`. Reuse unchanged evidence; retain the exact revision, observation time and pending facts. Browser controls should be located from the observed DOM, and the final dialog state should be inspected after an action.

## Verification seams

| Approved candidate | Executable proof |
| --- | --- |
| 1 — project/access guards | Public tool tests with synthetic provider responses: wrong project, forbidden rights, pending verification and explicit browser fallback. |
| 2 — current instruction entrypoints | `pnpm agent:instructions`, included in Verify; CLI fixtures reject retired operative directives while historical ADRs remain readable. |
| 3 — bounded toast dismissal | `pnpm test:tooling`: real synthetic DOM expiry/detachment, blocked and multiple/hidden controls; both product journeys use the same helper. |
| 5 — reusable/private evidence | Public receipt/role/CLI tests: copy/envelope preservation, recipient-classified delivery, explicit execution, logout on failure and canary secrets absent from result/evidence. |

The existing opening-readiness fixture also runs the toast regression before its unchanged product journeys. Standard `pnpm verify` runs the production dependency audit, instruction guard, lint, types, all unit tests and build. This tooling follow-up changes neither the mail product contract nor the separately pending tracking release.
