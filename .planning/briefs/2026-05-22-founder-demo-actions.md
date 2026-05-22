# Founder Demo Action Brief: Post-demo Workflow MVP

**Date:** 2026-05-22
**Source:** Founder live demo transcript and Ivan-approved action list
**Target phase:** Phase 8: Post-demo workflow MVP
**Status:** Approved for GSD planning

## Outcome

Re-New staff should be able to use the platform for the next real workflow: create or cleanly maintain real opportunities, match them to repreneurs, and move an interested repreneur into the NDA/info memo request process without Bertrand manually coordinating every step.

## Scope Principles

- Focus on the operational workflow Bertrand and Colin need immediately after the demo.
- Fix obvious blockers before adding more surfaces.
- Prefer simple, structured forms and clear validation over heavy automation.
- Keep full PDF-to-opportunity AI ingestion out of this MVP.
- Keep JSON/ChatGPT-assisted import in the parking lot for V4 unless it is needed to unblock the core workflow.
- Do not build info memo storage now; Bertrand explicitly said it is not urgent.
- Preserve the rule that the M&A firm requires the candidate/repreneur to sign its own NDA. Re-New cannot replace that with a generic Re-New NDA.

## Requirements

### POSTDEMO-01: Immediate Usability Fixes

Staff can complete the demo-observed workflows without obvious UI or state blockers.

Acceptance criteria:
- Portal access enablement works when creating or enabling a repreneur portal account.
- Repreneur selectors support search where staff need to pick or preview a repreneur, especially portal preview and opportunity recommendation screens.
- Opportunity edit save feedback resolves correctly after a successful save.
- Slow dashboard and opportunity edit loading are investigated and either improved or documented with a concrete follow-up.

### POSTDEMO-02: Opportunity Creation and Intake

Staff can create a real opportunity from the platform with the fields needed for matching and entrepreneur-visible teaser context.

Acceptance criteria:
- Staff have a clear create opportunity button or entry point.
- The opportunity form uses the existing Excel structure as the source of mandatory fields.
- Required fields show validation warnings before save.
- M&A firm, contact name, and contact email remain reliably stored for each opportunity. This may already exist; verify before changing.
- Staff can enter a simple teaser or summary text field intended for entrepreneur-visible opportunity information.
- Info memo storage is not added in this phase.
- Full PDF-to-opportunity AI ingestion is explicitly deferred.
- JSON/ChatGPT-assisted opportunity import is parked for V4 unless research shows it is a small, low-risk extension.

### POSTDEMO-03: Matching and Repreneur View

Staff can understand opportunity fit from both directions: opportunity to repreneur and repreneur to opportunity.

Acceptance criteria:
- Each repreneur profile shows associated opportunities or matches with scores/status.
- Recommended repreneurs are visible prominently on the opportunity overview, not only inside a deeper tab.
- The plan verifies whether the current matching data model already supports the reverse view before adding schema.

### POSTDEMO-04: NDA and Info Memo Workflow

Staff can move from interested repreneur to M&A firm NDA/info memo request with less manual coordination.

Acceptance criteria:
- The pursuit stage model includes an "info memo received" stage, or a shorter equivalent label.
- The new stage sits before intermediary meeting.
- When a repreneur expresses interest and staff validates the pursuit, staff can prepare and send an email to the M&A firm requesting the NDA/info memo.
- The M&A email includes repreneur profile or fiche de cadrage context where available.
- Staff receive reminders when the NDA/info memo process has not moved after a few days.
- The workflow keeps the legal rule that the M&A firm requires the candidate/repreneur to sign its NDA.

### POSTDEMO-05: Clean Up Confusing Opportunity Fields

The opportunity detail/edit experience should not expose unclear fields that the team does not understand or use.

Acceptance criteria:
- Review "anonymized description" and remove or rename it if teasers are already anonymous.
- Review "source notes", "visibility", "staff only", and "approved/revealed" fields.
- Remove, rename, or hide confusing fields when they do not support the current workflow.
- Confirm whether internal staff notes are useful now that Colin is joining the workflow; keep them only if they have a clear operational purpose.

### POSTDEMO-06: Verification and Release Evidence

The phase must be tested against real staff workflows, not only checked in code.

Acceptance criteria:
- Build and lint pass after implementation.
- Browser UAT covers portal access enablement, opportunity creation/editing, search selectors, repreneur reverse match view, opportunity overview recommendations, and NDA/info memo request flow.
- Production or production-like testing uses the stored Re-New test credentials from AGENTS.md.
- Any deferred items are recorded in the roadmap or V3/V4 backlog rather than left as hidden assumptions.

## Parking Lot

- Full PDF upload by M&A firms that automatically creates opportunities.
- In-platform AI extraction from arbitrary teaser PDFs.
- JSON/ChatGPT-assisted import unless it proves small and directly useful after the core workflow is stable.
- Full email template editor.
- M&A analytics.
- Intermediary portal.
- Broader Wavy AI assistant.

## Planning Instructions

- Research current code before planning changes, especially `lib/actions/opportunities.ts`, `lib/actions/opportunity-matches.ts`, `lib/actions/repreneurs.ts`, `lib/actions/ma-workflows.ts`, opportunity detail pages, repreneur profile pages, portal preview pages, and dashboard loaders.
- Use existing shadcn/ui and local table/form patterns.
- Prefer vertical plans that each leave the platform in a testable state.
- Do not introduce broad database changes until current schema capabilities are verified.
- Treat M&A source/contact storage as likely already implemented and verify before adding anything.
