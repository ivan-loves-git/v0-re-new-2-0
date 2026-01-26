# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
mba--renew-platform/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Protected routes with sidebar layout
│   │   ├── dashboard/            # Main dashboard page
│   │   ├── repreneurs/           # Repreneur management pages
│   │   ├── pipeline/             # Deal pipeline view
│   │   ├── offers/               # Consulting packages management
│   │   ├── journey/              # Repreneur journey tracking (WIP)
│   │   ├── emails/               # Communication history
│   │   ├── tasks/                # Task management
│   │   ├── guide/                # Internal documentation/roadmap
│   │   ├── settings/             # Platform settings
│   │   ├── account/              # User account settings
│   │   └── layout.tsx            # Dashboard layout (sidebar + content)
│   ├── api/                      # HTTP endpoints
│   │   ├── auth/                 # Better Auth routes
│   │   ├── repreneurs/           # Repreneur mutations
│   │   ├── upload-avatar/        # File uploads
│   │   ├── upload-cv/            # CV document uploads
│   │   ├── cron/                 # Scheduled jobs
│   │   └── webhooks/             # External service callbacks
│   ├── auth/                     # Authentication pages
│   │   ├── login/                # Login form
│   │   ├── forgot-password/      # Password reset request
│   │   ├── reset-password/       # Password reset form
│   │   └── error/                # Auth error display
│   ├── intake-v2/                # Public intake form
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Root page (redirect to dashboard)
│
├── components/                   # React components (single source of truth)
│   ├── ui/                       # shadcn/ui + Radix UI primitives
│   │   ├── button.tsx, input.tsx, dialog.tsx, etc.
│   │   └── repreneur-avatar.tsx  # Custom avatar component
│   ├── app-sidebar.tsx           # Main navigation sidebar
│   ├── floating-nav.tsx          # Floating toolbar
│   ├── theme-provider.tsx        # Dark mode provider
│   │
│   ├── intake-v2/                # Multi-step intake form
│   │   ├── intake-form-v2.tsx    # Form orchestrator
│   │   ├── steps/                # Individual step components
│   │   │   ├── step-contact.tsx
│   │   │   ├── step-who.tsx
│   │   │   ├── step-when.tsx
│   │   │   ├── step-project-status.tsx
│   │   │   ├── step-needs.tsx
│   │   │   └── step-review.tsx
│   │   ├── language-toggle.tsx   # EN/FR selector
│   │   └── autofill-button.tsx   # Test data loader
│   │
│   ├── repreneurs/               # Repreneur profile components
│   │   ├── repreneur-form.tsx    # Basic info edit form
│   │   ├── questionnaire-form-v2.tsx  # Assessment questionnaire
│   │   ├── tier1-inline-editor.tsx    # Inline tier1 score editor
│   │   ├── tier2-star-rating.tsx      # Competency rating UI
│   │   ├── repreneur-notes.tsx   # Notes management
│   │   ├── update-status-form.tsx # Lifecycle status dropdown
│   │   ├── missing-fields-badge.tsx   # Incomplete profile indicator
│   │   └── editable-multi-select.tsx  # Inline array field editor
│   │
│   ├── offers/                   # Offers management
│   │   ├── offers-list.tsx
│   │   ├── offer-form.tsx
│   │   └── repreneur-offer-selector.tsx
│   │
│   ├── pipeline/                 # Deal pipeline view
│   │   └── pipeline-view.tsx
│   │
│   ├── tasks/                    # Task components
│   │   └── task-list.tsx
│   │
│   ├── scoring-v2/               # Scoring display components
│   │   ├── score-display.tsx
│   │   └── variants/             # Different score visualizations
│   │
│   ├── questionnaire/            # Legacy questionnaire (deprecated)
│   │   ├── questionnaire-form.tsx
│   │   └── sections/
│   │
│   ├── guide/                    # Roadmap & documentation
│   │   ├── development-roadmap.tsx   # Milestones & features
│   │   ├── core-concepts.tsx
│   │   ├── key-principles.tsx
│   │   └── page-instructions.tsx
│   │
│   ├── dashboard/                # Dashboard components
│   │   ├── stats-cards.tsx
│   │   └── recent-activity.tsx
│   │
│   └── journey/                  # Journey tracking (WIP)
│       └── journey-stage-editor.tsx
│
├── lib/                          # Core business logic & utilities
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── repreneur.ts          # Repreneur entity, lifecycle, journey, scoring
│   │   ├── offer.ts              # Offer entity
│   │   ├── intake-v2.ts          # Multi-step form types
│   │   ├── scoring-v2.ts         # Dual tier scoring
│   │   ├── email.ts              # Email templates & logs
│   │   ├── task.ts               # Task entity
│   │   └── evaluation-criteria.ts # Scoring criteria definitions
│   │
│   ├── actions/                  # Server actions (mutations)
│   │   ├── repreneurs.ts         # Create, update, delete repreneurs + scoring
│   │   ├── offers.ts             # Offer CRUD
│   │   ├── pipeline.ts           # Pipeline operations
│   │   ├── intake-v2.ts          # Intake form submission
│   │   ├── intake.ts             # Legacy intake handler
│   │   ├── emails.ts             # Email history management
│   │   ├── tasks.ts              # Task CRUD
│   │   ├── activities.ts         # Audit log entries
│   │   └── evaluation-criteria.ts # Scoring criteria updates
│   │
│   ├── supabase/                 # Database clients
│   │   ├── server.ts             # Server-side SSR client (auth-aware)
│   │   ├── admin.ts              # Service role client (bypasses RLS)
│   │   ├── client.ts             # Client-side browser client (deprecated)
│   │   └── proxy.ts              # Proxy utility (deprecated)
│   │
│   ├── utils/                    # Pure utility functions
│   │   ├── tier1-scoring.ts      # Tier 1 score calculation
│   │   ├── tier2-scoring.ts      # Competency dimensions
│   │   ├── scoring-v2.ts         # Dual-tier scoring orchestration
│   │   ├── journey-derivation.ts # Journey stage from milestones
│   │   ├── utils.ts              # General utilities (cn, formatting, etc.)
│   │   └── __tests__/            # Utility tests (Vitest)
│   │       ├── scoring-v2.test.ts
│   │       └── intake-integration.test.ts
│   │
│   ├── constants/                # Static lookup tables
│   │   ├── sectors.ts            # Industry sectors
│   │   ├── tier-config.ts        # Milestone definitions
│   │   ├── french-regions.ts     # Geographic zones
│   │   └── investment-ranges.ts  # Deal size ranges
│   │
│   ├── config/                   # Configuration & specifications
│   │   ├── questionnaire-v2.ts   # Q1-Q18 questions & answer options
│   │   ├── feature-flags.ts      # Feature toggles
│   │   └── intake-test-data.ts   # Seed data for testing
│   │
│   ├── data/                     # Runtime data & computed values
│   │   ├── evaluation-criteria.ts # Scoring weights (loaded from DB)
│   │   ├── intake-criteria.ts    # Intake validation rules
│   │   └── roadmap-status.ts     # Development roadmap metadata
│   │
│   ├── email/                    # Email service integration
│   │   ├── send-email.ts         # Email orchestration & rate limiting
│   │   ├── resend-client.ts      # Resend SDK initialization
│   │   └── templates/            # Email template components
│   │       ├── base-layout.tsx   # Email wrapper
│   │       ├── welcome.tsx       # Welcome email
│   │       ├── thank-you.tsx     # Submission confirmation
│   │       ├── offer-received.tsx
│   │       ├── offer-accepted.tsx
│   │       ├── rejection.tsx
│   │       ├── milestone-completed.tsx
│   │       ├── form-step-complete.tsx
│   │       └── index.ts          # Template registry
│   │
│   ├── i18n/                     # Internationalization
│   │   ├── translations.ts       # EN/FR translations
│   │   └── config.ts             # Language configuration
│   │
│   ├── auth.ts                   # Better Auth server config
│   ├── auth-server.ts            # Auth helper functions
│   └── version.ts                # Version info (build number)
│
├── hooks/                        # React hooks (minimal use - RSC preferred)
│   └── [client hooks if any]
│
├── public/                       # Static assets
│   ├── icon.svg                  # App icon
│   ├── icon-light-32x32.png
│   ├── icon-dark-32x32.png
│   └── apple-icon.png
│
├── scripts/                      # Utility scripts
│   ├── send-roadmap-email.ts     # Roadmap update mailer
│   └── browser-test-routine.md   # Browser testing checklist
│
├── supabase/                     # Supabase configuration
│   ├── migrations/               # SQL migrations
│   └── [config files]
│
├── styles/                       # Global CSS
│   └── globals.css               # Tailwind + custom styles
│
├── docs/                         # Documentation
│   ├── communications/           # Team communication guidelines
│   │   ├── WAVY.md              # AI mascot personality guide
│   │   ├── PRODUCT_UPDATE_TEMPLATE.md
│   │   ├── WhatsApp/            # Chat history reference
│   │   └── [other communications]
│   ├── emails-sent/             # Archive of sent emails
│   └── [various design docs]
│
├── .planning/                    # GSD planning documents
│   └── codebase/                 # Codebase analysis
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md        # (when generated)
│       ├── TESTING.md            # (when generated)
│       ├── STACK.md              # (when generated)
│       ├── INTEGRATIONS.md       # (when generated)
│       └── CONCERNS.md           # (when generated)
│
├── middleware.ts                 # Route protection & session validation
├── next.config.mjs               # Next.js configuration
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
├── tailwind.config.ts            # Tailwind CSS config
├── postcss.config.js             # PostCSS config
├── components.json               # shadcn/ui config
├── .eslintrc.json                # Linting rules
├── .env.example                  # Environment variable template
├── .env.local                    # Secrets (not committed)
└── CLAUDE.md                     # Project instructions

