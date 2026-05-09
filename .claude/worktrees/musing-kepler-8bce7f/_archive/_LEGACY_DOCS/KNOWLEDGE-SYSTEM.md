---
title: Knowledge System Architecture
purpose: AI Agent Operating Manual
version: 1.0
created: 2025-10-24
author: Ivan Paudice
status: canonical
last_reviewed: 2025-10-24
---

# Knowledge System Architecture
## How This Repository Works & Why

This document is the **constitution** for AI agents working with the Re-New project. It explains the philosophy, patterns, and rules that make this repository a living, learning business operating system—not just a file dump.

---

## 🎯 Core Philosophy

This structure implements the **AI CoFounder manifesto**: treating a company like a living codebase where context management—not raw intelligence—is the constraint. The key principles:

1. **Repo-first truth** → Single source of truth with PR-only mutations
2. **Task-scoped retrieval** → Never prompt-stuff; assemble context strategically
3. **Artifacts, not monologues** → Produce files you can ship, cite, and diff
4. **Connector-as-ingest** → External sources flow in, but the repo is where knowledge lives
5. **Write-back with review** → Every change to canonical knowledge requires human approval
6. **Provenance tracking** → Every claim is traceable to its source
7. **Ephemeral scratchpads** → Work-in-progress never pollutes truth

**Why this matters:** A well-structured knowledge base means tomorrow's AI can answer questions better than today's, because every completed task improves the corpus.

---

## 📊 Repository Architecture Map

```
LIFECYCLE FLOW:
External World → INBOX → SCRATCHPAD → ARTIFACTS → CANONICAL
                   ↓         ↓           ↓          ↓
                Process   Work     Deliverables  Truth
                          Draft                   (PR-only)
```

### The Seven Zones

| Zone | Purpose | Mutability | AI Autonomy |
|------|---------|------------|-------------|
| **00_CANONICAL** | Single source of truth | PR-only (with change history) | Read + Propose |
| **01_WORKSTREAMS** | Active work contexts | Semi-mutable | Read + Update |
| **02_ARTIFACTS** | Shippable deliverables | Append-only | Create + Version |
| **03_DECISION_LOG** | Immutable audit trail | Append-only | Create only |
| **04_MEETINGS** | Raw session captures | Append-only | Create + Distill |
| **05_INBOX** | Staging from connectors | Disposable | Process + Route |
| **06_SCRATCHPAD** | Ephemeral workspace | Fully mutable | Full autonomy |
| **07_ARCHIVE** | Historical reference | Immutable | Read-only |
| **08_SYSTEM** | Meta-infrastructure | PR-only | Read + Propose |

---

## 🗂️ Folder Decision Tree

### "Where does this information belong?"

Use this decision tree every time you handle new information:

#### START HERE ↓

**Is this information TRUE and FINAL?**
- ✅ YES → Is it strategic/operational/brand knowledge?
  - ✅ Strategic → `00_CANONICAL/strategy/`
  - ✅ Operational → `00_CANONICAL/operations/`
  - ✅ Brand → `00_CANONICAL/brand/`
  - ✅ Lessons/Context → `00_CANONICAL/knowledge/`
- ❌ NO → Continue to next question

**Is this a DECISION that was made?**
- ✅ YES → `03_DECISION_LOG/YYYY-QX/NNN-decision-name.md`
- ❌ NO → Continue to next question

**Is this a DELIVERABLE (brief, deck, report, email, SOP)?**
- ✅ YES → `02_ARTIFACTS/{category}/`
- ❌ NO → Continue to next question

**Is this MEETING NOTES or session capture?**
- ✅ YES → `04_MEETINGS/{session-type}/YYYY-MM-DD-title.md`
  - Then: Distill insights to CANONICAL within 48 hours
- ❌ NO → Continue to next question

**Is this ACTIVE WORK for a specific workstream?**
- ✅ YES → `01_WORKSTREAMS/{workstream}/`
- ❌ NO → Continue to next question

**Is this RAW INPUT from external source (email/Slack/Notion)?**
- ✅ YES → `05_INBOX/_from-{source}/`
  - Then: Process within 7 days (promote, archive, or discard)
