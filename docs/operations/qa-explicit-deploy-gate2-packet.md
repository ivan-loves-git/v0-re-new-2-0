# Gate 2 packet — PR #30 QA explicit deploy controller

Status: **controller candidate ready for independent review**. Do **not** request `PUBLISH_APPROVED` until this PR is non-draft, independently reviewed, required checks are green, and the live cutover/rollback evidence table below is filled with provider readbacks from the executed cutover.

PR: https://github.com/ivan-loves-git/v0-re-new-2-0/pull/30  
Validation project: `renew-overnight-validation-20260820` / `prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y`  
Stable alias: `https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app`  
Product project (must stay Git-connected): `v0-re-new-2-0`  
Cumulative product PR #27: **parked** until controller canary and daily health both pass.

## What this controller changes

| Requirement | Implementation |
| --- | --- |
| No `workflow_run` admission | Golden Journeys triggers are only `repository_dispatch` (`qa_candidate`) and trusted `workflow_dispatch` |
| No `contents: write` | Workflow permissions are `contents: read` only; no qa pointer movement |
| No qa branch pointer | Admitted candidate branch + exact SHA deploy via Vercel Deployment API; forbidden refs include `qa`/`main` |
| Isolated `deploy-qa` job | Receives only `QA_VERCEL_TOKEN`, optional `QA_VERCEL_TEAM_ID`, and protection-bypass; refuses DB/Supabase secrets in-process |
| Sanitized provider evidence | Artifact includes deployment id, project, ref, SHA, target, READY, stable-alias readback; DB/browser jobs load it without the Vercel token |
| Daily health SHA | `resolve-sha` reads the stable alias; never `origin/qa` |
| Workflow regression tests | Permanent-lane / explicit-deploy / admission / phase-b contract tests lock the invariants above |

## Corrected cutover order (operator)

Execute in this order. Record provider evidence in the table; leave cells empty until proven.

1. Create and prove an expiring token scoped only to the QA validation project (`QA_VERCEL_TOKEN` in `qa-pilot`).
2. Migrate any `qa`-branch Preview environment values on the validation project to ordinary Preview scope.
3. Disable the old Golden Journeys workflow so no automatic or pointer-based lane can run during cutover.
4. Disconnect Git from the validation project only.
5. Verify the product project `v0-re-new-2-0` remains Git-connected.
6. Prove that the proposed `gitSource` API call still works after disconnection, or replace it with a supported source-upload deployment before enabling the lane.
7. Wait for provider capacity (read the live provider response; do not guess a quota-reset minute).
8. Merge the corrected controller through an explicitly documented bootstrap (this PR after independent review + green checks).
9. Re-enable the corrected Golden Journeys workflow.
10. Run one exact-SHA canary and protected P1–P3.
11. Prove one QA validation deployment and no additional product deployment caused by that admission.
12. Keep cumulative product PR #27 parked until the controller canary and daily health both pass.

## Live cutover evidence (fill during cutover)

| Step | Expected proof | Evidence (id / count / timestamp / actor) |
| --- | --- | --- |
| 1. QA-scoped expiring token | Token project scope = validation project only; expires; stored only in `qa-pilot` | _pending_ |
| 2. Preview env migration | No qa-branch-only env required for the admitted candidate path; ordinary Preview scope holds required values | _pending_ |
| 3. Old workflow disabled | Golden Journeys inactive before Git disconnect | _pending_ |
| 4. Validation Git disconnect | Validation project Git connection = disconnected | _pending_ |
| 5. Product Git still connected | Product project Git connection remains active | _pending_ |
| 6. gitSource or source-upload | One manual API deploy of an admitted branch+SHA reaches READY after disconnect | _pending_ |
| 7. Capacity wait | Provider accepts a deployment create without rate-limit | _pending_ |
| 8. Bootstrap merge | This PR merge commit SHA on `main` | _pending_ |
| 9. Workflow re-enabled | Corrected Golden Journeys active | _pending_ |
| 10. Exact-SHA canary | One `repository_dispatch` / `workflow_dispatch`; P1–P3 check green on that SHA | _pending_ |
| 11. One QA deploy, no product deploy from admission | Validation deploy delta = 1 for that SHA; product deploy delta attributable to admission = 0 | _pending_ |
| 12. PR #27 parked | No merge of #27 until canary + daily health pass | _parked_ |

## Exact rollback

1. Disable the corrected Golden Journeys workflow.
2. Stop using `QA_VERCEL_TOKEN` in the protected lane.
3. Reassign the preserved stable alias to the prior READY non-production deployment id recorded in sanitized provider evidence (`priorAliasSha` / rollback deployment id).
4. Only after a reviewed rollback decision, restore any prior temporary Git connection if explicitly required. Do not reconnect automatic Git as an unreviewed shortcut.

## Publish gate (do not skip)

Do **not** request `PUBLISH_APPROVED` until all of the following are true:

1. PR #30 is non-draft.
2. Independent review has accepted this corrected controller.
3. All required checks on the PR head are green.
4. The live cutover evidence table above contains exact provider readbacks for steps 1–11 (or step 6 documents a supported source-upload replacement).
5. One canary admission proved a single QA deployment and no admission-caused product deployment.
6. Daily health has succeeded using the alias-derived SHA after the canary.

## Related product programme

PR #27 (W-126–W-136 cumulative candidate) remains parked until the controller canary and daily health both pass. Do not rebase or merge #27 as part of this Gate 2 repair.
