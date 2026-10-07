# Ticket #252 synthetic browser evidence

Parent: [Product Change #251](https://github.com/re-new-team/renew-governance/issues/251).
Delivery: [Ticket #252](https://github.com/re-new-team/renew-governance/issues/252).

Checked on 7 October 2026 using the actual changed components from UI source
`b91111f426e554753361d211ccb3cbec419eae39`, whose component blobs are unchanged
in this candidate. A separate local Next.js fixture at
`http://localhost:5203/qa-lifecycle-252` supplied only fictional props.
The fixture route is excluded from the application branch. It performed no
live business writes. Screenshots show component behavior, not a production
release or persisted business outcomes.

Desktop used the normal 1280 × 720 viewport; mobile used 390 × 844. The mobile
page had equal client and scroll widths of 390 pixels. The final fixture
reported no browser console errors.

| Screenshot | Observed behavior |
| --- | --- |
| [Drop desktop](drop-desktop-dialog.png) | The actual Recommendations dialog selected Customer concentration as main and Other as secondary. Confirmation remained disabled until context was entered; the final summary distinguishes both choices and states pursuit-only effects. |
| [Drop mobile](drop-mobile-dialog.png) | The same valid decision keeps the context, summary and both footer actions readable at 390 pixels. |
| [Pursuit mobile](pursuit-mobile.png) | The other staff entry point uses the same grouped 29-choice catalogue. Reason not disclosed removes secondary choices and enables a standalone decision. |
| [Lifecycle desktop](lifecycle-desktop.png) | Pause Other requires context. Close explains the 89/90-day restriction and that staff may keep an eligible opportunity Active. |
| [Lifecycle mobile](lifecycle-mobile.png) | The same controls retain their layout and explanatory copy on mobile. The Stale menu choice was observed disabled at 89 completed days. |

All five Pause choices and six permanent Close choices were inspected. Earlier
89/90-day synthetic component fixtures also verified that the threshold only
enables the explicit manual Stale choice. Main/secondary reasons and notes
remain labelled staff-only.

Persistence, authorization, conservative policy activation, immutable legacy
readback, recipient-specific cleanup, Pause revocation without automatic
restoration, exact replay and concurrent transitions are proved separately by
`scripts/rehearse-reasoned-lifecycle.sh`, including the existing V3/V4 historical
import compatibility fixtures. That disposable PostgreSQL rehearsal is part
of the required Verify check. Production activation, migration and release
remain outside the current build authority.
