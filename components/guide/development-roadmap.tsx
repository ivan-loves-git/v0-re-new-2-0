"use client"

import { Calendar, CheckCircle, Sparkles, Bug, Palette, RefreshCw, Lightbulb, Target, AlertTriangle, Zap, GitBranch, Rocket } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Comprehensive roadmap capturing the full Wave journey
// Strategic decisions, technical learnings, iterations, and features
const roadmapEvents = [
  {
    period: "Feb 12, 2026",
    version: "0.9.2",
    title: "Login Security & Waitlist System",
    isCompleted: true,
    events: [
      {
        title: "Secure login page",
        type: "feature",
        description: "Removed quick-access buttons. Login now requires real credentials only.",
      },
      {
        title: "Request Access waitlist",
        type: "feature",
        description: "New form for repreneurs and sellers to request platform access. Entries stored for review.",
      },
      {
        title: "Role selection at signup",
        type: "feature",
        description: "Users choose Repreneur or Seller when requesting access, so we know who's knocking.",
      },
      {
        title: "Notes and activities bug fixed",
        type: "fix",
        description: "Notes no longer disappear after saving. Data persists correctly on all profiles.",
      },
    ],
  },
  {
    period: "Feb 4, 2026",
    version: "0.9.1",
    title: "Dashboard Fix & Performance Optimization",
    isCompleted: true,
    events: [
      {
        title: "Dashboard crash fixed",
        type: "fix",
        description: "Dashboard no longer crashes when a repreneur has 'Declined' status. The page now loads reliably for all profiles.",
      },
      {
        title: "App loads faster (~250KB lighter)",
        type: "feature",
        description: "Removed unused libraries and enabled automatic image compression. Pages load faster, especially on mobile.",
      },
      {
        title: "Public form ready for real users",
        type: "feature",
        description: "Test/autofill buttons removed from the intake form. The form is now clean and ready for external repreneurs.",
      },
    ],
  },
  {
    period: "Feb 2, 2026",
    version: "0.9.0",
    title: "AI Email Generator & Pipeline Improvements",
    isCompleted: true,
    events: [
      {
        title: "AI-powered email generator",
        type: "feature",
        description: "Wavy can now draft personalized emails for any repreneur. Select candidate, pick template, generate. Try it from /emails.",
      },
      {
        title: "Leads auto-sort by potential",
        type: "feature",
        description: "Pipeline Leads column now ranks by Tier 1 score — best candidates always on top.",
      },
      {
        title: "Declined vs Rejected distinction",
        type: "feature",
        description: "New 'Declined' status for internal decisions, separate from rejection emails sent to candidates.",
      },
      {
        title: "Declined column on pipeline",
        type: "feature",
        description: "New gray column on pipeline board between Client and Rejected.",
      },
      {
        title: "Profile data display fixes",
        type: "fix",
        description: "Investment Profile, T1 Skills radar, and WHEN editor now correctly show data from the new questionnaire.",
      },
      {
        title: "Navigation cleanup",
        type: "fix",
        description: "Dead routes removed, no more 404 errors in menu.",
      },
    ],
  },
  {
    period: "Jan 25, 2026",
    version: "0.8.9",
    title: "Questionnaire V2 & Flatchr Import",
    isCompleted: true,
    events: [
      {
        title: "New questionnaire live",
        type: "feature",
        description: "Complete intake form now at /intake-v2. Quick link in the sidebar for easy access.",
      },
      {
        title: "Scoring system updated",
        type: "feature",
        description: "Tier 1 rating now 200 points total — 100 for WHO (profile), 100 for WHEN (project readiness).",
      },
      {
        title: "Flags and recommendations automated",
        type: "feature",
        description: "System now flags concerns and suggests next steps (Deal Flow, Priority Interview) based on the scoring matrix.",
      },
      {
        title: "All Flatchr candidates imported",
        type: "feature",
        description: "Everyone from the Flatchr export is now in Wave. Historical data preserved.",
      },
      {
        title: "Multilingual form",
        type: "feature",
        description: "Intake form now available in French and English. Language toggle at the top.",
      },
    ],
  },
  {
    period: "Jan 25, 2026",
    version: "0.8.8",
    title: "Simplified Profile Editing",
    isCompleted: true,
    events: [
      {
        title: "Create test repreneur in 1 click",
        type: "feature",
        description: "New 'Intake (v2)' link in the sidebar. No more typing URLs manually.",
      },
      {
        title: "Edit answers directly on profile",
        type: "feature",
        description: "WHO/WHEN questions now editable right on the repreneur page. Scores update in real-time when you save.",
      },
      {
        title: "'Needs completion' badge clears automatically",
        type: "fix",
        description: "Once you fill in the new questionnaire for a legacy repreneur, the orange alert disappears.",
      },
      {
        title: "Old questionnaire locked",
        type: "refactor",
        description: "Historical answers preserved but not editable. All edits happen through the new unified form.",
      },
    ],
  },
  {
    period: "Jan 20, 2026",
    version: "0.8.7",
    title: "Antoine's Feedback Fixes",
    isCompleted: true,
    events: [
      {
        title: "Offer assignment bug fix",
        type: "fix",
        description: "Fixed 'appear then disappear' bug. Root cause: FK constraint on created_by referenced auth.users (Supabase Auth) but we use Better Auth. Fixed by dropping constraint and changing column from UUID to TEXT.",
      },
      {
        title: "Target region multi-select",
        type: "feature",
        description: "Repreneurs can now select multiple target regions instead of just one. Uses checkbox grid (same as sector preferences). Database column migrated from TEXT to JSONB array.",
      },
      {
        title: "Optimistic UI pattern",
        type: "feature",
        description: "Offer list now uses optimistic updates with local state buffer and mutation guard. Changes appear immediately while server confirms in background.",
      },
    ],
  },
  {
    period: "Jan 18, 2026",
    version: "0.8.5",
    title: "Auth Signup & Production Fixes",
    isCompleted: true,
    events: [
      {
        title: "Signup functionality",
        type: "feature",
        description: "Added signup option to login page. Toggle between Sign In and Sign Up modes. New users can create accounts with name, email, and password.",
      },
      {
        title: "Production cookie fix",
        type: "fix",
        description: "Fixed middleware to handle __Secure- cookie prefix in production. Login now works correctly on deployed Vercel instance.",
      },
      {
        title: "ICP Team email corrected",
        type: "fix",
        description: "Fixed ICP Team quick access button to use correct email (renew@icpteam.eu) instead of placeholder.",
      },
      {
        title: "Database schema for Better Auth",
        type: "decision",
        description: "Created camelCase tables (user, session, account, verification) matching Better Auth's expected schema. Deployed via Supabase SQL Editor.",
      },
    ],
  },
  {
    period: "Jan 18, 2026",
    version: "0.8.4",
    title: "Task Management UI Improvements",
    isCompleted: true,
    events: [
      {
        title: "Kanban board view",
        type: "feature",
        description: "New board view showing tasks in columns by status: To Do, In Progress, Blocked, Done. Quick status updates with click actions.",
      },
      {
        title: "View switcher",
        type: "feature",
        description: "Toggle between List view (grouped by stream) and Board view (grouped by status). Remembers preference during session.",
      },
      {
        title: "Compact task cards",
        type: "style",
        description: "Reduced vertical whitespace in task list. Smaller padding, tighter spacing, more tasks visible on screen.",
      },
      {
        title: "Edit form sync fix",
        type: "fix",
        description: "Task edit form now properly populates when clicking edit. Title and status now match the selected task.",
      },
    ],
  },
  {
    period: "Jan 17, 2026",
    version: "0.8.3",
    title: "Better Auth Migration",
    isCompleted: true,
    events: [
      {
        title: "Switched to Better Auth",
        type: "decision",
        description: "Migrated from Supabase Auth to Better Auth, a TypeScript-first, self-hosted authentication library. Gives full control over auth without Supabase lock-in.",
      },
      {
        title: "New auth middleware",
        type: "feature",
        description: "Created Next.js middleware for route protection. Automatically redirects unauthenticated users to login. Handles protected routes and session management.",
      },
      {
        title: "Email/password auth preserved",
        type: "feature",
        description: "Same login flow: email + password. Users sign in with their individual credentials.",
      },
      {
        title: "User creation API",
        type: "feature",
        description: "New /api/auth/create-users endpoint to seed initial users. Protected by admin secret in production.",
      },
      {
        title: "Tasks: Better Auth compatibility",
        type: "fix",
        description: "Updated task actions to use admin client (bypasses RLS). Auth verified at app layer via requireUser(). Removed FK-dependent fields.",
      },
    ],
  },
  {
    period: "Jan 17, 2026",
    version: "0.8.2",
    title: "Task Management for V1.0 Launch",
    isCompleted: true,
    events: [
      {
        title: "Tasks page with CRUD",
        type: "feature",
        description: "New /tasks page for tracking V1.0 launch activities. Create, edit, delete tasks with full form. Filter by stream, status, and owner.",
      },
      {
        title: "Stream-based organization",
        type: "feature",
        description: "Tasks grouped by work stream: Questionnaire, Emails, Branding, Testing, Go-Live. Progress bars per stream. Stats badges for completion tracking.",
      },
      {
        title: "Dependencies & blocking",
        type: "feature",
        description: "Tasks can depend on other tasks. Visual indicators show when a task is blocked by incomplete dependencies. Delay calculation from expected dates.",
      },
      {
        title: "Owner assignment",
        type: "feature",
        description: "Assign tasks to team members (Bertrand, Amélie, Antoine, Ivan). Filter views by owner. Track who's responsible for what.",
      },
      {
        title: "Dogfooding approach",
        type: "decision",
        description: "Using the platform itself to track V1.0 launch tasks. Tests authentication and email systems while managing the project.",
      },
    ],
  },
  {
    period: "Jan 17, 2026",
    version: "0.8.1",
    title: "Security Audit & Codebase Cleanup",
    isCompleted: true,
    events: [
      {
        title: "10 security issues fixed",
        type: "fix",
        description: "SQL injection protection, API auth checks, webhook signature enforcement, file upload validation (magic bytes), atomic DB operations, race condition fixes.",
      },
      {
        title: "Dead code removed",
        type: "refactor",
        description: "Removed ~1,665 lines: 4 unused dashboard versions, development/test pages, unused components. Cleaner codebase, faster builds.",
      },
      {
        title: "Database performance indexes",
        type: "feature",
        description: "Added 6 indexes for activities, notes, email_logs, and repreneurs tables. Queries will stay fast as data grows.",
      },
      {
        title: "Type safety improvements",
        type: "fix",
        description: "Fixed email template types, function signatures, and metadata structures. Better TypeScript strictness.",
      },
    ],
  },
  {
    period: "Jan 11, 2026",
    version: "0.8.0",
    title: "Structured Readiness Journey",
    isCompleted: true,
    events: [
      {
        title: "11 Readiness Milestones",
        type: "feature",
        description: "New Tier 3 milestone system with 11 checkboxes tracking acquisition readiness. Grouped by stage transitions: Explorer→Learner (3), Learner→Ready (4), Ready→Serial (4 incl. First Acquisition).",
      },
      {
        title: "Journey stage auto-derivation",
        type: "feature",
        description: "Journey stage now computed from milestone count instead of manual selection. Explorer (0-2), Learner (3-6), Ready (7-10), Serial Acquirer (11 milestones).",
      },
      {
        title: "Tier 2 competency dimensions",
        type: "feature",
        description: "6-dimension rating system replacing single star: Leadership, Financial Acumen, Communication, Clarity of Vision, Coachability, Commitment. Weighted average with 4.0 pass threshold.",
      },
      {
        title: "Profile header redesign",
        type: "style",
        description: "Status and Journey badges moved to top-right with labels. Milestones in compact 2-column layout below radar chart. Responsive mobile layout.",
      },
      {
        title: "Journey page milestone display",
        type: "feature",
        description: "Stage pipeline boxes now show milestone names instead of counts. Clear visibility into what's needed for each stage transition.",
      },
      {
        title: "Decision: Milestone-based progression",
        type: "decision",
        description: "Removed persona requirement for Serial Acquirer. Stage progression now purely based on completing milestones. 'First acquisition completed' is the key milestone for Serial status.",
      },
    ],
  },
  {
    period: "Jan 11, 2026",
    version: "0.7.5",
    title: "List View & Data Quality",
    isCompleted: true,
    events: [
      {
        title: "Repreneurs list UX overhaul",
        type: "feature",
        description: "Grouped view with per-group pagination (8 items/page). Independent column sorting per status group. Empty groups auto-collapse on load. Consistent visual layout.",
      },
      {
        title: "Fixed table column widths",
        type: "fix",
        description: "Long emails no longer push columns causing inconsistent widths between groups. Table uses fixed layout with truncation and ellipsis for overflow text.",
      },
      {
        title: "Avatar upload bug fixes",
        type: "fix",
        description: "Fixed server action rendering errors by moving to API routes. Added cache revalidation so avatar changes appear immediately in table views. Created migration for missing column.",
      },
      {
        title: "Journey progress badges",
        type: "feature",
        description: "Milestone count badges (X/11) now shown next to repreneur names on Journey page stage cards. Quick visibility into who needs attention.",
      },
      {
        title: "Flatchr data import",
        type: "feature",
        description: "SQL script for importing 93 historical repreneurs from Flatchr export. Includes tier1_score_breakdown field for imported records. One-time migration tool.",
      },
      {
        title: "Terminology standardization",
        type: "refactor",
        description: "Replaced 'candidate' with 'repreneur' throughout codebase and tests. Consistent language matching Re-New's terminology for acquisition entrepreneurs.",
      },
    ],
  },
  {
    period: "Jan 10-11, 2026",
    version: "0.7.0",
    title: "Tier 1 Rating Improvements",
    isCompleted: true,
    events: [
      {
        title: "Compact inline editor on profile",
        type: "feature",
        description: "All 15 Tier 1 questions now editable directly on profile page. Collapsible panel with dropdowns, multi-selects (with search), and toggles. Auto-recalculates score on change.",
      },
      {
        title: "LDC upload in intake form",
        type: "feature",
        description: "Lettre de Cadrage upload added to Step 4 (Goals) of public intake form. Amber-styled section with optional skip. Stored alongside CV.",
      },
      {
        title: "Scoring algorithm fix",
        type: "fix",
        description: "Fixed critical bug where scoring algorithm ignored database criteria. Admin edits in /guide/evaluation now properly affect new intake scores. Uses DB values with hardcoded fallback.",
      },
      {
        title: "Decision: In-place editing over wizard",
        type: "decision",
        description: "Replaced full-page questionnaire wizard for profile edits with compact inline editor. Faster for quick corrections while preserving step-by-step wizard for public intake.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.8",
    title: "Email System Live",
    isCompleted: true,
    events: [
      {
        title: "Resend integration configured",
        type: "feature",
        description: "Connected Resend API with verified domain notifications@renew-wave.com. Production email sending now operational.",
      },
      {
        title: "Founder notification emails",
        type: "feature",
        description: "Sent Welcome and High Score test emails to all 3 founders (Bertrand, Amelie, Antoine) to announce platform is live.",
      },
      {
        title: "Sandbox warning removed",
        type: "fix",
        description: "Removed development sandbox warning from Email Cockpit UI now that production email is configured.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.6",
    title: "Documents Management",
    isCompleted: true,
    events: [
      {
        title: "CV upload in intake form",
        type: "feature",
        description: "Repreneurs can now upload their CV (PDF only) during the intake questionnaire. Stored in Supabase Storage with 10MB limit.",
      },
      {
        title: "Documents card on profile",
        type: "feature",
        description: "New Documents card managing CV and Lettre de Cadrage uploads. View, upload, replace, and delete functionality with consistent UI.",
      },
      {
        title: "Lettre de Cadrage storage",
        type: "feature",
        description: "Added LDC document field for storing framing letters. Internal document, not included in public intake form.",
      },
      {
        title: "Decision: PDF-only for intake",
        type: "decision",
        description: "Intake form restricted to PDF uploads only for consistency. Profile page accepts both PDF and Word for flexibility.",
      },
      {
        title: "Avatar storage bucket setup",
        type: "fix",
        description: "Created avatars storage bucket with RLS policies. Custom photo uploads now work. Deterministic defaults (1 of 16 faces) shown when no custom photo.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.5",
    title: "Client Offers Timeline",
    isCompleted: true,
    events: [
      {
        title: "Offers page redesigned",
        type: "feature",
        description: "Transformed from package list to client offer timeline. Main view now shows all offers assigned to clients with visual progress tracking.",
      },
      {
        title: "Timeline progress indicator",
        type: "feature",
        description: "Visual status flow: Offered → Active → Completed. Each card shows client avatar, package, key dates, and milestone completion counts.",
      },
      {
        title: "Package management sheet",
        type: "feature",
        description: "Moved package CRUD to side panel ('Manage Packages' button). Packages are created rarely; daily use is tracking client progress.",
      },
      {
        title: "Search and filter",
        type: "feature",
        description: "Search by client name, email, or package. Filter by status (Active, Pending, Completed, Expired). Grouped display by status.",
      },
      {
        title: "Decision: Daily use case focus",
        type: "decision",
        description: "Recognized that packages are created rarely (3 exist). The daily use case is tracking offer progress with clients, not managing packages. UI reorganized accordingly.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.0",
    title: "Evaluation Criteria Visibility",
    isCompleted: true,
    events: [
      {
        title: "Evaluation Criteria page",
        type: "feature",
        description: "New Guide page showing all Tier 1 scoring questions, answers, and point values. Makes previously hard-coded scoring logic visible to dashboard users.",
      },
      {
        title: "Inline criteria editing",
        type: "feature",
        description: "Edit question labels, answer labels, and scores directly from the page. Changes only affect future candidates (existing scores frozen).",
      },
      {
        title: "Database-driven criteria",
        type: "refactor",
        description: "Scoring criteria moved from hard-coded TypeScript to database table. Foundation for future Tier 2 and Tier 3 evaluation systems.",
      },
      {
        title: "Decision: Frozen scores",
        type: "decision",
        description: "When criteria change, existing repreneur scores remain unchanged. Only new questionnaire completions use updated criteria. Preserves historical integrity.",
      },
    ],
  },
  {
    period: "Jan 4, 2026 (PM)",
    version: "0.5.5",
    title: "Email System Hardening",
    isCompleted: true,
    events: [
      {
        title: "Email error handling fixed",
        type: "fix",
        description: "Manual email send now properly checks Resend API response. UI displays actual errors instead of false success messages. Prevents silent failures.",
      },
      {
        title: "To Do guide page",
        type: "feature",
        description: "New guide page listing pending items for founders: domain verification, environment variables, Flatchr import, team onboarding. Actionable steps with external links.",
      },
      {
        title: "Test repreneur script",
        type: "feature",
        description: "Utility script to add test repreneur with Resend-verified email. Enables email testing while in sandbox mode.",
      },
      {
        title: "Learning: Resend sandbox mode",
        type: "learning",
        description: "Resend sandbox (onboarding@resend.dev) can only send to account owner email. Production requires verified domain. Added to To Do with step-by-step instructions.",
      },
    ],
  },
  {
    period: "Jan 4, 2026",
    version: "0.5.4",
    title: "Production Ready",
    isCompleted: true,
    events: [
      {
        title: "Wave Guide documentation system",
        type: "feature",
        description: "Created comprehensive in-app documentation with Mission, Instructions, and Roadmap pages. Team can onboard and reference platform guidelines without external docs.",
      },
      {
        title: "Email automation with Resend",
        type: "feature",
        description: "10 automated email templates: welcome, form step completions, high-score alerts, offer notifications, milestone celebrations. Manual send capability for testing.",
      },
      {
        title: "Learning: Next.js error sanitization",
        type: "learning",
        description: "Discovered production builds sanitize thrown errors from Server Actions. Switched to returning result objects { success, message } for proper error display.",
      },
      {
        title: "E2E test suite expanded",
        type: "feature",
        description: "67 automated tests across 10 suites covering Emails, Guide, Dashboard, Pipeline, and core CRUD operations. Test-driven confidence for future changes.",
      },
      {
        title: "Learnings module (external users)",
        type: "feature",
        description: "Swipeable course selector with lesson tracking. Dynamic theming per course. Foundation for repreneur self-service education content.",
      },
      {
        title: "Questionnaire form consolidation",
        type: "refactor",
        description: "Eliminated ~1800 lines of duplicated code. Public intake and internal questionnaire now share components and question definitions.",
      },
    ],
  },
  {
    period: "Jan 4, 2026 (AM)",
    version: "0.5.2",
    title: "Critical Infrastructure Fix",
    isCompleted: true,
    events: [
      {
        title: "Project structure flattened",
        type: "fix",
        description: "V0 export created broken nested app/app/ structure. Vercel builds failed, path aliases broke. 4-hour emergency restructure to standard Next.js layout.",
      },
      {
        title: "Learning: V0 export structure",
        type: "learning",
        description: "V0 exports with nested project structure that doesn't match standard Next.js. Future V0 projects need immediate restructuring before development continues.",
      },
      {
        title: "iCloud sync conflicts cleaned",
        type: "fix",
        description: "Removed 164 duplicate files from iCloud sync conflicts (*.* 2, *.* 3 suffixes). ~1GB of duplicate node_modules recovered.",
      },
      {
        title: "Email templates translated to English",
        type: "style",
        description: "All 10 email templates converted from French to English. Date formatting switched from fr-FR to en-US locale.",
      },
    ],
  },
  {
    period: "Jan 3, 2026",
    version: "0.5.0",
    title: "Wave Dashboard",
    isCompleted: true,
    events: [
      {
        title: "Dashboard complete redesign",
        type: "feature",
        description: "New 3-column layout with 12+ widgets. Wave branding with animated emoji logo. Activity stream, rankings, and conversion funnel all visible at once.",
      },
      {
        title: "Activity heatmap",
        type: "feature",
        description: "GitHub-style 12-month heatmap showing daily activity (new repreneurs + logged activities). Visual proof of team engagement over time.",
      },
      {
        title: "Decision: Streaming architecture",
        type: "decision",
        description: "Dashboard loads in 3 independent streaming sections. Parallel data fetches + 30-second cache. Page feels fast even with heavy data.",
      },
      {
        title: "Conversion funnel visualization",
        type: "feature",
        description: "Lead → Qualified → Client funnel with live conversion rates. Journey stage pie chart. Week-over-week comparisons for growth tracking.",
      },
      {
        title: "Notion-style avatars",
        type: "style",
        description: "Replaced gradient avatars with 24 Notion face illustrations. Deterministic assignment by repreneur ID. Cohesive, friendly visual language.",
      },
    ],
  },
  {
    period: "Jan 2, 2026",
    version: "0.4.5",
    title: "V1.0 Enhancements",
    isCompleted: true,
    events: [
      {
        title: "Offer milestones system",
        type: "feature",
        description: "Track deliverables and checkpoints per client. Milestones grouped by type with completion tracking. Visibility into engagement progress.",
      },
      {
        title: "Persona categorization",
        type: "feature",
        description: "Buyer types: First-time, Serial acquirer, Corporate spin-off, Family succession. Helps tailor communication and offer recommendations.",
      },
      {
        title: "Notes system redesign",
        type: "feature",
        description: "Note types (call, email, meeting, other) with icons and colors. Full-content view dialogs. Activity history enhanced with same pattern.",
      },
      {
        title: "Radar chart fixes",
        type: "fix",
        description: "Fixed scale to show actual max (~98 pts). Raw scores in tooltips. Clear dimension descriptions showing questionnaire sources.",
      },
      {
        title: "Form dropdowns replace free text",
        type: "feature",
        description: "Investment Capacity, Target Size, Target Location (French regions), Sector Preferences (multi-select). Structured data enables better filtering and analytics.",
      },
    ],
  },
  {
    period: "Jan 1, 2026",
    version: "0.4.0",
    title: "UX Polish Sprint",
    isCompleted: true,
    events: [
      {
        title: "Skeleton loading states",
        type: "feature",
        description: "Custom loading skeletons matching actual page layouts. Perceived performance boost. No more layout shift on page loads.",
      },
      {
        title: "Page transition animations",
        type: "feature",
        description: "Framer Motion fade/slide between routes. Animated sidebar active indicator. App feels polished and responsive.",
      },
      {
        title: "Toast notification system",
        type: "feature",
        description: "Sonner library integration. Success/error feedback for all CRUD operations. Non-intrusive bottom-right positioning.",
      },
      {
        title: "Optimistic UI updates",
        type: "feature",
        description: "useOptimistic hook for instant inline edits. UI updates immediately, syncs with server in background. Automatic rollback on errors.",
      },
      {
        title: "Tier 1 radar chart",
        type: "feature",
        description: "Spider chart visualizing 5 scoring dimensions: Experience, Leadership, M&A Knowledge, Readiness, Financial. Instant candidate assessment.",
      },
    ],
  },
  {
    period: "Dec 31, 2025",
    version: "0.3.8",
    title: "Bug Fixing Day",
    isCompleted: true,
    events: [
      {
        title: "Notes disappearing bug",
        type: "fix",
        description: "Notes vanished after optimistic updates due to state clearing before save. Fixed by preserving content until server confirms.",
      },
      {
        title: "React hydration warnings",
        type: "fix",
        description: "Added suppressHydrationWarning for timestamp differences between server and client rendering.",
      },
      {
        title: "EditableSelectField crash",
        type: "fix",
        description: "Radix UI Select doesn't allow empty strings. Changed 'Clear' option to special constant '__CLEAR__' converted to null on save.",
      },
      {
        title: "Learning: Optimistic update edge cases",
        type: "learning",
        description: "Optimistic UI needs careful state management. Always preserve original data until server confirms. Plan rollback paths upfront.",
      },
    ],
  },
  {
    period: "Dec 30, 2025",
    version: "0.3.5",
    title: "Core Feature Sprint",
    isCompleted: true,
    events: [
      {
        title: "Decision: Action-driven status",
        type: "decision",
        description: "Major architecture decision: No manual drag-drop status changes. Status derived from actions (set Tier 2 → Qualified, assign offer → Client). Prevents inconsistent data.",
      },
      {
        title: "Two-tier scoring system",
        type: "feature",
        description: "Tier 1: Automated score from 15 questionnaire questions with category breakdown. Tier 2: Manual 1-5 stars post-interview. Separates data from judgment.",
      },
      {
        title: "Full questionnaire system",
        type: "feature",
        description: "15 structured questions covering Experience, Leadership, M&A Knowledge, Readiness, Financials. Auto-scoring with detailed breakdowns.",
      },
      {
        title: "Avatar system with uploads",
        type: "feature",
        description: "24 default illustrations with deterministic assignment. Custom photo upload via Supabase Storage. Multiple size variants for different contexts.",
      },
      {
        title: "Notes with author tracking",
        type: "feature",
        description: "Free-text notes with timestamp and author. Chronological display. Foundation for team communication history.",
      },
      {
        title: "Inline editing components",
        type: "feature",
        description: "EditableTextField, EditableSelectField, EditableMultiSelectField. Click-to-edit pattern with keyboard shortcuts (Enter to save, Escape to cancel).",
      },
    ],
  },
  {
    period: "Dec 29, 2025",
    version: "0.3.0",
    title: "Platform Foundation",
    isCompleted: true,
    events: [
      {
        title: "Repository initialized",
        type: "feature",
        description: "Exported from V0, connected to GitHub, deployed to Vercel. First working version accessible via URL.",
      },
      {
        title: "Journey stage concept",
        type: "feature",
        description: "Repreneur maturity tracking: Explorer → Learner → Ready → Serial Acquirer. Independent from pipeline status. Tracks acquisition readiness.",
      },
      {
        title: "Offer management CRUD",
        type: "feature",
        description: "Create, edit, delete offers. Assignment to repreneurs with status workflow (offered → active → completed/expired). Auto-expiration dates.",
      },
      {
        title: "Pipeline views",
        type: "feature",
        description: "Kanban board with filters (name, source, date range). List view with status grouping and collapsible sections. 'Show more' for large datasets.",
      },
      {
        title: "Test data seeding",
        type: "feature",
        description: "API endpoint for populating dev environment. 10 test repreneurs, 4 offers, sample notes. Essential for development and demos.",
      },
      {
        title: "Detail page with inline editing",
        type: "feature",
        description: "Full repreneur profile with click-to-edit fields. Status badge, journey stage dropdown, back button navigation.",
      },
    ],
  },
  {
    period: "Dec 27-28, 2025",
    version: "0.2.5",
    title: "V0 Foundation",
    isCompleted: true,
    events: [
      {
        title: "Next.js + Supabase setup",
        type: "feature",
        description: "Project scaffolded in V0. Supabase client configuration, environment variables, Vercel deployment pipeline established.",
      },
      {
        title: "Authentication system",
        type: "feature",
        description: "Email/password auth with Supabase for 3 team members. Login page, protected routes, session persistence. Users created manually.",
      },
      {
        title: "Database schema design",
        type: "feature",
        description: "Repreneur, Offer, Note, Activity tables with foreign keys. Row Level Security policies. Migration scripts for iterative changes.",
      },
      {
        title: "Repreneur list view",
        type: "feature",
        description: "Sortable, filterable table. Clickable rows navigating to detail page. Source tags, status badges, contact info display.",
      },
      {
        title: "shadcn/ui component library",
        type: "feature",
        description: "Installed Card, Button, Badge, Dialog, Select, Dropdown, Sheet, and more. Consistent design system from day one.",
      },
    ],
  },
  {
    period: "Dec 22-26, 2025",
    version: "0.2.0",
    title: "Architecture Planning",
    isCompleted: true,
    events: [
      {
        title: "Decision: V0 for rapid prototyping",
        type: "decision",
        description: "Chose to start in V0.dev for AI-assisted UI generation, then export to local for advanced features. Speed over full control initially.",
      },
      {
        title: "Decision: Supabase over custom backend",
        type: "decision",
        description: "PostgreSQL + instant APIs + auth + storage in one platform. No separate backend needed. Team can manage DB through dashboard.",
      },
      {
        title: "Database schema finalized",
        type: "feature",
        description: "Defined Repreneur lifecycle, Offer structure, Note/Activity tracking. Considered Flatchr fields for migration compatibility.",
      },
      {
        title: "Decision: No drag-drop Kanban",
        type: "decision",
        description: "Rejected manual status changes via drag-drop. Status changes must be triggered by meaningful actions. Prevents 'status without substance' problem.",
      },
      {
        title: "TaskMaster setup",
        type: "feature",
        description: "Configured task tracking with MCP integration. PRD parsed into 50+ actionable tasks with dependencies. Progress visible in tasks.json.",
      },
    ],
  },
  {
    period: "Dec 18-21, 2025",
    version: "0.1.5",
    title: "Requirements & Strategy",
    isCompleted: true,
    events: [
      {
        title: "PRD completed",
        type: "feature",
        description: "6-page product requirements document covering authentication, data model, scoring, offers, activities, and UI requirements.",
      },
      {
        title: "Learning: CRM vs ATS mindset",
        type: "learning",
        description: "Flatchr treated repreneurs as one-time candidates. Wave must treat them as long-term relationships. This shapes every feature decision.",
      },
      {
        title: "Timeline scoped: 8-10 FTE days",
        type: "decision",
        description: "Aggressive but achievable timeline. Prioritized core pipeline over nice-to-haves. Deferred Flatchr import, advanced analytics, client portal.",
      },
      {
        title: "Tech stack confirmed",
        type: "decision",
        description: "Next.js 16 + Tailwind + shadcn/ui for frontend. Supabase for backend. Vercel for hosting. Modern, maintainable, well-documented.",
      },
    ],
  },
  {
    period: "Dec 15-17, 2025",
    version: "0.1.0",
    title: "Project Inception",
    isCompleted: true,
    events: [
      {
        title: "Problem identified: Flatchr limitations",
        type: "decision",
        description: "Current ATS designed for recruitment, not relationship management. Once candidate 'placed', the system forgets them. Repreneurs need ongoing support.",
      },
      {
        title: "Vision: Purpose-built repreneur CRM",
        type: "decision",
        description: "Single profile per repreneur tracking entire journey. Multiple offers over time. Activity history. Cost analytics eventually. Built for Re-New's specific workflow.",
      },
      {
        title: "Stakeholder alignment",
        type: "decision",
        description: "Bertrand (CEO) + 2 part-time team members as users. Simple access model: 3 equal users, no role hierarchy. Focus on usability over enterprise features.",
      },
      {
        title: "Decision: Build custom vs buy",
        type: "decision",
        description: "Evaluated off-the-shelf CRMs. None matched repreneur journey model with integrated scoring and offer tracking. Custom build justified by unique requirements.",
      },
    ],
  },
]

const typeConfig = {
  feature: { icon: Sparkles, color: "text-blue-600", bgColor: "bg-blue-50", label: "Feature" },
  fix: { icon: Bug, color: "text-green-600", bgColor: "bg-green-50", label: "Fix" },
  style: { icon: Palette, color: "text-purple-600", bgColor: "bg-purple-50", label: "Style" },
  refactor: { icon: RefreshCw, color: "text-amber-600", bgColor: "bg-amber-50", label: "Refactor" },
  decision: { icon: Target, color: "text-rose-600", bgColor: "bg-rose-50", label: "Decision" },
  learning: { icon: Lightbulb, color: "text-yellow-600", bgColor: "bg-yellow-50", label: "Learning" },
}

export function DevelopmentRoadmap() {
  // Calculate stats
  const totalEvents = roadmapEvents.reduce((acc, period) => acc + period.events.length, 0)
  const decisions = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "decision").length, 0)
  const learnings = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "learning").length, 0)
  const features = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "feature").length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Development Roadmap</h2>
        <p className="text-sm text-gray-500 mt-1">
          The complete journey of Wave — from first idea to production
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{roadmapEvents.length}</div>
          <div className="text-xs text-gray-500">Milestones</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{features}</div>
          <div className="text-xs text-gray-500">Features</div>
        </div>
        <div className="text-center p-3 bg-rose-50 rounded-lg">
          <div className="text-2xl font-bold text-rose-600">{decisions}</div>
          <div className="text-xs text-gray-500">Decisions</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{learnings}</div>
          <div className="text-xs text-gray-500">Learnings</div>
        </div>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-200" />

        {roadmapEvents.map((period, index) => (
          <div
            key={index}
            className="relative pl-10 pb-8 last:pb-0 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Timeline dot */}
            <div className="absolute left-0 w-6 h-6 rounded-full bg-blue-500 border-4 border-white shadow-sm" />

            {/* Period card */}
            <Card className="overflow-hidden border-blue-100 py-0 gap-0">
              <CardContent className="p-0">
                <div className="p-4 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs bg-white">
                        <Calendar className="w-3 h-3 mr-1" />
                        {period.period}
                      </Badge>
                      {period.isCompleted && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {period.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {period.events.length} updates
                      {period.version && (
                        <span className="ml-2 text-[10px] font-mono text-gray-400">v{period.version}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="px-3 pb-3 pt-2 border-t border-blue-100 space-y-2">
                  {period.events.map((event, i) => {
                    const config = typeConfig[event.type as keyof typeof typeConfig]
                    const Icon = config.icon
                    return (
                      <div
                        key={i}
                        className="flex gap-2.5 py-2 px-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors animate-slide-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div className={`p-1.5 rounded-md ${config.bgColor} h-fit`}>
                          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 text-sm">
                              {event.title}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-4 border-t">
        <p className="flex items-center justify-center gap-2">
          <Rocket className="h-4 w-4 text-blue-500" />
          {totalEvents} milestones completed in 3 weeks
        </p>
      </div>
    </div>
  )
}
