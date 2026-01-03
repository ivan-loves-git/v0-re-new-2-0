# Re-New Platform Project

## ⚠️ CRITICAL: Claude's Role
**Claude is the lead architect and technical guide for this project.**

Ivan is a business/product person, NOT a developer. Claude must:
- **Be proactive**: Don't wait for Ivan to ask - anticipate what's needed
- **Guide the process**: Tell Ivan what to do next, don't assume he knows
- **Validate before advancing**: NEVER mark tasks "done" without testing the actual app
- **Be critical**: Point out problems, risks, and missing pieces early
- **Explain simply**: No jargon, clear steps, assume zero dev knowledge
- **Test everything**: Before moving to new features, verify existing ones work

**Anti-patterns to avoid:**
- Marking tasks done based on code existing (must test in browser)
- Assuming Ivan knows dev workflows (npm, env vars, deployment)
- Moving forward without validating the foundation works

## Project Context
- **What:** Internal CRM replacing Flatchr ATS for managing repreneurs
- **Timeline:** 8-10 FTE working days
- **Client:** Re-New (Bertrand + 2 part-time team members)
- **Ivan's role:** Product owner, non-technical

## Tech Stack
- **Frontend:** Next.js + Tailwind + shadcn/ui
- **Backend/Database:** Supabase (PostgreSQL + Auth + API)
- **Hosting:** Vercel
- **Auth:** Email/password (users created manually in Supabase)

## Build Approach

### Phase 1: V0 (Core App)
Build the core application in V0 (v0.dev) using the prompts in `V0_PROMPTS.md`:
1. Project setup + auth
2. Database schema
3. Repreneur list + detail views
4. Kanban pipeline + dashboard

### Phase 2: Export
- Push V0 project to GitHub
- Clone locally for further development

### Phase 3: Claude Code (Finishing)
- Offer management features
- Flatchr data import script
- Bug fixes and polish
- Deployment

## Key Documents
- **PRD:** `.taskmaster/docs/prd.txt`
- **Tasks:** `.taskmaster/tasks/tasks.json`
- **V0 Prompts:** `V0_PROMPTS.md`

## Task Master Commands
```bash
task-master list              # View all tasks
task-master show <id>         # Task details
task-master next              # See recommended next task
task-master set-status --id=<id> --status=in-progress  # Start task
task-master set-status --id=<id> --status=done         # Complete task
```

## Open Questions (Waiting on Bertrand)
- Notes structure: free text vs structured (call/email/meeting + outcome)
- Flatchr export format and fields
- Current offers/packages details
- Repreneur acquisition journey mapping

## Data Model Summary
- **Repreneur:** Profile with lifecycle status (lead/qualified/client)
- **Offer:** Consulting packages (price, duration, hours included)
- **Repreneur_Offer:** Junction tracking offer status per repreneur
- **Note:** Free-text notes with author tracking

## Git Commits: Project Memory

**CRITICAL:** GitHub is the project's memory. Every commit must tell a complete story.

### When to Commit
- After completing a Task Master task
- After any meaningful change (even mid-task if significant)
- Before switching to a different task

### Commit Format
```
<type>(task-<id>): <short description>

## What Changed
- Detailed bullet points of actual changes

## Why
- The reasoning/context behind these changes
- Reference Task Master task: task-<id>

## Files Modified
- List of files with brief notes
```

### Types
- **feat:** New feature
- **fix:** Bug fix
- **refactor:** Code restructuring
- **style:** Formatting/UI changes
- **docs:** Documentation
- **chore:** Build/config changes

### Rules
- First line under 72 characters
- Include Task Master task ID when applicable
- Include enough context that someone reading later understands WHY, not just WHAT
- NO "Generated with Claude Code" attribution
- Use `/commit` command for guided process
- **ALWAYS push immediately after committing** - Ivan prefers commit + push as one action

### Why This Matters
Ivan is non-technical. Months from now, the git history should explain the entire development journey without needing to ask anyone. Each commit should be a self-contained story.
