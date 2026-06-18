# Phase 9: Repreneur Profile Detail IA Refactor - Context

**Gathered:** 2026-06-18
**Status:** Ready for execution
**Source:** GSD import/ingestion from Ivan-approved chat IA

<domain>
## Phase Boundary

Refactor the staff-side repreneur profile detail page from one long mixed page into a tabbed work surface using the existing small grey tab pattern from opportunity details.

This phase does not add external repreneur self-service, database schema, new access rules, or new opportunity workflow logic. It reorganizes existing staff-visible information so the team can find the right information at the right moment.
</domain>

<decisions>
## Implementation Decisions

### Tab Model
- Use stable staff workflow tabs, not journey-stage tabs.
- Approved tabs: Overview, Qualification, Readiness, Opportunities, Engagement, Timeline.
- Keep journey stage visible as a header badge/progress indicator. Do not make journey stages the main tab navigation.

### Overview Role
- Overview must be a dense command view, not a light identity page.
- It should answer in roughly 20 seconds: who this is, where they are, what matters now, what is risky, what opportunities are open, what happened recently, and what action should come next.
- Overview may summarize content that has full detail in other tabs, but it should not duplicate full editors or long histories.

### Qualification Role
- Qualification is the permanent home for WHO/WHEN, Tier 1, Tier 2, scoring accuracy, leadership assessment, and radar/pentagram-style graphs.
- The existing radar graphs should be restored to a visible, high-priority area here.

### Readiness Role
- Readiness owns acquisition maturity, target profile, financing fit, current needs, and Tier 3 milestones.

### Opportunities Role
- Opportunities owns reverse matches, pursuit status, deal fit, and links to opportunity detail pages.

### Engagement Role
- Engagement owns Re-New relationship delivery: portal access, offers/packages, active delivery, and profile documents.

### Timeline Role
- Timeline owns notes, activities, calls, emails, meetings, and relationship history.

### Design Consistency
- Reuse the opportunity detail small grey tab pattern based on the shared shadcn Tabs component.
- Keep the profile header stable above the tabs.
- Use existing cards, badges, tables, buttons, icons, and spacing conventions.
- Avoid new decorative styling, marketing layouts, or isolated custom visual systems.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Profile Surface
- `app/(dashboard)/repreneurs/[id]/page.tsx` - current long repreneur detail page and data loading.
- `components/repreneurs/repreneur-radar-chart.tsx` - existing radar/pentagram-style visual profile component that must become visible again.
- `components/repreneurs/tier3-milestones-card.tsx` - readiness milestone workflow.
- `components/repreneurs/leadership-results-card.tsx` - leadership assessment results and radar.
- `components/repreneurs/repreneur-opportunity-matches-card.tsx` - reverse opportunity matches.
- `components/offers/repreneur-offers-list.tsx` - offer/package engagement.
- `components/repreneurs/activity-history.tsx` and `components/repreneurs/repreneur-notes.tsx` - timeline content.
- `components/repreneurs/portal-access-card.tsx` and `components/repreneurs/documents-card.tsx` - engagement/access content.

### Existing Tab Pattern
- `components/opportunities/opportunity-detail.tsx` - opportunity detail tab placement and naming rhythm.
- `components/opportunities/opportunity-detail-tabs.tsx` - URL-backed tab state pattern.
- `components/ui/tabs.tsx` - shared grey tab list and active tab styling.

### Product Memory
- `.planning/PROJECT.md` - core value, scope boundaries, out-of-scope self-service constraints.
- `.planning/REQUIREMENTS.md` - completed repreneur access and staff IA requirements.
- `.planning/STATE.md` - current project decisions and release risks.
</canonical_refs>

<specifics>
## Specific Ideas

Desktop overview target layout:

```text
REPRENEUR PROFILE

[ Back ]                                                          [ Actions v ]

(Avatar)  Sample Repreneur
          sample@email.com | +33 6 00 00 00 00 | LinkedIn

          [Qualified]   [Ready 11/17]   [Deal Flow]   [2 flags]
          Last activity: Interview logged Jun 14        Next: Review 2 opportunity matches


[ Overview ] [ Qualification ] [ Readiness ] [ Opportunities ] [ Engagement ] [ Timeline ]
   active


+----------------------------------------------------------------------------------+
| NEXT BEST ACTION                                                                  |
| Review match fit for "Industrial services company"                                |
| Reason: strong WHO score, target sectors match, financing needs confirmation       |
| [Open match] [Log activity] [Create note]                                         |
+----------------------------------------------------------------------------------+

+--------------------------------------+-------------------------------------------+
| RELATIONSHIP SNAPSHOT                | QUALIFICATION SNAPSHOT                    |
| Status: Qualified                    | WHO 84     WHEN 72     T2 4.2/5           |
| Journey: Ready                       | Recommendation: Deal Flow                 |
| Source: LinkedIn                     | Flags: Equity unclear, target size broad  |
| Portal: Enabled                      | Mini radar preview                        |
| Current needs:                       |        /\                                 |
| Financing, target sourcing, DD       |   ____/  \____                            |
+--------------------------------------+-------------------------------------------+

+--------------------------------------+-------------------------------------------+
| ACQUISITION PROJECT                   | OPEN OPPORTUNITIES                        |
| Target sectors: B2B services, light   | 1. Industrial services      Strong fit    |
| industry                              | 2. Maintenance platform     Possible fit  |
| Regions: IDF, AURA, PACA              | 3. HVAC services            Not reviewed  |
| Deal size: 1M to 3M                   |                                           |
| Equity: 251K to 350K                  | [Open Opportunities tab]                  |
+--------------------------------------+-------------------------------------------+

+--------------------------------------+-------------------------------------------+
| READINESS PROGRESS                    | RECENT HISTORY                            |
| Explorer -> Learner       2/2         | Jun 14  Interview                         |
| Learner -> Ready          6/6         | Jun 12  Leadership assessment completed   |
| Ready -> Execution        3/7         | Jun 10  Starter Pack offered              |
| Execution -> Post-acq     0/2         | Jun 08  Note added by team                |
+--------------------------------------+-------------------------------------------+

+----------------------------------------------------------------------------------+
| DOCUMENTS AND ACCESS                                                              |
| CV uploaded | LDC uploaded | Assessment complete | Portal active | NDA pending    |
+----------------------------------------------------------------------------------+
```
</specifics>

<scope_fence>
## Scope Fence

- Do not add a new database table or migration.
- Do not change Better Auth, portal role access, or repreneur portal permissions.
- Do not create a new external repreneur self-service workflow.
- Do not redesign the entire dashboard shell or sidebar.
- Do not remove existing editing actions unless a tab explicitly relocates them.
- Do not create new visual styles where shadcn/ui and existing Re-New components already cover the need.
</scope_fence>

<import_conflict_report>
## Conflict Detection Report

### BLOCKERS (0)

### WARNINGS (0)

### INFO (1)

[INFO] New phase added after completed Phase 8
  Found: The incoming work is a new product surface refactor after the existing V2 roadmap.
  Note: It should be tracked as Phase 9 because Phase 8 is already locally complete and this is a distinct staff UX improvement.
</import_conflict_report>

---

*Phase: 09-repreneur-profile-detail-ia-refactor*
*Context gathered: 2026-06-18 via GSD import/ingestion*
