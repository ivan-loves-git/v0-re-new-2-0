# Re-New project status routing

**Last updated:** 2026-08-09
**Purpose:** Prevent historical project files from competing with the live WAVE Strategic PDR.

## Current authority

1. The live WAVE Strategic PDR owns current Goals, Milestones, accepted scope, Work Cards, owners, dependencies, status and stakeholder decisions.
2. `docs/data-models/ma-advisory-data-model-v1.md` owns the released business meaning for M&A firms, offices, contacts, opportunities, interactions, confidentiality, visibility and cutover mapping.
3. `AGENTS.md` owns technical, security, QA and release guardrails. `CLAUDE.md` is only a compatibility pointer to it.

Notion and Linear are inactive for Re-New product planning. Do not consult, update, mirror to, or link them unless Ivan explicitly reactivates one of them.

The `.planning/` tree, `TASKS.md`, `docs/V2-PDR-DRAFT.md` and dated backlog files are historical evidence only. A current PDR Work Card may cite them, but they do not authorize work or change current state.

## Operating rules

- A Problem Proposal is not accepted scope.
- A `Ready for decision` item still needs the named human decision.
- A Work Card in `Review` is a human or UAT gate, not permission to release.
- Material product, data, operating-model or governance decisions close only when the canonical contract is updated, affected cards link to it, rules and migration treatment are explicit, and acceptance tests trace to the approved contract.
- Product changes, stakeholder decisions and delivery status are recorded in the PDR, not in this file.

## Historical note

This file previously described the Notion Product Development Tracker introduced on 2026-05-31. That tracker and its Today, Needs Bertrand/Colin, Ready to Test, Done, Parking Lot and Roadmap views are retained only as project history. They are not a fallback source of truth.
