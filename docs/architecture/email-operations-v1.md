# Email operations contract

Accepted by [Decision #250](https://github.com/re-new-team/renew-governance/issues/250), implemented under [Product Change #247](https://github.com/re-new-team/renew-governance/issues/247) / [Ticket #253](https://github.com/re-new-team/renew-governance/issues/253). The additive candidate extends the released M&A contract; production migration, provider/DNS changes, deployment and real sends remain separately held. This document specifies candidate behavior, not evidence of a production release.

## Catalogue and source authority

The staff navigation order is **Review & send → History → Templates → Manual Send → Analytics**. Catalogue entries are indexed centrally by `TEMPLATE_METADATA` and `CODE_EMAIL_CATALOGUE`. A visible entry does not create a trigger. Stable variants may explicitly share a policy key, never a new campaign.

| Type / variant | Existing eligible source | Category / policy |
| --- | --- | --- |
| `welcome`: completed v2 / legacy first contact | Saved complete v2 intake / saved first legacy step; frozen variant retained | Inscription; both use `welcome` |
| `thank_you`, `high_score_alert` | Legacy questionnaire completion; high score still requires the existing 70 threshold | Inscription |
| `form_step_complete` | Existing callable legacy/template variant; no new automatic hook | Inscription |
| `abandoned_reminder` | Exact incomplete tracking row, next reminder number and 24-hour inactivity | Inscription |
| `booking_reminder` | Current lead cohort, actual latest Outlook request, five Paris weekdays, no interview | Inscription |
| `interview_reminder`, `rejection` | Exact scheduled interview / recorded current rejection | Status |
| `offer_received`, `offer_accepted`, `offer_activated`, `milestone_completed` | Existing assignment/acceptance/milestone events and permitted manual variants; no activation trigger added | Offers |
| `opportunity_recommendation_assignment` | Current exact recommendation notification and approved title/teaser | M&A |
| `locked_opportunity_interest` | Exact current direct-interest timestamp/token to configured staff | M&A; code-governed reusable copy |
| `proposed_opportunity_response_staff`, `interest_outcome_validated`, `interest_outcome_rejected` | Exact source-owned interest event, unchanged scope/withdrawal/consent gates | M&A |
| `recommendation_response_reminder`, `recommendation_unanswered_staff_alert` | Exact immutable 72-hour cycle and reminder/expiry kind | M&A |
| `memo_feedback_reminder` | Exact current confidential grant; five Paris weekdays, no substantive feedback, current access | M&A |
| `opportunity_memo_available` | Exact current authorized memo grant and match; queue never grants access | M&A; code-governed reusable copy |
| `opportunity_discovery_digest` | Released future-only epoch/window; public-copy/consent/opt-out and release cutover retained | M&A; code-governed, inactive values retained |
| Five `ma_*` templates | Existing current canonical intermediary and permitted operational purpose | M&A |
| E4 / E7 code variants | Exact current validation and exact authorized attachments | M&A; use `ma_nda_info_memo_request` policy |
| `code:e6_nda_ready` | Exact current validated blank NDA and canonical repreneur | M&A; separate catalogue policy |
| Grouped freshness code variant | Frozen group, canonical contact, current member/episode ownership | M&A; use `ma_opportunity_validity_check` policy |
| `portal_access_setup`, `password_reset` | Personal existing setup/reset flow, including one-hour/seven-day setup variants | System; active/automatic controls locked |
| Critical operation alert | Existing privacy-safe technical alert to configured operators | System; code-governed; outside business analytics |

Only current staff may read or mutate staff policy, reviews, history and Analytics. All added tables have RLS; views and RPCs are revoked from public/anon/authenticated and exposed only to the staff-gated server/service role. No client-supplied actor is trusted. Mail content/recipient facts remain operational evidence and never become product-learning telemetry.

## Prospective dispatch policy

`email_templates.is_active` and `auto_send` are independent. The additive migration defaults **every business Auto-send to false**, preserves existing activation/custom copy and adds the three previously uncatalogued code business entries. Missing/inactive policy fails closed. Access and reset senders bypass business review and have no CC. Their existing token, expiry, anti-enumeration and delivery flow remain authoritative.

Active business + Auto-send off prepares one source-bound review. Active + Auto-send on permits only a new eligible operation after the existing gates. Preparation persists its policy/version; each setting change records actor, old/new policy and effective time. Enabling never drains an existing review. A change since preparation prevents unstarted automatic claiming; turning off vetoes an unstarted automatic attempt. In-flight/accepted mail retains its identity and is reconciled. Manual Send follows the same path and displays the actual prepared/accepted outcome.

New staff-recipient notices also retain their canonical match parent and follow its existing deletion cascade. New provider facts are removed only when their last retained operational parent is deleted through the existing owning process; no historic rows are purged or rewritten. The business review identity is an immutable operation key, original event context, canonical recipient, repreneur namespace and prepared time. Preparing or releasing a notification lease does not record a sent clock, consume a reminder or grant access. Source-owned interest/cycle/grant/digest/recommendation services are re-entered at approval, retaining their current fences instead of replaying a business mutation. Generic offer, intake, interview, rejection and reminder contexts are revalidated. REAL/DEMO, canonical relationships, consent, suppression, document grants, exact upstream evidence, immutable documents and the established uncertainty windows remain authoritative.

## Frozen words, envelope and selection

All business drafts allow individual subject/prose editing only while pending, unarchived and unattempted, with compare-and-swap version checks. Recipients, event context, authorized URLs and attachment identities cannot be edited. Existing old drafts retain their saved words and source identity. A general template change yields an informational **Template updated** notice; retained valid wording can still send. **Apply newer template copy** is an explicit versioned replacement built from the current actual source where a reusable copy exists; code-governed copy does not pretend to be editable reusable content. Required links remain protected, and E4/E6/E7 operational versions/document gates remain separate from general prose freshness.

The shared future business CC is Bertrand `bertrand.galas@edu.escp.eu` and Colin `colin.hofman@edu.escp.eu`, selected/verified under #247. It is normalized and deduplicated against To and each other. The actual CC is frozen before provider I/O, retained with the dispatch, and included in provider request fingerprints. Staff-copy suppression is checked; access/setup/reset variants have no business CC. QA requires two explicit fictional CC addresses inside the existing isolated allowlist.

A selected batch still contains at most five unattempted REAL drafts from the same current server-filtered page. The preparer acknowledges each complete snapshot, then confirms its manifest. Each item claims serially; repeats return the saved state. Business rows can have no opportunity parent but retain the same version/context/namespace/no-attempt fences. Acceptance requires a retained provider receipt on that exact review; unknown finalization remains uncertain. Archive/restore never sends and cannot hide in-flight/unknown evidence.

## Retained history and cohorts

`email_operations_history` is a private source-backed projection over generic logs, business/source reviews, canonical M&A interactions and pursuit delivery receipts. Provider identity and logical operation identity deduplicate common rows. **Sent** shows at most the latest 150 accepted messages, including later bounces; the cap never deletes evidence. **History** searches all retained sources before pagination, then reads an actual record with its retained body/envelope and independent event chronology. No historical body is regenerated. Unknown sent dates remain null; missing body/envelope/reason is labelled unavailable. Failed generic records without provider acceptance do not count as sent. Access bodies are never exposed by this surface.

One selected 7/30/90-day half-open send-time cohort feeds every Analytics card and both graphs. Paris dates group daily volume; each business message belongs exactly once to Status, Inscription, Offers or M&A. DEMO, test and access mail are excluded. CC copies, retries and duplicated ledger receipts add no volume.

Provider acceptance, delivery, bounce, open and click remain separate facts. Signed events are idempotent by event ID and survive reordering. New requests carry the constant `renew_mail_class=business` provider tag; personal access requests carry `access`, with no identities or tokens in tags. A signed tagged business event may arrive before its receipt; the endpoint returns a retryable 503 until the exact operational parent exists. Access and unrelated/unowned events are acknowledged without retention. The event RPC refuses unowned facts, so no new orphan retention clock is introduced. The provider's [documented retries](https://resend.com/docs/webhooks/retries-and-replays) are finite and persistent endpoint failures can disable it: an authorized operator must inspect the exact failed event/receipt, restore endpoint health and replay only that event after correlation is recovered. Exhaustion or an unavailable receipt means missing measurement, never measured zero and never an automatic mail retry. No raw payload, IP, user agent or clicked URL is retained. Primary delivery/bounce/failure/suppression facts require exact recipient evidence; copy failures never overwrite primary status. Opens/clicks remain message activity, including copy/proxy activity. Unknown actors stay unknown; no intended-repreneur reading KPI is inferred. Known rejected, bounced, delayed, suppressed and uncertain states explain their recorded chronology without starting a retry. A delayed event has no invented reason.

Bounce rate = uniquely bounced messages / accepted cohort messages. Open and click rates = unique respective message activity / delivered messages with tracking verified at their send time. The mixed cohort shows covered delivered and uncovered accepted counts. Zero eligible denominator means **Not measured**, a read failure means **Unavailable** with recovery, and a positive covered denominator without activity permits a measured zero. A general tracking setting never creates retroactive coverage.

Technical critical-operation alerts explicitly carry `renew_mail_class=system`,
including through the shared sender, and remain outside business receipt history
and Analytics. Their authenticated unowned callbacks are acknowledged without
retaining orphan events or generating another failure alert. Business receipt
races keep their retryable 503 and exact-parent retention rules. Previously
misclassified technical callbacks retain their finite retry treatment; this
repair does not rewrite historical mail or replay events.

## Tracking activation and rollback (held)

Read-only baseline on 7 October 2026: Re-New `news.re-new.team` is verified; open/click tracking are disabled; tracking subdomain is absent; the live webhook has the six original sent/delivered/opened/clicked/bounced/complained subscriptions. New failure/delay/suppression handling is prepared support, not current live coverage.

Resend tracking is **domain-level**. The current [send API](https://resend.com/docs/api-reference/emails/send-email) has no per-message override; [custom tracking domains](https://resend.com/blog/introducing-custom-tracking-domain) affect domain tracking. Consequently activation requires separately authorized work:

1. Record the explicit production migration/deployment/DNS/provider/test-destination authority and retain the exact candidate/schema/setting snapshot. Keep all business Auto-send off during cutover; apply the additive migration without any historic backfill, purge, replay or correction.
2. Establish and verify a distinct untracked access sending domain/sender. Configure `RESEND_ACCESS_FROM_EMAIL` only after its verification; keep tracking disabled on that domain and prove current setup/reset variants still deliver and their links contain no tracked redirects. Leaving it unset preserves the existing `FROM_EMAIL` sender while tracking remains off. Never toggle tracking on a domain still shared by auth.
3. Verify the business sending domain, a provider-supported custom tracking subdomain and its exact required DNS records. Configure domain-level open and click tracking using the provider's current control/readback. Add signed webhook subscriptions for `email.delivery_delayed`, `email.failed` and `email.suppressed` alongside the six existing events; verify signature secret delivery without exposing it. Retain provider setting/DNS/subscription readback and activation time in approved release evidence.
4. Send to an isolated or explicitly approved owned destination only. Verify provider acceptance, delivery, a controlled open and click, correct WAVE ledger/detail/cohort readback, duplicate/reordered/forged events and a copy-recipient bounce. Verify no customer send or historic measurement occurred. Only then set `EMAIL_BUSINESS_TRACKING_DOMAIN` and `EMAIL_BUSINESS_TRACKING_VERIFIED_AT` to the verified business tracking domain/time. Readiness requires a distinct access sending domain; each future dispatch snapshots coverage. These variables are readiness evidence declarations, not provider configuration changes.
5. Recheck access links and deliverability under the actual deployed SHA. Enable future Auto-send per type only under the existing activation/release rules. Evaluate Professional at at least 20 repreneurs under a later commercial decision; do not automatically buy it or claim it provides longer historical retention.

Rollback disables future business dispatch/Auto-send and, when authorized, turns off future domain tracking. Clear the future capability declaration only after recorded provider readback. Retain all receipts, reviews, event facts, already-issued tracked links, custom tracking domain and their required DNS dependencies. Do not drop new evidence columns or deploy an old sender that ignores review policy. Use a compatible fix/revert with dispatch paused; old automatic code is unsafe as a blind rollback. Access delivery remains available on its verified untracked sender. No webhook status event triggers replay.

## Acceptance proof and boundaries

- `scripts/rehearse-email-operations.sh` runs the actual additive migration and public SQL policy/edit/reserve/finish/bulk/event/history/analytics seams in a disposable Unix-socket PostgreSQL cluster. It checks default review, future-only modes, stale/role/active/URL fences, retained words, independent duplicate/reordered facts, private reads and history >150. Synthetic receipts are fixture evidence, not real provider delivery.
- `e2e/opening-readiness/email-operations.spec.ts` runs actual Next staff login, manual preparation, saved policy/copy controls, personal review/edit/send, retained history/detail, mixed source facts and desktop/mobile screens against the isolated Supabase/provider boundary. The existing lifecycle/freshness/handoff/browser fixtures remain required.
- Focused public dispatch/idempotency and validly signed webhook tests exercise uncertainty and failure cases; real disposable database tests own SQL behavior rather than source-string snapshots.
- Exact candidate required Verify and Disposable Supabase fixture checks, independent specification/standards review and actual synthetic browser captures must pass before any release claim. Local source/tests or prepared tracking support alone do not prove production activation or browser success.

## Freshness recognizable copy — #247 / #263 / #264, 8 October 2026

Ivan approved the bounded specification, behavioral seams and two-Ticket breakdown in Codex `01a11bc8-f9b1-7c21-ae2e-1727138c3c6b` (“Tutto approvato” followed by Matt implement). This section defines candidate behavior; it does not assert production activation.

Freshness subjects/bodies contain recognizable recorded project titles and optional recorded `revenue_meur`, never internal opportunity references. Staff judges whether the existing title is recognizable; non-empty alone is insufficient. Blank/reference-only titles block the whole group; no sector or generic fallback is emailed. Revenue uses French decimal formatting and M€, preserving its value, including recorded zero. Missing revenue is omitted with its CA label; this supersedes the received handoff's `CA non renseigné` wording without changing null data.

Default single subject is `Statut du process pour {opportunityTitle}` with optional `(CA : … M€)`. The body refers to `l’opportunité en objet`, asks whether the process remains open and new repreneur profiles are considered, and retains the normal Re-New sender/signature. Multiple members use `Statut des process pour les opportunités suivantes`, a recognizable title/revenue list and plural questions. No ownership/public-distribution claims, recipient/CC/Reply-To, tracking or automatic-send policy change is introduced. The old shipped default is recognized at rendering; stored custom templates remain intact. New supported placeholders are `opportunityIntroduction`, `processQuestion`, `opportunityList`; existing placeholders stay compatible. Staff reviews customized wording; exact internal references and absent member titles are blocked atomically.

Candidate snapshots add optional revenue and `copy_contract: recognizable-v1` to existing frozen JSON members. Migration `20261008160000_freshness_recognizable_copy.sql` changes projections/functions/fences only; it rewrites no template, opportunity, review or history. Pending/unattempted legacy drafts require explicit exact-member evidence refresh, then explicit copy replacement or staff correction and review. Refresh preserves words/membership; copy replacement requires current evidence and optimistic version. Title/revenue changes invalidate stale data, with revenue inside the existing send lease fence. Known revenue must remain beside its title in reviewed copy.

Attempted, failed-with-attempt, sent and uncertain messages retain copy, payload, operation identity, receipts and legacy reconciliation eligibility. No new operation, bulk rewrite, provider replay, TTL or deletion permission is created. Staff-only visibility and parent-owned retention remain unchanged. Only explicit confirmed-open replies renew the exact opportunity for 45 days; sending, silence and unclear responses do not. Pause/close stay separate staff actions.

Freshness catalogue previews use synthetic single/multiple examples and the same minimal HTML renderer as grouped send, without the branded wrapper. The reusable editable subject remains template source; resolved preview subjects are separate, preventing sample titles from becoming saved template text. Draft review retains the exact words sent.

Acceptance traces to #263/#264 through public generation/provider/preview behavior tests, isolated PostgreSQL refresh/replacement/history and concurrency rehearsal, and the protected desktop/mobile freshness journey. These synthetic checks do not prove real delivery. Rollback may disable freshness generation/dispatch while retaining all drafts/history and new database guards; do not fall back to an older direct sender or drop safeguards around retained rows. Any production application or real send requires its corresponding authority and exact-candidate proof.
