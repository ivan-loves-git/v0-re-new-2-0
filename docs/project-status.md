# Re-New project status routing

**Last updated:** 2026-08-09
**Purpose:** Prevent historical project files from competing with the live WAVE Strategic PDR.

## Current authority

1. The live WAVE Strategic PDR owns current Goals, Milestones, accepted scope, Work Cards, owners, dependencies, status and stakeholder decisions.
2. `docs/data-models/ma-advisory-data-model-v1.md` owns the released business meaning for M&A firms, offices, contacts, opportunities, interactions, confidentiality, visibility and cutover mapping.
3. `AGENTS.md` owns technical, security, QA and release guardrails. `CLAUDE.md` is only a compatibility pointer to it.

Notion and Linear are inactive for Re-New product planning. Do not consult, update, mirror to, or link them unless Ivan explicitly reactivates one of them.

The `.planning/` tree, `TASKS.md`, `docs/V2-PDR-DRAFT.md` and dated backlog files are historical evidence only. A current PDR Work Card may cite them, but they do not authorize work or change current state.

## Platform document boundaries

Use the smallest document class needed for the question. The repository is not a general-purpose document library, and a file's presence in Git does not make it current product authority.

| Class | Approved home and use | Boundary |
| --- | --- | --- |
| Current product planning and delivery state | Live WAVE Strategic PDR | The PDR is the only current source for goals, cards, decisions, owners and delivery status. Do not recreate it in repository files. |
| Released product and technical contracts | `docs/data-models/`, current `docs/architecture/`, and `AGENTS.md` | Use the relevant contract or instruction for implementation. Update a contract only when an approved change alters the meaning it owns. |
| Delivery communications and reports | `docs/communications/` and `docs/reports/` | These retain the factual communication or delivery snapshot. They do not authorize scope, replace a contract, or become a new planning tracker. |
| Sent-message evidence | `docs/emails-sent/` | Retain as sent evidence. Do not rewrite it into an editable draft or move it merely to make the documentation tree neater. |
| Historical plans, prior models and archived material | `docs/archive/`, `_archive/`, `.planning/`, `TASKS.md`, dated backlog and superseded draft files | Retrieve selectively for provenance only. They cannot override the PDR, current contracts or current instructions. Preserve existing paths and history. |
| Local-only or ignored material | Existing ignored local paths and generated/QA outputs | They are outside tracked repository scope. Do not enumerate, read, relocate, commit or use them as general agent context without separate explicit authority. |

### Retrieval and change rule

Start with the PDR, then the relevant current contract or `AGENTS.md`; consult communications, reports or archives only when their provenance is needed. Preserve existing links and history. A document move, rename, deletion, GitHub visibility or access change, or any change to a local-only boundary requires a separate explicit decision from Ivan and a history-aware implementation plan. None is approved by this routing policy.

## Operating rules

- A Problem Proposal is not accepted scope.
- A `Ready for decision` item still needs the named human decision.
- A Work Card in `Review` is a human or UAT gate, not permission to release.
- Material product, data, operating-model or governance decisions close only when the canonical contract is updated, affected cards link to it, rules and migration treatment are explicit, and acceptance tests trace to the approved contract.
- Product changes, stakeholder decisions and delivery status are recorded in the PDR, not in this file.

## Historical note

This file previously described the Notion Product Development Tracker introduced on 2026-05-31. That tracker and its Today, Needs Bertrand/Colin, Ready to Test, Done, Parking Lot and Roadmap views are retained only as project history. They are not a fallback source of truth.
