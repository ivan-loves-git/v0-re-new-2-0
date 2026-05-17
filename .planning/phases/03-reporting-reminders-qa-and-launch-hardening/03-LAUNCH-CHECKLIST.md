---
gsd_type: launch_checklist
phase: "03-reporting-reminders-qa-and-launch-hardening"
created_at: "2026-05-17"
status: ready
---

# June V2 Launch and Demo Checklist

## Demo Story

The demo should show one clear story: Re-New receives opportunities, records them cleanly, recommends a repreneur, validates one active pursuit, controls the NDA/document gate, and sees operational health from the dashboard.

Recommended demo record:

- Opportunity: `DEMO-OPP-20260517-01`
- Repreneur login profile: `myworkmail4@gmail.com`
- Current demo state: active pursuit, seller meeting stage, signed NDA, approved teaser document, staff-only NDA document.

## Staff Demo Flow

- [ ] Open `/dashboard`.
- [ ] Show `Deal-flow operating view`.
- [ ] Point out active opportunities, introductions, active pursuits, seller meetings, and document/NDA indicators.
- [ ] Show `Opportunity freshness`.
- [ ] Explain that stale means open, older than 90 days, and no active pursuit.
- [ ] Open `/opportunities`.
- [ ] Show opportunity records with exact date added and month added.
- [ ] Open `DEMO-OPP-20260517-01`.
- [ ] Show overview and source separation.
- [ ] Open `Recommendations`.
- [ ] Explain platform recommendation plus optional human recommendation.
- [ ] Open `Pursuit`.
- [ ] Show active pursuit, seller meeting stage, signed NDA, and internal notes.
- [ ] Open `Documents`.
- [ ] Show approved teaser and staff-only NDA document.
- [ ] Open `/opportunities/reviews`.
- [ ] Explain how repreneur interest/not-fit responses are reviewed before active pursuit validation.

## Repreneur Demo Flow

- [ ] Log in with the demo repreneur only when needed for the live demo.
- [ ] Open `/portal/deals`.
- [ ] Show separated repreneur portal layout.
- [ ] Show anonymized opportunities, not staff dashboard pages.
- [ ] Open the active pursuit.
- [ ] Show active pursuit state and seller meeting stage.
- [ ] Show document availability only because NDA is signed.
- [ ] Open `/portal/profile`.
- [ ] Show read-only profile, strengths, scores, improvement points, and calls to action.

## Access and Boundary Checks

- [ ] Unauthenticated `/opportunities` redirects to `/auth/login`.
- [ ] Unauthenticated `/portal/deals` redirects to `/auth/login`.
- [ ] Staff users are sent away from `/portal/deals` to `/dashboard`.
- [ ] Legacy `/my-opportunities` routes to the portal path and then respects the user role.
- [ ] Repreneur users do not see internal staff navigation.
- [ ] Staff-only source/contact information is not visible in repreneur portal screens.
- [ ] Staff-only documents are not downloadable from the repreneur portal.

## Pre-Merge Release Checks

- [x] `pnpm run build` passes locally.
- [ ] Confirm no secrets are staged in git.
- [ ] Confirm `.env.local`, database passwords, and Supabase service role keys are not committed.
- [ ] Confirm GSD roadmap/state are updated.
- [ ] Confirm V3 backlog is written and deferred scope is not represented as June work.
- [ ] Push the feature branch.
- [ ] Merge to `main` only after the branch build is green.

## Vercel Deploy Checks

- [ ] Watch the Vercel build log after pushing/merging.
- [ ] Confirm `/dashboard` renders after deployment.
- [ ] Confirm `/opportunities` renders after deployment.
- [ ] Confirm `/opportunities/reviews` renders after deployment.
- [ ] Confirm `/portal/deals` redirects unauthenticated users to login.
- [ ] Confirm the deployed build does not repeat the previous static-render auth error.
- [ ] If Vercel fails, keep the branch unmerged or revert the merge commit and use the local UAT branch as the source of truth for fixes.

## Post-Launch Monitoring

- [ ] Check that staff can create/edit an opportunity after deploy.
- [ ] Check that staff can add a match and adjust human recommendation.
- [ ] Check that repreneur interest/not-fit responses appear in reviews.
- [ ] Check that active pursuit lock prevents a second active pursuit.
- [ ] Check that dropping an active pursuit reopens exposure correctly.
- [ ] Check that signed/waived/not-required NDA states allow approved document downloads.
- [ ] Check that required/sent NDA states block document downloads.
- [ ] Ask the team to report any confusing wording in the repreneur portal after the first demo.

## Known Limitations to Say Out Loud

- AI matching is not in June V2.
- Automatic PDF parsing is not in June V2.
- M&A firm portal is not in June V2.
- E-signature is not in June V2.
- Full repreneur self-service/profile editing is not in June V2.
- Investor-style reporting is not in June V2.
- Lint cannot run until `eslint` is added or the script is changed.
- Full typecheck has existing baseline errors outside this V2 work.

## Executive Summary

June V2 is ready to demo as an operating workflow, not as a polished external product suite. The strongest story is one opportunity moving through sourcing, recommendation, repreneur response, active pursuit, seller meeting, NDA, documents, and operating KPIs.

The launch boundary is strict: what is not in the checklist should not be improvised into the demo as a June commitment. Those ideas belong in the V3 backlog.
