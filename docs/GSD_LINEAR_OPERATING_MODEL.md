# GSD and Linear Operating Model

Last updated: 2026-05-16

## Purpose

Claude Code and Codex should use the same GSD project memory when working on Re-New. The shared memory is the repository `.planning/` folder.

Linear remains the team-facing execution board. It is where Bertrand, Ivan, and the project team can see scope, blockers, ownership, and progress.

## Source of Truth

| Layer | Source of truth | Use it for |
| --- | --- | --- |
| Product scope | PDR, Notion answers, founder decisions | What is included, postponed, blocked, or unclear |
| Execution planning | `.planning/` via GSD | Requirements, roadmap, phase plans, implementation notes, decisions, verification |
| Team tracking | Linear | Milestones, issues, visible status, blockers, release readiness |
| Code reality | GitHub and deployed app | Actual shipped behavior |

## Sync Rules

Use this mapping every time GSD produces or changes execution structure:

| GSD item | Linear item |
| --- | --- |
| Milestone | Linear milestone |
| Phase | Linear parent issue or milestone workstream |
| Implementation task | Linear issue |
| Verification item | Linear issue checklist/comment, or standalone blocker if release-critical |
| Deferred scope | Linear backlog issue labelled postponed/V3 |
| Blocker or human decision | Linear issue/comment with clear owner |

## Working Rule

GSD should not replace Linear, and Linear should not replace GSD.

GSD answers: how do we build this correctly?

Linear answers: what is visible to the team, what is blocked, and what is next?

When a phase is planned, executed, verified, blocked, descoped, or completed, update the corresponding Linear issue/status update in the same working session.

## Re-New V2 Immediate Setup

For the June V2 work, initialize or import GSD from:

- `docs/V2-PDR-DRAFT.md`
- Bertrand's Notion page `PDR - v 2026/05/14`
- The sent WhatsApp scope-boundary message from 2026-05-16
- Relevant Excel and PDF samples attached in Notion

Then mirror the resulting roadmap into Linear under the `Re-New platform` project.
