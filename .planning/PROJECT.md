# Re-New Platform V2

## What This Is

Re-New Platform V2 turns Wave from an internal repreneur CRM into the operating layer for deal flow. It adds opportunities, basic matching, repreneur-facing opportunity actions, deal progress tracking, document handling, and operational reporting.

The June version must be usable enough to validate the core workflow without expanding into full M&A CRM, AI analysis, e-signature, or heavy automation.

## Core Value

Re-New staff can manage opportunities and confidently connect the right repreneurs to the right deals without Bertrand holding the whole matrix manually.

## Requirements

### Validated

- Existing Wave CRM manages repreneur profiles, stages, notes, and internal team workflows.

### Active

- [x] Opportunity database with the minimum schema confirmed by Bertrand's Excel and teaser samples.
- [x] Excel import and manual opportunity creation/editing.
- [x] Staff-facing structured match recommendation plus optional human recommendation.
- [x] Repreneur access to anonymized opportunities with simple interest/reject actions.
- [x] Deal progress tracking from interest through intermediary meeting, seller meeting, LOI, dropped, or closed.
- [x] Per-opportunity NDA status and document attachment tracking without e-signature.
- [x] PDF upload/download linked to opportunities.
- [x] Simple operational reporting for deal-flow KPIs.
- [x] Simple stale-opportunity reminder after 3 months if nobody is actively pursuing the opportunity.

### Out of Scope

- Automatic PDF teaser parsing — useful, but not required for validating the June workflow.
- Full M&A firm CRM — directionally important, but too large for the first June scope.
- AI sector interpretation or AI matching — defer until structured data and human feedback are stable.
- In-platform AI deal memo generation — explicitly V3.
- Inline PDF viewer — download is enough for V2 unless the team reverses this decision.
- E-signature — V2 tracks NDA status/files, not legal signing infrastructure.
- M&A firm portal — Bertrand confirmed no portal in V2.
- Advanced repreneur self-service/profile editing — opening Wave to repreneurs does not mean rebuilding the whole repreneur experience in June.
- Investor-style reporting — operational KPIs are enough.

## Context

- PDR draft was created on 2026-05-13 after a founder call.
- Bertrand answered through Notion on 2026-05-14 with Excel fields, attachment samples, repreneur access preference, NDA reality, stage taxonomy, freshness, and reporting direction.
- The key product risk is not coding effort; it is scope discipline and human decisions on what June must exclude.
- Bertrand's answer expands the product direction beyond the original PDR: repreneur browsing, M&A firm CRM, stale reminders, per-opportunity NDAs, and more nuanced matching.

## Constraints

- **Timeline**: June V2 should be scoped as a first usable version for the quarterly review.
- **Data**: Matching is only as good as the locked opportunity schema and repreneur profile fields.
- **Operations**: M&A firms remain human-managed in V2.
- **Legal**: Per-opportunity NDA is the current practical model; umbrella NDA is not assumed.
- **Product quality**: Repreneur access raises the UI/UX bar, but June scope must stay narrow.
- **Tracking**: GSD `.planning/` is execution memory; Linear is the team-facing tracker.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Repreneur access via platform for V2 | Bertrand strongly prefers opening Wave to repreneurs rather than email-only | Implemented with separate `/portal/*` routes |
| PDF upload/download only | Bertrand confirmed no in-platform memo generation needed for V2 | Good for June |
| M&A firms have no portal in V2 | Keeps relationship management human and avoids a second external user group | Good for June |
| Month/date added is enough freshness signal | Avoids unnecessary aging taxonomy | Good for June |
| Platform recommendation plus human recommendation | Balances structure with human judgment while data model stabilizes | Implemented for June V2 |
| Same Supabase project for Phase 1.1 testing | Avoids extra Supabase project cost; acceptable because Phase 1 migrations are additive and UAT data will be marked | Approved with controlled migration guardrails |

---
*Last updated: 2026-05-17 after June V2 implementation completion*