- ❌ NO → Continue to next question

**Is this a WORK-IN-PROGRESS draft or exploration?**
- ✅ YES → `06_SCRATCHPAD/{category}/`
  - Remember: Nothing here is truth until reviewed and promoted
- ❌ NO → Continue to next question

**Is this OUTDATED but historically valuable?**
- ✅ YES → `07_ARCHIVE/{category}/`
- ❌ NO → It might not belong in the repo. Ask for guidance.

---

## 🔄 Information Flow Patterns

### Pattern 1: Meeting → Canonical
**Trigger:** Weekly sync, tutor session, stakeholder call

```
1. During/After Meeting:
   → Create in 04_MEETINGS/{type}/YYYY-MM-DD-title.md
   → Use TEMPLATE-meeting-note.md
   → Capture: attendees, decisions, action items, insights

2. Within 48 Hours:
   → Review meeting note
   → Extract insights that change understanding
   → Draft update to relevant CANONICAL doc
   → Mark as [PROPOSED CHANGE] in 06_SCRATCHPAD/
   → Request human review

3. After Approval:
   → Merge to 00_CANONICAL/
   → Update meeting note with "→ Promoted to [link]"
   → Archive meeting note if fully processed
```

### Pattern 2: External Input → Actionable Knowledge
**Trigger:** Email thread, Slack discussion, Notion update

```
1. Ingestion:
   → Save to 05_INBOX/_from-{source}/
   → Tag with: date, source, participants, topic

2. Processing (do within 7 days):
   → If it's a decision → 03_DECISION_LOG/
   → If it updates strategy → Draft change to 00_CANONICAL/
   → If it's noise → Delete from INBOX
   → If it's reference → 07_ARCHIVE/

3. Cleanup:
   → Empty processed items from INBOX weekly
   → INBOX should never have >20 items
```

### Pattern 3: Creating a Deliverable
**Trigger:** Need to produce brief, deck, email, report

```
1. Understand Task:
   → Check 00_CANONICAL/ for relevant strategy/brand context
   → Check 01_WORKSTREAMS/ for active work context
   → Check 03_DECISION_LOG/ for relevant decisions

2. Draft in Scratchpad:
   → 06_SCRATCHPAD/drafts/{deliverable-name}.md
   → Use relevant TEMPLATE from 08_SYSTEM/templates/
   → Work iteratively with human feedback

3. Finalize:
   → Move to 02_ARTIFACTS/{category}/
   → Add YAML front-matter with provenance
   → Link to source documents in CANONICAL
   → Update relevant workstream README with link

4. Learn:
   → If this deliverable reveals new strategic insights
   → Draft update to 00_CANONICAL/ for review
```

### Pattern 4: Strategy Evolution (PR-style)
**Trigger:** Need to update core business knowledge

```
⚠️ CANONICAL changes require human approval

⚠️ CRITICAL: CANONICAL files preserve change history (see below)

1. Draft Change:
   → Never edit 00_CANONICAL/ directly
   → Create version in 06_SCRATCHPAD/proposed-changes/
   → Document: what's changing, why, what impact

2. Review Request:
   → Present diff to human
   → Explain: old understanding → new understanding
   → Cite: sources (meetings, decisions, data)

3. Approval & Merge:
   → Human reviews and approves
   → Merge change to 00_CANONICAL/ using change history format:
      • Add new content at TOP of relevant section
      • Move old content to BOTTOM under "## Change History"
      • Strike through old content using ~~strikethrough~~
      • Add timestamp and reason for change
   → Log in 03_DECISION_LOG/ if it's a strategic pivot

4. Update Dependencies:
   → Check: do other CANONICAL docs need updates?
   → Check: do WORKSTREAMS need new context?
   → Update staleness markers if needed
```

**Example of CANONICAL change history format:**

```markdown
## Business Model (Updated 2025-10-24)

Our revenue model focuses on success-based fees from completed acquisitions...

---

## Change History

### Business Model (Previous - 2025-10-15)
~~We planned to charge candidates a flat tuition fee of €5,000...~~

**Changed:** 2025-10-24
**Reason:** Market validation showed candidates prefer success-based model; reduces barrier to entry
**Source:** 04_MEETINGS/weekly-sync/2025-10-18-sync.md, Decision 003
```

