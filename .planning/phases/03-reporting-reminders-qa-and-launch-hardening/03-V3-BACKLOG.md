---
gsd_type: deferred_backlog
phase: "03-reporting-reminders-qa-and-launch-hardening"
created_at: "2026-05-17"
status: ready_for_v3_review
---

# V3 Deferred Backlog

## Rule

V3 items should start only after June V2 basics are validated with real staff usage: opportunity quality, recommendation quality, repreneur response behavior, active-pursuit control, NDA/document friction, and operating dashboard usefulness.

## Backlog Items

| ID | Item | Why It Matters | Start When |
|----|------|----------------|------------|
| AUTO-01 | Automatic PDF teaser parsing | Reduces manual opportunity entry from PDFs and teasers. | The June opportunity schema has survived real samples without major changes. |
| AI-01 | AI sector and thesis interpretation | Helps convert messy qualitative opportunity text into structured matching signals. | Staff agrees on the taxonomy and what "good match" means from real examples. |
| AI-02 | In-platform deal analysis memos | Creates richer decision support for active opportunities. | The team knows which memo sections are actually used in pursuit decisions. |
| DOC-02 | Inline PDF viewer | Lets staff and repreneurs review documents without downloading. | Download flow is validated and document permissions are stable. |
| MNA-CRM-01 | Full M&A firm CRM with 300 to 1000 contacts | Turns source/contact tracking into a real relationship-management surface. | Staff confirms which relationship workflows must be tracked, not just stored. |
| PORTAL-01 | M&A firm portal | Lets external intermediaries submit or manage opportunities. | Human-managed source process is stable and legal/data boundaries are clear. |
| NDA-ESIGN-01 | E-signature workflow | Removes manual NDA tracking and improves auditability. | Legal template and signer responsibilities are locked. |
| REP-SELF-01 | Repreneur self-service and profile editing | Lets repreneurs maintain their own data and preferences. | Read-only portal usage is validated and support load is understood. |
| REPORT-01 | Polished investor-style reporting | Creates board/investor-ready reporting beyond operational dashboard counts. | The team has stable KPI definitions and reporting cadence. |

## Candidate V3 Phases

### V3-A: Data Automation

- Automatic teaser/PDF parsing.
- Human review queue for parsed fields.
- Confidence flags for low-quality extraction.
- Audit trail from source document to structured opportunity fields.

### V3-B: Recommendation Intelligence

- Stronger fit scoring from structured opportunity and repreneur fields.
- Human feedback loop from staff recommendation changes.
- AI support for sector/thesis interpretation after taxonomy stabilizes.
- Evaluation dataset from accepted/rejected recommendations.

### V3-C: External Portals

- Repreneur profile self-service.
- M&A firm opportunity submission and source portal.
- More explicit external-user permissions and audit logging.
- Invitation and credential provisioning from the staff dashboard.

### V3-D: Legal and Documents

- E-signature provider selection.
- Signed-document storage and audit trail.
- Inline PDF viewing.
- Document read receipts and access logs if needed.

### V3-E: Reporting

- Investor-style reporting.
- Exportable dashboards.
- Monthly/quarterly deal-flow package.
- Source quality and repreneur conversion analytics.

## Do Not Pull Into June V2

- Do not add AI-generated matching without an evaluation plan.
- Do not add M&A firm accounts until staff source workflow is stable.
- Do not add e-signature until legal ownership is explicit.
- Do not add profile editing until the read-only repreneur portal has been tested.
- Do not build polished reporting before the team confirms which KPI definitions matter.

## Executive Summary

V3 should not be a random expansion of features. It should be the next layer after the team proves the core June workflow: clean opportunities, useful recommendations, repreneur responses, active pursuit control, NDA/documents, and operating visibility.

The fastest path is to validate June V2 first, then choose one V3 lane with the highest operational pain: data automation, recommendation intelligence, external portals, legal/documents, or reporting.
