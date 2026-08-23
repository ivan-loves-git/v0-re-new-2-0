# Gate 2 packet — PR #30 QA explicit deploy controller

Status: **provider canary proven; GitHub workflow bootstrap pending**. Vercel cutover steps 1–7 and live deploy canary (step 11 partial) are proven below. Do **not** treat product cards as Done until canary + daily health pass. PR #27 remains parked.

PR: https://github.com/ivan-loves-git/v0-re-new-2-0/pull/30  
Validation project: `renew-overnight-validation-20260820` / `prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y`  
Stable alias: `https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app`  
Product project (must stay Git-connected): `v0-re-new-2-0`  
Cumulative product PR #27: **parked** until controller canary + daily health both pass.

## Live cutover evidence

| Step | Expected proof | Evidence |
| --- | --- | --- |
| 1. QA-scoped expiring token | Token project scope = validation project only | **Done** — `vcp_` project token; `/v9/projects` returns only `prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y` |
| 2. Preview env migration | qa-branch Preview values on ordinary Preview | **Done** — branch-scoped env = `[]`; ordinary Preview count = 19 |
| 3. Old workflow disabled | Golden Journeys inactive before Git disconnect | **Partial** — bot cannot disable workflows (403). Corrected workflow lands with PR #30 merge |
| 4. Validation Git disconnect | Validation project Git connection = disconnected | **Done** — `link: null` on `prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y` |
| 5. Product Git still connected | Product project Git connection remains active | **Done (indirect)** — QA token cannot see product project; `main` still posts product Vercel statuses |
| 6. gitSource or source-upload | API deploy of admitted branch+SHA reaches READY | **Done** — multiple READY explicit-v1 deployments after disconnect; supported post-disconnect target is `null` |
| 7. Capacity wait | Provider accepts deployment create | **Done** — quota probe + canary create succeeded 2026-08-23T13:41Z |
| 8. Bootstrap merge | PR #30 merge commit on `main` | **Blocked** — branch protection requires `P1-P3 protected pilot` (created only after Golden Journeys on `main`) |
| 9. Workflow re-enabled | Corrected Golden Journeys on `main` | **Pending** merge |
| 10. Daily health on current `main` | Alias-derived SHA health succeeds | **Pending** after merge — required before ordinary Golden Journeys admission |
| 11. Exact-SHA canary (GitHub) | One dispatch; P1–P3 green | **Blocked** until daily health on current `main` passes |
| 12. One QA deploy, no product deploy from admission | Validation delta = 1; product delta = 0 | **Provider-path only** — see below (not controller proof) |
| 13. PR #27 remains parked | No merge of #27 | **Parked** |

## Provider canary proof (2026-08-23)

Admitted candidate:
- Branch: `cursor/qa-explicit-deploy-controller-37c3`
- SHA: `b92d08aa35d6b6454de79657042755718c3f5e3d`
- Verify run: `32637324226` (green)

Exactly one new READY validation deployment for this admission:
- **Deployment id:** `dpl_3mve6U8DoqRnCGn6mLNwh7r7cGr7`
- **Project:** `renew-overnight-validation-20260820` / `prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y`
- **Controller meta:** `renewQaController=explicit-v1`
- **Target:** non-production (`target=null`)
- **Stable alias readback SHA:** `b92d08aa35d6b6454de79657042755718c3f5e3d` (matches admitted SHA)

Zero product deployment from this admission:
- GitHub commit statuses on admitted SHA before and after canary: only `Vercel` (rate-limit failure) — **no** `Vercel – v0-re-new-2-0` status added by the explicit validation deploy API call
- Validation project remains Git-disconnected (`link: null`)

Sanitized provider evidence fields recorded at canary time:
- deploymentId, projectId, projectName, gitRef, candidateSha, target=null, readyState=READY, alias, aliasServedSha, controller=explicit-v1

## Bootstrap unblock (operator)

1. **Merge PR #30 to `main` with branch-protection bypass** (required check `P1–P3 protected pilot` cannot exist until the corrected controller runs once on `main`).
2. Re-enable the corrected Golden Journeys workflow if it was disabled for cutover.
3. Run **QA daily health** on current `main` and require success before any ordinary Golden Journeys admission.
4. **Run Golden Journeys** via `workflow_dispatch` on `main` with an open same-repository candidate (branch, SHA, green Verify `pull_request` run id).
5. Confirm protected P1–P3 check green on that SHA.
6. Only then rebase/unpark PR #27.

## Exact rollback

1. Disable the corrected Golden Journeys workflow.
2. Stop using `QA_VERCEL_TOKEN` in the protected lane.
3. Reassign the preserved stable alias to the prior READY non-production deployment id from sanitized provider evidence.
4. Only after a reviewed rollback decision, restore any prior temporary Git connection if explicitly required.

Current stable alias deployment: `dpl_3mve6U8DoqRnCGn6mLNwh7r7cGr7` @ SHA `b92d08aa35d6b6454de79657042755718c3f5e3d`.

## Related product programme

PR #27 (W-126–W-136 cumulative candidate) remains parked until GitHub Golden Journeys canary + daily health both pass on `main`.
