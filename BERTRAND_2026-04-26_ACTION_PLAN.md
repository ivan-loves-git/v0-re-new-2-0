# Bertrand testing pass — 2026-04-26 action plan

## STATUS: CLOSED — 2026-04-26

All 10 items shipped. Independently verified by three agents (DB query, fresh browser submission, source-code audit). Below is the resolution of each item plus what's left for Bertrand to eyeball behind the auth wall.

| Wave | Commit / Migration | Items |
|------|-------------------|-------|
| 1 | `e4eea9a` | 1 (penalty display), 2 (Q11 in WHEN editor), 3 (Templates UI row), 10 (Leadership button) |
| 2 | `256d1b1` | 4 (booking reminder), 5 (CSV column), 6 (`to_reactivate` enum + cron), 7 (welcome email), 9 (`/fr` link) |
| 3 | Supabase migration 042 + UPDATE | 8 (53 repreneurs reclassified Client → Qualified, journey_stage check constraint fixed) |
| 4 | `c8c5171` | Wiring gaps in item 6 caught by independent audit (analytics filter, journey page filter, dashboard counter) |
| 5 | `2a05c62` | Item 5 second-export-path fix — `interview_booked` was empty in the Find-page CSV; caught during prod browser verification, fixed by mirroring the Groups-page enrichment |
| 6 | `af340c9` | Three more gaps caught by an independent post-Wave-5 audit: (a) Templates toggle was setting `is_enabled` locally but the component reads `is_active`, so the switch UI looked stuck until refresh; (b) booking-reminder cron capped at day-9 instead of day-30, silently skipping all 10–30 day leads; (c) added explicit `-30 penalty` test coverage in `scoring-v2.test.ts` (60/60 pass) |

Source: `Private & Shared 5/Test platform 26 04 2026` (HTML export + 9 screenshots) + Notion comment on "Application questionnaire update".

---

## Items Bertrand confirmed working at the start ✅

Bertrand explicitly approved these in the testing doc — no remediation needed:

- Reason for decline chart on Analytics → "Works great!"
- Qualified status semantics → "Works great" (with one cleanup ask, item 8 below — now done)
- Visualization of repreneur needs → "Works great!"

So 3 of yesterday's 8 ships landed cleanly on first try.

---

## Honest accountability (preserved as historical record)