---

## 🧠 Context Assembly Strategy

### Token Budget Discipline

**Problem:** Models have limited context windows. Dumping the entire repo into every prompt wastes tokens and degrades performance.

**Solution:** Assemble task-scoped context packs.

#### For Different Task Types:

**Task: Answer strategic question**
```
Load:
- 00_CANONICAL/strategy/ (all)
- 00_CANONICAL/knowledge/lessons-learned.md
- Recent 03_DECISION_LOG/ entries (last 5)
- Relevant 01_WORKSTREAMS/ README
Skip:
- Meeting notes (unless specifically about this question)
- Artifacts (unless need to reference past work)
- Archive (unless researching history)
```

**Task: Draft external communication**
```
Load:
- 00_CANONICAL/brand/ (all)
- 00_CANONICAL/strategy/value-proposition.md
- 08_SYSTEM/.ai-instructions/writing-style.md
- Relevant 02_ARTIFACTS/ examples
Skip:
- Operations docs
- Meeting notes
- Technical decisions
```

**Task: Update workstream status**
```
Load:
- 01_WORKSTREAMS/{specific-workstream}/ (all)
- 00_CANONICAL/operations/team-structure.md
- Recent 04_MEETINGS/weekly-sync/ (last 2)
Skip:
- Other workstreams
- Brand docs
- Archive
```

**Task: Process inbox item**
```
Load:
- The inbox item itself
- KNOWLEDGE-SYSTEM.md (this doc)
- 08_SYSTEM/workflows/how-to-promote-from-inbox.md
- If topic-relevant: scan CANONICAL for related docs
Skip:
- Everything else until routing decision is made
```

### Progressive Summarization

For long documents (>5000 tokens):
1. Read document structure (headings)
2. Identify relevant sections
3. Load only those sections
4. Summarize key points in SCRATCHPAD
5. Reference summary in final output

**Never:** Load entire document if you only need part of it.

---

## ✅ Review Gates & Approval Rules

### What Requires Human Approval

| Action | Approval Required? | Why |
|--------|-------------------|-----|
| Create in SCRATCHPAD | ❌ No | Ephemeral workspace |
| Create in INBOX | ❌ No | Just staging |
| Create in MEETINGS | ❌ No | Raw capture |
| Create in ARTIFACTS | ⚠️ Yes, final review | Represents the company externally |
| Update WORKSTREAMS | ⚠️ Situational | Status updates: no / Strategic pivots: yes |
| Update CANONICAL | ✅ Always | Source of truth |
| Create DECISION_LOG entry | ⚠️ Yes | Audit trail must be accurate |
| Move from SCRATCHPAD to ARTIFACTS | ✅ Always | Quality gate |
| Archive CANONICAL doc | ✅ Always | Changes company memory |

### Pre-merge Checklist

Before proposing a change to CANONICAL:

```markdown
[ ] Change is based on verified information (meeting, decision, data)
[ ] Change is documented with source provenance
[ ] Change does not contradict other CANONICAL docs (or contradictions are explained)
[ ] Change includes "last_reviewed" date update in YAML
[ ] Change is presented as a clear diff (old → new)
[ ] Impact on dependent docs is assessed
[ ] Reason for change is documented (why now?)
```

---

## 📋 YAML Front-matter Standards

Every document should have front-matter for provenance:

### Canonical Documents
```yaml
---
title: "Business Model"
purpose: "Define core business model and validation status"
version: 2.1
created: 2025-09-15
author: Ivan Paudice
last_reviewed: 2025-10-24
status: canonical
related_docs:
  - strategy/value-proposition.md
  - knowledge/lessons-learned.md
---
```

### Decision Log Entries
```yaml
---
decision_id: 001
title: "Distribution vs Technology Priority"
date: 2025-10-18
participants: [Ivan, Bertrand, Nacho]
outcome: "Prioritize distribution channels over platform features"
status: implemented
impact: high
related_workstreams: [scale-refine, expansion]
sources:
  - meetings/weekly-sync/2025-10-18-sync.md
  - analysis of Campaign 1 vs 2 results
---
```