```

## Directory Purposes

**app/**
- Purpose: Next.js App Router - all page routes and layouts
- Contains: Route handlers (GET/POST), page.tsx files, layout.tsx hierarchy
- Key files: See directory layout above

**components/**
- Purpose: React component library - single source of truth for UI
- Contains: Reusable components, page components, UI primitives
- Key files: `app-sidebar.tsx`, `intake-v2/intake-form-v2.tsx`, `repreneurs/*`

**lib/**
- Purpose: Core business logic, not tied to routes
- Contains: Types, actions, utilities, configuration, data access
- Key files: `lib/actions/`, `lib/utils/`, `lib/supabase/`

**public/**
- Purpose: Static assets served at `/` path
- Contains: Icons, images, fonts
- Key files: App favicons

**supabase/**
- Purpose: Database schema and migrations
- Contains: SQL migration files
- Key files: Migration files in `migrations/` subdirectory

**docs/**
- Purpose: Non-code documentation
- Contains: Communication guidelines, email templates, meeting notes
- Key files: `communications/WAVY.md`, `communications/PRODUCT_UPDATE_TEMPLATE.md`

**scripts/**
- Purpose: Utility scripts run outside normal app flow
- Contains: Data migration scripts, email broadcast scripts
- Key files: `send-roadmap-email.ts`

**.planning/codebase/**
- Purpose: GSD codebase analysis documents
- Contains: Architecture, structure, conventions, testing, concerns docs
- Key files: This directory (generated by GSD mappers)

## Key File Locations

**Entry Points:**

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Root redirect |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Main dashboard |
| `/repreneurs` | `app/(dashboard)/repreneurs/page.tsx` | Repreneur list |
| `/repreneurs/[id]` | `app/(dashboard)/repreneurs/[id]/page.tsx` | Repreneur detail |
| `/pipeline` | `app/(dashboard)/pipeline/page.tsx` | Deal pipeline |
| `/offers` | `app/(dashboard)/offers/page.tsx` | Offers management |
| `/intake-v2` | `app/intake-v2/page.tsx` | Public intake form |
| `/auth/login` | `app/auth/login/page.tsx` | Login page |

**Configuration:**

| Purpose | File |
|---------|------|
| TypeScript | `tsconfig.json` |
| Next.js | `next.config.mjs` |
| Tailwind CSS | `tailwind.config.ts` |
| Environment variables | `.env.local` (local), `.env.example` (template) |
| Authentication config | `lib/auth.ts` |
| Better Auth integration | `lib/auth.ts`, `middleware.ts` |
| Questionnaire spec | `lib/config/questionnaire-v2.ts` |

**Core Logic:**

| Feature | File(s) |
|---------|---------|
| Repreneur CRUD | `lib/actions/repreneurs.ts` |
| Tier 1 Scoring | `lib/utils/tier1-scoring.ts` |
| Tier 2/3 Scoring | `lib/utils/tier2-scoring.ts`, `lib/utils/journey-derivation.ts` |
| Intake Form | `components/intake-v2/`, `lib/actions/intake-v2.ts`, `lib/types/intake-v2.ts` |
| Email Service | `lib/email/send-email.ts`, `lib/email/templates/*` |
| Authentication | `lib/auth.ts`, `lib/auth-server.ts`, `middleware.ts` |

**Testing:**

| Type | Location |
|------|----------|
| Unit tests | `lib/utils/__tests__/` |
| Config: Vitest | `package.json` (test scripts) |

## Naming Conventions

**Files:**

- React components: PascalCase (e.g., `RepreneursForm.tsx`)
- Pages: lowercase (e.g., `page.tsx`)
- Server actions: kebab-case base, camelCase function (e.g., `lib/actions/repreneurs.ts` with `createRepreneur()`)
- Utilities: kebab-case or camelCase based on exports (e.g., `tier1-scoring.ts`, `utils.ts`)
- Styles: Component co-located as `.tsx` file with `className` attributes (no separate CSS files except `styles/globals.css`)

**Directories:**

- Feature directories: lowercase (e.g., `components/repreneurs/`, `app/intake-v2/`)
- Grouped routes: (parentheses) for layout grouping (e.g., `app/(dashboard)/`)
- Dynamic routes: [brackets] (e.g., `app/(dashboard)/repreneurs/[id]/`)
- Utility directories: plural when collections (e.g., `lib/utils/`, `lib/constants/`, `lib/types/`)
- Singular for specific features (e.g., `lib/email/`, `lib/auth.ts`)

**TypeScript:**

- Types/interfaces: PascalCase (e.g., `Repreneur`, `IntakeV2FormData`)
- Enums: PascalCase (e.g., `LifecycleStatus`)
- Functions: camelCase (e.g., `calculateTier1Score()`)
- Constants: SCREAMING_SNAKE_CASE for immutable values (e.g., `DAILY_EMAIL_LIMIT`)

**Database:**

- Tables: lowercase underscore-separated (e.g., `repreneurs`, `repreneur_offers`, `email_logs`)
- Columns: lowercase underscore-separated (e.g., `tier1_score`, `lifecycle_status`, `ms_investment_thesis`)
- Foreign keys: `[table]_id` convention

## Where to Add New Code

**New Feature (e.g., new dashboard section):**

1. **Route/Page:** Create `app/(dashboard)/[feature]/page.tsx`
2. **Components:** Create `components/[feature]/` directory with domain components
3. **Logic:** Add server actions to `lib/actions/[feature].ts`
4. **Types:** Add types to `lib/types/[feature].ts` if significant data structures
5. **Navigation:** Add menu item to `components/app-sidebar.tsx` navigation array
6. **Database:** Add migration in `supabase/migrations/` if new tables needed

**New Component (within existing feature):**

- Location: `components/[feature]/ComponentName.tsx`
- If client component: Mark with `"use client"` at top
- If server component: Use `async` and await server functions
- Export from component directory (no index files, import full path)

**New Utility/Pure Function:**

- Location: `lib/utils/[feature].ts` for feature-specific, or `lib/utils.ts` for general
- Pattern: Pure function, no side effects
- Tests: Add to `lib/utils/__tests__/[feature].test.ts` if critical logic

**New Server Action:**

- Location: `lib/actions/[feature].ts`
- Pattern: `"use server"` directive at top, `async function actionName()`
- Error handling: Try/catch with user-friendly error messages
- Revalidation: Call `revalidatePath()` after mutations

**New Configuration:**

- Static lookup tables: `lib/constants/[feature].ts`
- Feature toggles: `lib/config/feature-flags.ts`
- Questionnaire specs: `lib/config/questionnaire-v2.ts`
- Scoring rules: `lib/data/evaluation-criteria.ts`

**New Type Definition:**

- Location: `lib/types/[feature].ts` (or add to existing if small)
- Pattern: Interfaces for main entities, type unions for variants
- No logic, only type definitions

## Special Directories

**app/(dashboard)/**
- Purpose: Protected routes with sidebar layout
- Generated: No (hand-written)
- Committed: Yes
- Note: The parentheses group routes under same layout without affecting URL path

**lib/email/templates/**
- Purpose: React Email template components
- Generated: No (hand-written TSX components)
- Committed: Yes
- Note: These are React components rendered to HTML strings, not Next.js pages

**supabase/migrations/**
- Purpose: Versioned database schema changes
- Generated: Can be auto-generated by Supabase CLI (`supabase db push`)
- Committed: Yes (schema as code)
- Note: One file per migration, timestamp-prefixed (e.g., `20260126120000_create_repreneurs.sql`)

**.next/**
- Purpose: Next.js build output and caches
- Generated: Yes (automatically by `npm run build`)
- Committed: No (in .gitignore)
- Note: Do not modify or commit

**node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)
- Note: Regenerate with `npm ci` in production

**public/**
- Purpose: Static assets served at `/`
- Generated: No (hand-placed or icon generation)
- Committed: Yes
- Note: Accessible via URLs like `/icon.svg`