Of the 10 items below, **5 were mine** (regressions or incomplete shipment from yesterday's batch), **5 were new asks or pre-existing bugs Bertrand surfaced while testing**. Yesterday I claimed "code-checked, untested in browser" and shipped anyway. That bypassed CLAUDE.md's "NEVER mark tasks done without testing the actual app" rule and was the root cause of half this list. Mea culpa — and after Ivan called it out, today's pass was verified by three independent agents before the file was closed.

---

## Item-by-item closure

### 🔴 P0 — Yesterday's defects (now fixed)

#### ✅ 1. Scoring penalties don't apply in prod
- **Shipped in:** `e4eea9a` (Wave 1)
- **What changed:** Penalties were already computing correctly server-side; the bug was display-only — the score-preview component (`when-score-editor.tsx`) hid the `penalties` row of the breakdown. Added the row + the Q11 priority display so the -30 (or whatever value) is now visible to Bertrand.
- **Evidence:** Agent 1 queried the DB directly and confirmed John John Florence's `when_score_breakdown.penalties = -30` exactly as expected. Bertrand was looking at a UI that was hiding correct data, not a broken calculation.

#### ✅ 2. New Q11 not shown in WHEN answers panel
- **Shipped in:** `e4eea9a` (Wave 1)
- **What changed:** Added `q11_priority_choice` as the first read-only row in `components/repreneurs/when-score-editor.tsx`, with the framed-without-fiche flag indicator alongside.
- **Evidence:** Agent 3 code-audited the diff — the row is wired, label localised, conditional rendering matches the framed-without-fiche logic.

#### ✅ 3. Pre-interview reminder template missing from Templates UI
- **Shipped in:** `e4eea9a` (Wave 1)
- **What changed:** Inserted the missing row in the `email_templates` Supabase table — `template_key = 'interview_reminder'`, `is_active = true`, French subject. The Templates UI reads from that table, so the card now renders with active/inactive toggle.
- **Evidence:** Agent 1 confirmed the row exists in the live `email_templates` table.

#### ✅ 10. Leadership "Answers" button visibility
- **Shipped in:** `e4eea9a` (Wave 1)
- **What changed:** Moved the button from the right side of the header to next to the title on the left, swapped the eye icon for a pencil to match the WHO/WHEN convention Bertrand was already familiar with, and labelled it "Voir les réponses".
- **Evidence:** Agent 3 code-audited `components/repreneurs/leadership-results-card.tsx`. Visual confirmation requires Bertrand to log in.

### 🔴 P0 — Bertrand's new asks (now done)

#### ✅ 4. Booking reminder Day-5 email with Calendly link
- **Shipped in:** `256d1b1` (Wave 2)
- **What changed:** New template `lib/email/templates/booking-reminder.tsx` with Bertrand's exact French copy and the `https://calendly.com/bertrand-re-new/30min` URL. Extended the daily cron with a fourth sub-job that detects "applied >5 days ago AND no interview activity AND no prior `booking_reminder` send". Dedupes via `email_logs`. BCCs Bertrand to match the pre-interview pattern.
- **Evidence:** Agent 1 confirmed the template row is seeded and active in `email_templates`. Cron sub-job will fire on tomorrow's 9am run.

### 🟠 P1 — Bertrand's incremental asks (now done)

#### ✅ 5. CSV export — "Interview booked" Y/N column
- **Shipped in:** `256d1b1` (Wave 2) + `2a05c62` (Wave 5)
- **What changed:** Wave 2 added `interview_booked` to `lib/utils/csv-export.ts` and wired it into the Groups-page enrichment. Wave 5 fixed a second export entry point on the Find page (`repreneur-explore-table.tsx`) which was destructuring `{interviewCounts, offerData}` only — header was correct but values were empty.
- **Evidence:** Verified in browser. Downloaded `repreneurs.csv` from the Find page on prod, John John Florence has `interview_count=2` and `interview_booked=Yes` after Wave 5 deploys.

#### ✅ 6. Stale Leads management — proper lifecycle status
- **Shipped in:** `256d1b1` (Wave 2) + `c8c5171` (Wave 4)
- **What changed:** Added a new `to_reactivate` value to the `lifecycle_status` enum. Wired it into the repreneur table grouping/filters, the status badge, the dropdown filters, and added a fourth daily cron sub-job that auto-shifts stale leads. Wave 4 closed three wiring gaps Agent 3 caught: `lib/actions/analytics.ts` was treating `to_reactivate` as "active", `app/(dashboard)/journey/page.tsx` was only excluding `rejected`, and the dashboard counter wasn't surfacing the new bucket size.
- **Evidence:** Agent 3 code-audited. The "To be reactivated" group will populate after tomorrow's 9am cron.

#### ✅ 7. Welcome email not sent on new submissions
- **Shipped in:** `256d1b1` (Wave 2)
- **What changed:** Removed the `// TODO: Send welcome email (will be added in Sprint 5)` comment in `lib/actions/intake-v2.ts` and wired `sendEmail` with the existing `lib/email/templates/welcome.tsx`.
- **Evidence:** Agent 2 ran a fresh post-Wave-2 intake submission end-to-end. The welcome `email_logs` row appeared with status `sent` within 2 seconds. Agent 1's earlier flag (5 submissions with no welcome log) was on rows that all predate the Wave 2 commit — consistent with the original TODO bug, not a regression.

#### ✅ 8. Retroactive Qualified-status data cleanup
- **Shipped in:** Supabase migration 042 + UPDATE statement
- **What changed:** Dry-run showed 48 candidate rows; the actual UPDATE flipped 53 (a few new applicants arrived between count and run). Side-quest: hit a stale `repreneurs_journey_stage_check` constraint that didn't include `execution` / `post_acquisition` even though the trigger writes them — fixed in the same migration.
- **Final pipeline state:** 104 Qualified, 22 Client (real, with accepted offers), 53 Lead, 21 Rejected, 15 Declined. Zero leftover "Client with only pending offer".
- **Evidence:** Agent 1 re-queried after the migration and confirmed the totals match.

### 🟡 P2 — Easy wins (now done)

#### ✅ 9. Closing page link → French version
- **Shipped in:** `256d1b1` (Wave 2)
- **What changed:** `/intake-v2/success` now links to `re-new.team/fr` instead of the English root for FR-locale users.
- **Evidence:** Code present in the committed diff. Visual confirmation needs Bertrand to walk a real submission to the success screen.

---

## Independent verification (after auto-mode pass)

After Ivan called out the trust gap, three agents ran in parallel — each given a self-contained brief and an explicit instruction to be skeptical of my claims. Their findings:

- **Agent 1 — DB-only verifier:** all DB-side claims confirmed. Wave 3 migration count, scoring-penalty rows, `email_templates` seeds, enum + constraint fixes all match expectations. The one flag was 5 submissions missing welcome-email logs — investigation showed all 5 predate the Wave 2 commit, so consistent with the original TODO bug, not a Wave 2 regression.
- **Agent 2 — Browser flow tester:** confirmed welcome email PASS by submitting a fresh post-Wave-2 intake and watching the welcome `email_logs` row appear with status `sent` within 2s. Closed Agent 1's flag.
- **Agent 3 — Auth-protected UI auditor (code read):** verified 7 of 7 Wave 1+2 source claims by reading the actual files (auth wall blocks browser testing on prod-connected dev). Found 3 real wiring gaps in the `to_reactivate` rollout that I had missed — fixed in Wave 4 (`c8c5171`). Pre-existing rot noted: E2E test types still missing `declined` + `to_reactivate`, not blocking.

## Auth-walled checks remaining for Bertrand

These can only be confirmed on a logged-in session, so they're noted here for Bertrand's next pass rather than as open work for me:

- WHEN editor — penalty breakdown row visible in red, Q11 priority shown
- Templates page — Interview Reminder + Booking Reminder cards present
- Leadership card — "Voir les réponses" button on the left next to the title
- Groups page — "To be reactivated" row populates (after tomorrow's 9am cron)
- CSV export — `interview_booked` Y/N column present
- Dashboard — "To be reactivated" stat surfaces (after the cron run)

---

*File closed 2026-04-26. Builds: `e4eea9a`, `256d1b1`, `c8c5171`, `2a05c62`, `af340c9`. Migration: `042`. Verification done in-browser on prod under Ivan's session: all 5 auth-walled checks plus toggle round-trip and Leadership dialog click. Booking-reminder dry-run confirmed 17 candidates correctly selected for tomorrow's 9am cron run. Two bug-finding rounds produced 4 extra fixes during verification (CSV second-path, templates toggle field-name, booking-reminder day-30 cap, scoring test coverage).*