### Artifacts
```yaml
---
title: "Q4 Campaign Brief"
type: brief
version: 1.0
created: 2025-10-22
author: Ivan Paudice
status: final
audience: internal
sources:
  - strategy/business-model.md
  - brand/key-messages.md
  - decision-log/2025-Q4/001-distribution-vs-tech.md
---
```

### Meeting Notes
```yaml
---
meeting_type: weekly-sync
date: 2025-10-21
participants: [Bertrand, Ivan, Nacho, Alex, Piera, Gabriele]
duration: 60min
key_topics: [Campaign 2 results, Distribution strategy, ICP timeline]
decisions_made: 2
action_items: 5
processed: true
promoted_to:
  - canonical/knowledge/lessons-learned.md (insight about distribution)
---
```

---

## 🚫 Anti-patterns: What NOT to Do

### ❌ Prompt-Stuffing
**Bad:** "Here's every file in the repo, now answer my question"
**Good:** "I need to answer a question about revenue model. Loading: strategy/business-model.md, monetization/README.md, decision-log regarding pricing."

### ❌ Orphaned Information
**Bad:** Creating insights in meeting notes that never get promoted to CANONICAL
**Good:** Within 48h, extract insights and update the living knowledge base

### ❌ Bypassing Review
**Bad:** Directly editing CANONICAL because "it's just a small typo"
**Good:** Even typos go through proposed changes (can be fast-tracked, but visible)

### ❌ Deleting CANONICAL History
**Bad:** Replacing old content in CANONICAL files completely
**Good:** Move old content to "## Change History" section at bottom with strikethrough, timestamp, and reason

### ❌ Polluting Canonical with Speculation
**Bad:** "We might expand to Germany next year" in strategy/expansion-thesis.md
**Good:** Speculation stays in SCRATCHPAD/explorations/ until it becomes a decision

### ❌ Dead Links
**Bad:** Referencing "See Q3-brief.md" without specifying location
**Good:** "See 02_ARTIFACTS/briefs/Q3-campaign-brief.md" (full path)

### ❌ Stale Canonical
**Bad:** Let strategy docs age without review markers
**Good:** Regular staleness sweeps, update "last_reviewed" dates, open issues when docs are >90 days old

### ❌ Mixing Concerns
**Bad:** Putting meeting notes in ARTIFACTS
**Good:** Meeting notes in MEETINGS/, distilled insights to CANONICAL, deliverables to ARTIFACTS

### ❌ Ephemeral Truth
**Bad:** Answering questions from memory/inference without citing sources
**Good:** Every claim cites either CANONICAL docs or external verified sources

### ❌ Context Leak
**Bad:** Copying entire sensitive discussions into AI context
**Good:** Summarize, anonymize if needed, check against policy/PII linting rules

---

## 🔍 Staleness Detection & Context Hygiene

### Weekly Staleness Sweep

Every Monday, check:

```markdown
[ ] Any CANONICAL doc with last_reviewed >90 days old?
    → Open issue: "Review needed: {doc-name}"
[ ] Any INBOX items >7 days old?
    → Process or archive
[ ] Any SCRATCHPAD drafts >30 days old?
    → Finalize, archive, or delete
[ ] Any WORKSTREAM README not updated in >14 days?
    → Ping owner for status update
[ ] Any DECISION_LOG entries missing outcomes?
    → Follow up on implementation
```

### Freshness Markers

Documents can include:
```yaml
freshness: evergreen    # Timeless principles
freshness: quarterly    # Review every 3 months
freshness: monthly      # Review every 30 days
freshness: campaign     # Valid for specific campaign only
```

---

## 🎭 Role-Based Behavior Patterns

### When Acting as "Chief of Staff"
**Context Load:**
- All CANONICAL
- Recent MEETINGS (last week)
- Active WORKSTREAMS
- Pending INBOX items

**Behavior:**
- After meetings: draft follow-ups, update decision log, synthesize insights
- Daily: process inbox, flag stale items, maintain backlog
- Weekly: staleness sweep, prepare brief for next week
- Always: maintain single source of truth

