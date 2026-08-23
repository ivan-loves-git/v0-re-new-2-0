# Gate 2 packet — PR #30 QA explicit deploy controller

Status: **cutover in progress**. Controller code is corrected; live Vercel cutover steps 1–6 are proven below. Do **not** treat product cards as Done until canary + daily health pass. PR #27 remains parked.

PR: https://github.com/ivan-loves-git/v0-re-new-2-0/pull/30  
Validation project: `renew-overnight-validation-20260820` / `prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y`  
Stable alias: `https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app`  
Product project (must stay Git-connected): `v0-re-new-2-0`  
Cumulative product PR #27: **parked** until controller canary and daily health both pass.

## Live cutover evidence

| Step | Expected proof | Evidence |
| --- | --- | --- |
| 1. QA-scoped expiring token | Token project scope = validation project only | **Done** — `vcp_` project token; `/v9/projects` returns only `prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y`; team list forbidden |
| 2. Preview env migration | qa-branch Preview values on ordinary Preview | **Done** — 11 `gitBranch=qa` duplicates deleted after confirming ordinary Preview twins; remaining branch-scoped env = `[]`; ordinary Preview count = 19 |
| 3. Old workflow disabled | Golden Journeys inactive before Git disconnect | **Partial** — GitHub integration token cannot disable workflows (HTTP 403). Merge of corrected workflow removes `workflow_run` admission. Manual disable still preferred if available. |
| 4. Validation Git disconnect | Validation project Git connection = disconnected | **Done** — `DELETE /v9/projects/prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y/link` → `link: null` (2026-08-23) |
| 5. Product Git still connected | Product project Git connection remains active | **Done (indirect)** — QA-scoped token cannot read product project (correct). Latest `main` still has live `Vercel – v0-re-new-2-0` status context; validation no longer linked |
| 6. gitSource or source-upload | API deploy of admitted branch+SHA reaches READY after disconnect | **Done** — created `dpl_5PMrFtSqEWM7Rbv9coSxa245cXvm` with `gitSource` (branch `cursor/qa-explicit-deploy-controller-37c3`, SHA `60f3348…`), `readyState=READY`, `target=null` (non-production). Note: `target:"preview"` is rejected by Deployment API after disconnect; controller updated to omit target. Alias assigned via `POST /v2/deployments/:id/aliases`. Alias readback SHA = `60f3348140944c741fa8b49e1e658e73adbb0164` |
| 7. Capacity wait | Provider accepts deployment create without rate-limit | **Waiting** — Hobby `api-deployments-free-per-day` exhausted; provider reset ≈ `2026-08-24T11:31:03.028Z` |
| 8. Bootstrap merge | This PR merge commit SHA on `main` | **Pending** — after Verify green on post-cutover controller fix |
| 9. Workflow re-enabled | Corrected Golden Journeys active | **Pending** after merge |
| 10. Exact-SHA canary | One dispatch; P1–P3 green | **Blocked** until GitHub `qa-pilot` has `QA_VERCEL_TOKEN` (bot cannot write secrets: HTTP 403) and capacity resets |
| 11. One QA deploy, no product deploy from admission | Validation delta = 1; product delta from admission = 0 | **Pending** canary |
| 12. PR #27 parked | No merge of #27 | **Parked** |

## Exact rollback

1. Disable the corrected Golden Journeys workflow.
2. Stop using `QA_VERCEL_TOKEN` in the protected lane.
3. Reassign the preserved stable alias to the prior READY non-production deployment id recorded in sanitized provider evidence.
4. Only after a reviewed rollback decision, restore any prior temporary Git connection if explicitly required. Do not reconnect automatic Git as an unreviewed shortcut.

Current proven READY deployment on stable alias: `dpl_5PMrFtSqEWM7Rbv9coSxa245cXvm` @ SHA `60f3348140944c741fa8b49e1e658e73adbb0164`.

## Remaining blocker (one click)

GitHub Environment `qa-pilot` still needs secret `QA_VERCEL_TOKEN` set to the same project-scoped Vercel token already provided to this agent. This bot cannot write environment secrets (HTTP 403). Optional: `QA_VERCEL_TEAM_ID=team_ZBRRlhayqlLIURUcxtq6pky0`.

## Related product programme

PR #27 (W-126–W-136 cumulative candidate) remains parked until the controller canary and daily health both pass.
