# Re-New Project Status

**Last updated:** 2026-05-31
**Scope:** Non-code product progress memory for the Re-New platform

## Current Operating Setup

Notion is only for the product pipeline: requests, testing asks, product feedback, product decisions, blockers, parking-lot scope, and product-relevant development progress.

Notion is not for AI notes, internal process explanations, generic memory, or personal reminders.

The local project files are the durable non-code memory for how the project is progressing outside the app code. Use this file for human-readable project status. Use `.planning/` for GSD execution state and implementation details.

## Product Pipeline

The working product tracker is in Notion:

- Hub: https://www.notion.so/36d36d8dca88813aba3cec53187b0773
- Tracker: https://www.notion.so/5ab7539e0bb5485d928e09b26f42ae1c

The tracker views are:

- **1. Today:** active work and items needing attention now.
- **2. Needs Bertrand / Colin:** decisions, testing asks, feedback, or operational input.
- **3. Ready to Test:** items ready for product validation.
- **4. Done / Product Story:** completed product changes and accepted progress.
- **All items:** full tracker.
- **Parking Lot:** future scope that should not distract current delivery.
- **Roadmap by Phase:** phase-level view.

## Operating Rules

Every new product request, feedback point, demo comment, bug, or operational question should become a tracker item.

Each tracker item should have a clear summary, status, owner, next ask, priority, review flag, and reviewer when needed.

Built work that needs validation should move to **3. Ready to Test**.

Founder-level product direction, scope, business rules, and strategic tradeoffs go to Bertrand.

Testing, operational choices, Wave setup, workflow clarity, and design choices go to Colin, with Bertrand added when his feedback is also relevant.

The Dev team owns implementation and technical cleanup. Technical cleanup should stay out of Bertrand and Colin's review queue unless it changes the product workflow.

## Current Product Story

The Product Development Hub and Product Development Tracker were created to replace scattered product follow-up with one product-facing pipeline.

The old PDR remains preserved as source material. The tracker is the live operating place for current requests, testing, decisions, development progress, and future scope.

The team update introducing the hub and tracker was sent to Bertrand on 2026-05-31.

## Maintenance Rhythm

Daily or during active build work:

- Add new product requests and feedback to the tracker.
- Move completed build-side items to **3. Ready to Test** if Bertrand or Colin need to validate them.
- Move accepted work to **4. Done / Product Story**.
- Move future scope to **Parking Lot**.

Weekly or before team updates:

- Review aging open items.
- Check **2. Needs Bertrand / Colin** for stalled decisions or testing asks.
- Keep the tracker focused on closing tickets in reasonable time on each side.
- Update this file only when the project operating setup or high-level product story changes.
