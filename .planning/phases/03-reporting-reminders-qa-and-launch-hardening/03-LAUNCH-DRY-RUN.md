---
gsd_type: launch_dry_run
phase: "03-reporting-reminders-qa-and-launch-hardening"
created_at: "2026-05-17"
status: passed_with_note
browser: "real Chromium via Playwright"
target: "http://localhost:3012"
---

# June V2 Launch Dry Run

## Result

Dry run passed for the June V2 demo path.

The tested story works end to end: staff can inspect operating KPIs, review opportunities, open the demo opportunity, inspect recommendations, validate active pursuit state, confirm NDA/document status, and review repreneur responses. A demo repreneur can log in separately, see only the repreneur portal, inspect proposed deals, open the active pursuit, see the approved teaser after signed NDA, and view the read-only profile page.

## Evidence

Screenshots were saved locally in:

`output/playwright/launch-dry-run-20260517/`

Captured evidence:

- `01-staff-dashboard-kpis.png`
- `02-staff-dashboard-freshness.png`
- `03-staff-opportunities-list.png`
- `04-staff-opportunity-overview.png`
- `05-staff-recommendations.png`
- `06-staff-pursuit-nda-stage.png`
- `07-staff-documents.png`
- `08-staff-reviews.png`
- `09-access-staff-portal-redirect.png`
- `10-access-unauth-opportunities-login.png`
- `11-access-unauth-portal-login.png`
- `12-repreneur-login-filled.png`
- `13-repreneur-portal-deals.png`
- `14-repreneur-active-pursuit-documents.png`
- `15-access-repreneur-dashboard-redirect.png`
- `16-repreneur-profile.png`

## Staff Flow

| Check | Result | Notes |
| --- | --- | --- |
| `/dashboard` opens for staff | PASS | KPI and operating dashboard rendered. |
| Deal-flow operating view visible | PASS | Active opportunities, introductions, active pursuits, seller meetings, and documents/NDA indicators visible. |
| Opportunity freshness visible | PASS | Freshness panel rendered with 90-day stale framing. |
| `/opportunities` opens for staff | PASS | Opportunity records render with added date/month. |
| Demo opportunity opens | PASS | `DEMO-OPP-20260517-01` detail page rendered. |
| Overview/source separation visible | PASS | Staff detail view preserved internal context. |
| Recommendations tab visible | PASS | Platform recommendation and optional human recommendation areas rendered. |
| Pursuit tab visible | PASS | Active pursuit, seller meeting stage, signed NDA, and internal notes visible. |
| Documents tab visible | PASS | Approved teaser and staff-only NDA document visible to staff. |
| Reviews page visible | PASS | `/opportunities/reviews` rendered for staff review flow. |

## Repreneur Flow

| Check | Result | Notes |
| --- | --- | --- |
| Demo repreneur login | PASS | Demo account was repaired and login succeeded. |
| `/portal/deals` opens | PASS | Separate repreneur portal layout rendered. |
| Staff navigation hidden | PASS | Repreneur sees Deals/Profile/Sign out only. |
| Active pursuit opens | PASS | Active pursuit detail rendered. |
| Seller meeting state visible | PASS | Active pursuit status shows seller meeting stage. |
| NDA/document gate works | PASS | Approved teaser visible because NDA is signed. |
| Staff-only document hidden | PASS | Staff-only NDA document was not shown in repreneur portal. |
| `/portal/profile` opens | PASS | Read-only profile, scores, strengths, target thesis, improvement prompts, and CTAs rendered. |

## Access Boundaries

| Check | Result | Notes |
| --- | --- | --- |
| Unauthenticated `/opportunities` | PASS | Redirects to `/auth/login`. |
| Unauthenticated `/portal/deals` | PASS | Redirects to `/auth/login`. |
| Staff user visiting `/portal/deals` | PASS | Redirects to `/dashboard`. |
| Repreneur user visiting `/dashboard` | PASS | Redirects back to `/portal/deals`. |
| Repreneur portal hides internal source/contact details | PASS | Repreneur detail page shows anonymized deal context only. |
| Repreneur portal blocks staff-only downloads | PASS | Only approved teaser was shown. |

## Issue Found and Fixed

One launch-hardening issue was found during the dry run: the direct database user-creation helper used a password hash format that Better Auth no longer accepts. That kind of account record exists in the database but cannot log in.

Fix applied:

- `scripts/create-users-direct.ts` now imports and uses Better Auth's own `hashPassword` helper instead of generating a custom SHA-256 hash.
- The demo repreneur account password was reset with the valid Better Auth hash format for the dry run.

Verification:

- Better Auth hash generation and verification were tested locally.
- The demo repreneur login then passed in real Chromium.
- `pnpm run build` passed locally after the helper-script fix.

## Tooling Note

The Codex in-app browser had a clipboard/form-fill issue during the repreneur login step, so the remaining browser pass was completed with standalone Chromium driven by Playwright. This is a test-tool limitation, not a product issue.

## Build Warnings

The local build completed successfully, but printed non-blocking warnings:

- `baseline-browser-mapping` data is older than two months.
- React Email render packages reported `prettier` external-version warnings.
- The local main `.env.local` emitted Better Auth default-secret warnings during prerender. Production and preview deployments must keep a real `BETTER_AUTH_SECRET` configured.

## Remaining Release Notes

- Keep the June V2 scope strict during the demo.
- Do not present AI matching, PDF parsing, e-signature, M&A firm portal, investor reporting, or full repreneur self-service as June V2 deliverables.
- Before any production demo, run the same flow once against the deployed URL, not only localhost.

## Executive Summary

The June V2 launch demo is coherent enough to show: staff can run the deal workflow, and repreneurs now have a clearly separated portal experience with access boundaries that behave correctly.

The only material issue found was not in the app login page itself, but in a helper script that could create unusable accounts. That helper has been fixed, and the real-browser dry run now passes on localhost.
