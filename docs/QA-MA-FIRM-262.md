# M&A firms without prospect — acceptance proof

Authority: [Ticket #262](https://github.com/re-new-team/renew-governance/issues/262),
Ivan's approved single slice, and the accepted firm-state addendum in the
[canonical M&A dictionary](data-models/ma-advisory-data-model-v1.md).
Original #257 profile minima and historical/role protections remain binding.

The approved seams are the public staff actions, persisted database/service
behavior on disposable production-shaped PostgreSQL, and the actual protected
Supabase/Better Auth browser journey. Synthetic evidence proves the candidate,
not production activation. Exact results, candidate SHA, independent review,
screenshots and any authorized release receipt belong on the linked PR/#262.

| Acceptance | Observable proof |
| --- | --- |
| AC-01 | Staff action returns active with no invented contact; database service creates first and immediate second office; desktop/mobile browser creates, adds and reopens. |
| AC-02 | Pre-migration prospect has incomplete location, person, current/ended affiliations and opportunity snapshot. Full retained rows compare equal after normalization except firm status, including original update audit. Archived row remains identical. |
| AC-03 | Database default and retained legacy INSERT produce active; check rejects prospect UPDATE and unknown states. Firm headers/rows show archive only. |
| AC-04 | Former prospect gets another real office; archived service request fails and leaves no office. Actual desktop browser operates the firm seeded prospect before migration. |
| AC-05 | Existing directory minimum-field, atomicity and duplicate/concurrency rehearsal remains; office creates no person/opportunity. |
| AC-06 | Existing actual-role action tests deny unauthenticated/unassigned callers; protected browser denies repreneur access; RPC execution remains service-only. |
| AC-07 | Existing source-contact, selected-firm office and External Pursuit conversion tests retain real/default/provisional and archive exclusion; opportunity primary/email rehearsal remains. |
| AC-08 | Induced normalization failure and rollback-only preflight retain original state/default/clock; preflight forces deferred constraints; repeat install changes no additional rows; retained graph and scoped cleanup proof pass. |
| AC-09 | Protected M&A browser journey runs desktop/mobile, checks persisted state and screenshots; scoped tests/types, conditional dictionary checker, full verify and exact-candidate CI precede acceptance. |
| AC-10 | Dictionary records approval, enum/default, archive rules, visibility/ownership, legacy compatibility, exact data treatment and non-destructive rollback. |

Run `bash scripts/rehearse-ma-directory.sh` for the disposable database proof.
Run the existing `Opening readiness fixture` workflow for browser proof; its
protected isolated-runner guards stay intact. Production treatment is limited
to the reviewed status-only migration and any separately recorded live QA.