### When Acting as "Strategic Advisor"
**Context Load:**
- CANONICAL/strategy (all)
- CANONICAL/knowledge/lessons-learned.md
- DECISION_LOG (recent 10)
- Relevant ARCHIVE for historical context

**Behavior:**
- Challenge assumptions with data from lessons learned
- Propose strategic pivots as formal PRs to CANONICAL
- Connect dots across workstreams
- Flag contradictions between stated strategy and decisions

### When Acting as "Content Creator"
**Context Load:**
- CANONICAL/brand (all)
- Writing style guide
- Example ARTIFACTS of same type
- Relevant strategy docs

**Behavior:**
- Draft in SCRATCHPAD
- Iterate with human
- Only promote to ARTIFACTS when approved
- Maintain brand voice consistency

### When Acting as "Research Analyst"
**Context Load:**
- Specific question scope
- Relevant CANONICAL sections
- Related DECISION_LOG entries
- External sources (web search as needed)

**Behavior:**
- Cite every claim with source
- Distinguish fact from inference
- Propose CANONICAL updates when research reveals gaps
- Save research notes to SCRATCHPAD, publish findings to ARTIFACTS

---

## 🛠️ Common Workflows & Examples

### Example 1: Processing a Stakeholder Email

**Scenario:** Pierre Laurent emails challenging the expansion strategy.

```
1. Save to: 05_INBOX/_from-email/2025-10-24-pierre-expansion-questions.md
   
2. Analyze:
   - Load: 00_CANONICAL/strategy/expansion-thesis.md
   - Load: 00_CANONICAL/knowledge/stakeholder-map.md (Pierre's context)
   - Load: 03_DECISION_LOG/ (any expansion decisions)
   
3. Draft Response:
   - Create: 06_SCRATCHPAD/drafts/response-to-pierre-expansion.md
   - Address each question
   - Cite relevant strategy docs
   - Acknowledge gaps if they exist
   
4. Identify Insights:
   - Pierre's questions reveal gap in expansion thesis
   - Create: 06_SCRATCHPAD/proposed-changes/expansion-thesis-update.md
   - Present to Ivan for review
   
5. After Approval:
   - Finalize email in: 02_ARTIFACTS/emails/2025-10-24-pierre-expansion-response.md
   - Merge expansion thesis update to: 00_CANONICAL/strategy/expansion-thesis.md
   - Log decision in: 03_DECISION_LOG/2025-Q4/003-expansion-thesis-revision.md
   - Archive inbox item
```

### Example 2: Preparing Weekly Sync Brief

**Scenario:** Monday morning, need brief for today's team meeting.

```
1. Assemble Context:
   - Load: 01_WORKSTREAMS/*/README.md (all workstream statuses)
   - Load: 03_DECISION_LOG/2025-Q4/ (recent decisions)
   - Load: 04_MEETINGS/weekly-sync/ (last meeting's action items)
   
2. Draft Brief:
   - Create: 06_SCRATCHPAD/drafts/weekly-brief-2025-10-24.md
   - Sections: Progress since last week, Blockers, Decisions needed, Next actions
   
3. Review & Finalize:
   - Human reviews
   - Move to: 02_ARTIFACTS/briefs/weekly-brief-2025-10-24.md
   
4. After Meeting:
   - Capture notes in: 04_MEETINGS/weekly-sync/2025-10-24-sync.md
   - Within 48h: Extract decisions → DECISION_LOG
   - Within 48h: Extract insights → update relevant CANONICAL docs
```

### Example 3: Campaign Retrospective

**Scenario:** Campaign 2 complete, need to learn from it.

```
1. Gather Data:
   - Load: Campaign 2 results (wherever stored)
   - Load: 07_ARCHIVE/campaigns/campaign-1-retrospective.md (for comparison)
   - Load: 00_CANONICAL/knowledge/lessons-learned.md (current learnings)
   
2. Analyze:
   - Create: 06_SCRATCHPAD/analysis/campaign-2-vs-1.md
   - What worked? What didn't? Why?
   - Key insight: Distribution problem, not tech problem
   
3. Document:
   - Create: 07_ARCHIVE/campaigns/campaign-2-retrospective.md (full detail)
   - Update: 00_CANONICAL/knowledge/lessons-learned.md (distilled wisdom)
   - Create: 03_DECISION_LOG/2025-Q4/002-campaign-2-analysis.md (strategic implications)
   
4. Propagate Learning:
   - Update: 01_WORKSTREAMS/scale-refine/README.md (shift priorities)
   - Update: 00_CANONICAL/strategy/business-model.md (if model changes)
```

