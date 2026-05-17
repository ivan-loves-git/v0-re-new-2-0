---
gsd_type: phase_summary
phase: "02-core-deal-workflow"
plan: "02-07"
status: complete
completed_at: "2026-05-17T13:07:37Z"
---

# 02-07: NDA and Repreneur Document Download Flow Summary

## Completed

- Added pursuit-level NDA status on `opportunity_matches`: not required, required, sent, signed, and waived.
- Added optional linked NDA document and internal staff NDA note fields.
- Added staff NDA controls to the opportunity `Pursuit` tab.
- Added approved-document loading for the active repreneur portal view.
- Added NDA status display in the repreneur portal.
- Added a protected portal download route that checks repreneur ownership, active pursuit status, approved document visibility, and NDA gate before creating a short-lived signed storage URL.

## Scope Boundaries Kept

- No e-signature workflow was added.
- No legal negotiation workflow was added.
- No M&A firm portal was added.
- No inline PDF viewer or document parser was added.
- No per-document recipient list beyond the active pursuit owner was added.

## Verification

- Applied and verified `scripts/050_opportunity_pursuit_nda_documents.sql` against the approved Supabase project.
- Confirmed the Supabase API can read NDA fields and query approved documents.
- `pnpm run build` passes.
- Focused TypeScript check showed no errors in the changed Phase 02-07 files.
- Full typecheck still fails on known pre-existing baseline files outside this phase.

## Executive Summary

This plan closes the final Phase 2 loop: staff can decide whether an NDA is needed, and repreneurs only receive document access when Re-New has explicitly approved both the document and the NDA gate.

The implementation is intentionally operational rather than legal-tech-heavy. It records the decision, protects the download path, and leaves e-signature or legal negotiation for later.
