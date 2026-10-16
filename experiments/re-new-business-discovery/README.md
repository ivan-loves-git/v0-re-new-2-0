# Re-New Business Discovery — fictional connected trial

This is a disposable technical-feasibility experiment. It exposes a stateless Streamable HTTP MCP endpoint at `/api/mcp`, plus a minimal `/api/health` response, with two read-only tools:

Ivan accepted the rough discovery/access journey on 30 September 2026: [prototype verdict](https://github.com/re-new-team/renew-governance/issues/239#issuecomment-5913037494). The unmodified primary source is `prototype.html`, SHA-256 `162ca2353596ad89a9dd9c407dcdf28855ad2d07412871648e033a098c859fe5`. This records prototype feedback, not buyer demand. [Trial authority](https://github.com/re-new-team/renew-governance/issues/245#issuecomment-5915839492) and [implementation evidence](https://github.com/re-new-team/renew-governance/issues/246) own the connected trial.

- `search_public_opportunities` filters fictional, anonymous teasers by optional sector, France, and annual revenue band, returning at most three eligible cards.
- `get_public_opportunity_teaser` rechecks that the fictional card is active and publication-approved before returning it.

Every response is explicitly fictional. There is no database, authentication, OAuth, LLM call, API key, analytics/logging pipeline, real opportunity, real identifier, contact data, form submission, or saved buyer state.

The generic buyer handoff is `https://app.re-new.team/auth/login`. Its instructions are: click **Request it** to open **Request access**, then choose **Repreneur** (buyer). These labels were verified against the live English interface on 30 September 2026 without entering or submitting form data. The handoff carries no teaser identity or context; it does not submit a form, reserve a business, grant access, or reveal protected information.

## Run locally

```sh
npm install
npm run verify
npm start
```

`npm run verify` starts the endpoint on a disposable local port and proves module filtering, unavailable detail behavior, the generic access link, MCP initialization, tool listing, and a tool call.

This package is deliberately isolated under `experiments/`; it does not alter the Re-New application dependency graph, runtime, or deployment configuration. `prototype.html`, this README and trial tests are excluded from a Vercel upload; only the synthetic API endpoints need hosting.