---

## 🎓 For Future AI Agents: Quick Start

**When you first load this repository:**

1. Read START-HERE.md for essential onboarding
2. Read this file (KNOWLEDGE-SYSTEM.md) completely
3. Read README.md for project navigation
4. Load 08_SYSTEM/.ai-instructions/project-context.md (if exists)
5. Load 00_CANONICAL/knowledge/stakeholder-map.md
6. Check 05_INBOX/ for pending items
7. Check latest 04_MEETINGS/weekly-sync/ for recent context

**When given a task:**

1. Classify the task type (question, deliverable, update, research)
2. Use the decision tree to determine relevant context
3. Load ONLY the files you need (token budget discipline)
4. Work in SCRATCHPAD if drafting
5. Cite sources for every claim
6. Propose changes to CANONICAL, never edit directly
7. **CRITICAL:** When updating CANONICAL, use change history format (old content moves to bottom with strikethrough)
8. Request human review at appropriate gates

**When uncertain:**

- Check 08_SYSTEM/workflows/ for guidance
- Ask for human clarification
- Default to more review rather than less
- Document your uncertainty in SCRATCHPAD
- Never guess about important facts—cite or search

---

## 🔐 Security & Privacy Notes

**What to avoid in this repo:**
- No passwords, API keys, or credentials
- No sensitive personal data (beyond professional context)
- No unredacted financial figures unless approved
- No confidential board discussions without explicit permission

**Before writing anything:**
- Check: Is this information meant to be shared with AI?
- Check: Could this harm someone if leaked?
- Check: Is there a less sensitive way to capture this?

**If you encounter sensitive info:**
1. Summarize the essential business logic without sensitive details
2. Store sensitive originals outside the repo
3. Reference: "See secure vault: {identifier}"
4. Mark document as: `sensitivity: confidential` in YAML

---

## 📚 Quick Reference Card

| I need to... | Go to... | Remember... |
|-------------|----------|-------------|
| Understand strategy | 00_CANONICAL/strategy/ | Single source of truth |
| Know the team | 00_CANONICAL/operations/ | Who does what |
| See what we learned | 00_CANONICAL/knowledge/ | Evolving wisdom |
| Check current work | 01_WORKSTREAMS/ | Active focus areas |
| Find past deliverable | 02_ARTIFACTS/ | Organized by type |
| Understand a decision | 03_DECISION_LOG/ | Immutable audit trail |
| Review meeting notes | 04_MEETINGS/ | Raw captures |
| Process external input | 05_INBOX/ | Staging area, process within 7 days |
| Draft something | 06_SCRATCHPAD/ | Ephemeral, not truth |
| Look at history | 07_ARCHIVE/ | Read-only reference |
| Learn workflows | 08_SYSTEM/workflows/ | How we work |
| Use templates | 08_SYSTEM/templates/ | Starting points |

---

## 🚀 Evolution of This System

**This document itself is canonical** and follows its own rules:
- Version history tracked in YAML
- Changes require human approval
- Improvements welcomed via proposed changes

**As Re-New evolves, this system evolves:**
- New patterns emerge → document in workflows
- New file types → add to decision tree
- New integrations → update connector guidelines
- Lessons from using this → update anti-patterns

---

## ✨ The Goal

By following these principles, we create a repository that:
- Gets smarter over time (every task improves the corpus)
- Maintains single source of truth (no contradictions)
- Enables effective delegation (AI knows where to look)
- Preserves institutional memory (nothing is lost)
- Operates transparently (everything is traceable)
- Scales with the business (patterns, not one-offs)

**This isn't just files and folders. It's a business operating system.**

---

*Last updated: 2025-10-24 by Ivan Paudice*  
*Next review: 2025-11-24 (monthly cycle)*  
*Feedback: Propose changes via SCRATCHPAD → review process*
