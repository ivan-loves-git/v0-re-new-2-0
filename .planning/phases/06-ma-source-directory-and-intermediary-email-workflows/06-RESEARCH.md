---
phase: 6
title: M&A Source Directory and Intermediary Email Workflows
status: complete
created: 2026-05-18
---

# Research

## Existing Codebase Findings

- `ma_sources` already exists with `firm_name`, `source_type`, `contact_name`, `contact_email`, `contact_phone`, and `notes`.
- `opportunities` already has `source_id`, `source_label`, and `source_visibility`.
- The opportunity form currently creates/updates a source only when staff edits a single opportunity.
- Imported/demo opportunities currently store `source_label`, but production data check showed `15` opportunities with labels and `0` linked `source_id` values. This makes a directory useful only after backfill.
- Email Tools already supports `Rep`/`Opp` audience badges in template metadata, preview dialogs, editable `body_markdown`, and test sending for existing templates.
- The existing email table uses text keys, so adding M&A template keys is a low-risk additive seed plus TypeScript metadata update.

## Supabase / Security Notes

- Current Supabase guidance says table exposure depends on both grants and RLS; new public tables may require explicit grants. Source data is staff-only, so this phase should not depend on direct client-side authenticated access to `ma_sources`.
- The app uses server-side actions and `createAdminClient()` for opportunity operations, so the source directory can stay server-mediated and staff-gated with `requireStaffAccess()`.
- Migration should be additive and include explicit grants/backfill. It should not broaden Data API access to source/contact details.

## shadcn / UI Notes

- Project uses shadcn `new-york`, Radix, Tailwind v4, lucide icons, and existing `Card`, `Table`, `Dialog`, `Input`, `Textarea`, `Select`, `Badge`, and `Button` components.
- Existing page headers now use `SectionPageHeader`; the M&A page should reuse the Opportunity purple tone.
- The source directory should feel operational and compact, closer to Find/Groups than a marketing-style CRM page.

## Recommended Implementation

1. Add migration `051_ma_source_directory_and_email_templates.sql`.
2. Add source directory server actions in a new `lib/actions/ma-sources.ts`.
3. Add `/opportunities/ma` route plus sidebar and breadcrumb labels.
4. Add a client directory component with search, source stats, add/edit dialogs, and email workflow chips.
5. Add M&A template keys, metadata, preview rendering, and editable markdown seed rows.

## Risks

- Direct sending to M&A sources should wait until recipient selection, audit logging, and consent/legitimate-interest rules are clearer.
- The existing broad RLS posture for older opportunity tables is outside this phase; this phase keeps source data server-mediated and does not add browser-side Supabase reads.
