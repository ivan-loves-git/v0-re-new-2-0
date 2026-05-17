# Phase 1 Research: Scope Lock and Data Foundation

**Date:** 2026-05-16
**Mode:** Inline research, no subagents

## Codebase Findings

- The app uses Next.js App Router with server components by default and server actions in `lib/actions/*`.
- Staff mutations currently use `createAdminClient()` plus `requireUser()` and revalidate relevant routes.
- Existing dashboard sections use shadcn `Card`, `Skeleton`, grids, and componentized cards.
- shadcn project config is Next.js 16, RSC, Tailwind v4, `new-york`, Radix, Lucide icons, import alias `@`.
- Installed UI components already cover Phase 1 needs: `Card`, `Table`, `Badge`, `Tabs`, `Sheet`, `Dialog`, `Select`, `Input`, `Button`, `Skeleton`, `Tooltip`, `DropdownMenu`, `Chart`.
- Existing migrations are plain SQL files under `scripts/` and `supabase/migrations/`; the plan should add SQL in the same style and avoid runtime schema guessing.

## Product Findings

- Bertrand's Notion answer resolves much of the original PDR but expands the future scope.
- Phase 1 must keep June scope tight: schema, import, staff CRUD, minimal M&A source/contact, document storage.
- Staff-only versus repreneur-visible fields is the key architectural boundary.
- Automatic teaser parsing, AI matching, full M&A CRM, and inline PDF review remain deferred.

## Planning Implications

- Build schema and types first.
- Create staff UI after schema/types exist.
- Keep import as a review flow with warnings/blockers.
- Use shadcn MCP and existing UI components before adding new components.
- Keep M&A source/contact minimal and separate from full CRM.
