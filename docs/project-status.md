# Re-New project status routing

**Last updated:** 2026-08-30
**Purpose:** Keep GitHub delivery, WAVE intake and canonical product contracts in their distinct authoritative roles.

## Current authority

1. The private `re-new-team/renew-governance` repository and its `Re-New Product Delivery` Project own approved product scope, Product Changes, Decisions, Tickets, Bugs, owners, dependencies, discussion, delivery status and release evidence. Scope authorized directly by Ivan may start there without a PDR record.
2. The protected WAVE Strategic PDR owns founder-request intake, original wording, AI screening, Ivan's disposition, intake attachments and the historical proposal record. It shows a timestamped read-only GitHub projection for staff; it does not own or mirror delivery state.
3. `docs/data-models/ma-advisory-data-model-v1.md` owns the released business meaning for M&A firms, offices, contacts, opportunities, interactions, confidentiality, visibility and cutover mapping.
4. `AGENTS.md` is the repository instruction entry point. `docs/TESTING_RELEASE_PROTOCOL.md` describes how work is built and released. `CLAUDE.md` is only a compatibility pointer to `AGENTS.md`.

Notion and Linear are inactive for Re-New product planning. Do not consult, update, mirror to, or link them unless Ivan explicitly reactivates one of them.

The `.planning/` tree, `TASKS.md`, old PDR Work Cards, `docs/V2-PDR-DRAFT.md` and dated backlog files are historical evidence only. A current GitHub Product Change may cite them, but they do not authorize work or change current state.

## Platform document boundaries

Use the smallest document class needed for the question. The repository is not a general-purpose document library, and a file's presence in Git does not make it current product authority.

| Class | Approved home and use | Boundary |
| --- | --- | --- |
| Current product planning and delivery state | Private GitHub governance repository and Product Delivery Project | GitHub is the complete delivery authority. Do not recreate its current state in platform documents or PDR Work Cards. |
| Founder-request intake and historical proposal record | Protected WAVE Strategic PDR | Preserve original request wording, screening, disposition and attachments. Its GitHub view is a timestamped read-only projection, not a second authority. |
| Released product and technical contracts | `docs/data-models/`, current `docs/architecture/`, `AGENTS.md`, and `docs/TESTING_RELEASE_PROTOCOL.md` | Use the relevant contract or instruction for implementation. Update a contract only when an approved change alters the meaning it owns. |
| Public-safe delivery communication and release reporting | The platform repository's deliberately public-safe roadmap, release evidence and technical reports | Keep only material that is safe for a public code repository and useful to operating or verifying the product. It does not authorize scope, replace a contract or become a new planning tracker. |
| Raw internal communication, candidate or people material, sensitive founder reporting and sent-message evidence | The existing private Pushapp project repository, after a separately approved history-aware migration | Existing platform paths such as `docs/communications/`, `docs/reports/` and `docs/emails-sent/` are legacy source locations, not approval to keep sensitive content public. Retain sent evidence as sent; never rewrite it into an editable draft. |
| Historical plans, prior models and archived material | Public-safe technical provenance may remain in `docs/archive/`, `_archive/`, `.planning/`, `TASKS.md` and superseded platform files; sensitive history belongs in the existing private Pushapp project repository after an approved migration | Retrieve selectively for provenance only. Historical material cannot override GitHub delivery, the PDR intake record, current contracts or current instructions. Preserve paths and history until a migration is explicitly approved. |
| Local-only or ignored material | Existing ignored local paths and generated/QA outputs | They are outside tracked repository scope. Do not enumerate, read, relocate, commit or use them as general agent context without separate explicit authority. |

### Retrieval and change rule

Start with GitHub for current delivery state, use the WAVE PDR for request provenance, then consult the relevant current contract or `AGENTS.md`. Consult communications, reports or archives only when their provenance is needed. The platform repository is public, so classify content by its intended audience before adding or updating it. Preserve existing links and history. A document move, rename, deletion, GitHub visibility or access change, or any change to a local-only boundary requires a separate explicit decision from Ivan and a history-aware implementation plan. None is approved by this routing policy; legacy source locations remain an unresolved exposure queue until that decision is made.

## Operating rules

- A PDR Problem Proposal is not accepted scope.
- A `Ready for decision` item still needs the named human decision.
- A GitHub item in `Review` is a human or UAT gate, not permission to release.
- Material product, data, operating-model or governance decisions close only when the canonical contract is updated, affected cards link to it, rules and migration treatment are explicit, and acceptance tests trace to the approved contract.
- Product changes, stakeholder decisions and delivery status are recorded in GitHub, not in this file or in PDR Work Cards. GitHub-to-PDR status reconciliation is retired.

## Historical note

This file previously described the Notion Product Development Tracker introduced on 2026-05-31. That tracker and its Today, Needs Bertrand/Colin, Ready to Test, Done, Parking Lot and Roadmap views are retained only as project history. They are not a fallback source of truth.
