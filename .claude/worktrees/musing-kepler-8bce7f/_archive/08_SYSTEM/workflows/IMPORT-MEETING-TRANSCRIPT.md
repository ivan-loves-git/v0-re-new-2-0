# Meeting/Update Import Workflow

**Purpose:** Standard process for integrating meeting transcripts, project updates, and external content into the Re-New knowledge repository.

**When to use:** Whenever you have meeting transcripts, Slack dumps, email threads, or any external project updates that need to be incorporated into the repository.

---

## 🎯 Quick Start

**Input:** Raw meeting transcript or project update
**Output:** Structured knowledge across 4-5 repository locations
**Time:** 15-30 minutes (depending on meeting length)

---

## 📋 The 5-Step Import Process

### Step 1: Create Meeting Notes (REQUIRED)
**Location:** `04_MEETINGS/[meeting-type]/YYYY-MM-DD-[title].md`

**Meeting types:**
- `weekly-sync/` - Regular team meetings
- `stakeholder-check-ins/` - Meetings with Bertrand, Francesco, tutors
- `tutor-sessions/` - Academic supervision meetings

**Required content:**
```markdown
# [Meeting Title] - YYYY-MM-DD

**Date:** YYYY-MM-DD
**Time:** HH:MM - HH:MM [Timezone]
**Type:** [Weekly Sync / Stakeholder Check-in / Tutor Session]
**Attendees:** [List all participants]
**Absent:** [Anyone who missed]

---

## 📌 Quick Summary
[2-3 sentence overview of meeting purpose and key outcomes]

---

## 🎯 Key Decisions Made
- [ ] **Decision 1:** [Brief description] → [Where logged]
- [ ] **Decision 2:** [Brief description] → [Where logged]

---

## ✅ Action Items
- [ ] **@Person:** [Action] - Due: [Date] - Status: [Pending/Done]
- [ ] **@Person:** [Action] - Due: [Date] - Status: [Pending/Done]

---

## 📊 Workstream Updates

### Scale & Refine (Nacho, Ivan)
[Status update from meeting]

### Monetization (Alex)
[Status update from meeting]

### Expansion (Piera, Gabriele)
[Status update from meeting]

---

## 💬 Discussion Notes

### [Topic 1]
[Detailed notes]

### [Topic 2]
[Detailed notes]

---

## 📎 Links & References
- [Link to slides/docs discussed]
- [Related decision logs]
- [Follow-up meeting scheduled]

---

## 🔄 Follow-Up Required
- [ ] [What needs to happen next]
- [ ] [Who needs to be informed]
```

---

### Step 2: Extract & Log Decisions (IF ANY STRATEGIC DECISIONS)
**Location:** `03_DECISION_LOG/YYYY-QX/DEC-YYYYMMDD-[slug].md`

**Log decisions if they involve:**
- Strategy changes (pivot, new direction)
- Resource allocation (budget, time, people)
- Scope changes (what's in/out of ICP)
- Process changes (how we work)
- Tool/platform choices

**Template:**
```markdown
# DEC-YYYYMMDD: [Decision Title]

**Date:** YYYY-MM-DD
**Deciders:** [Who participated in decision]
**Status:** ✅ Decided | 🔄 Pending Validation | ⚠️ Needs Revision

---

## 🎯 Decision

[Clear, one-paragraph statement of what was decided]

---

## 🤔 Context

**Problem:**
[What problem are we solving?]

**Options Considered:**
1. **Option A:** [Description] - Pros: [...] - Cons: [...]
2. **Option B:** [Description] - Pros: [...] - Cons: [...]
3. **Option C (Chosen):** [Description] - Pros: [...] - Cons: [...]

**Why we chose Option C:**
[Rationale]

---

## 📊 Impact

**Affects:**
- Workstream: [Which workstream(s)]
- Timeline: [Does this change timeline?]
- Resources: [Does this require new resources?]

**Stakeholders informed:**
- [ ] Bertrand (founder)
- [ ] Francesco (academic)
- [ ] Team members

---

## ✅ Implementation

**Next steps:**
- [ ] [Action 1] - @Owner - Due: [Date]
- [ ] [Action 2] - @Owner - Due: [Date]

**Success criteria:**
- [How will we know this decision worked?]

---

**Source:** [Link to meeting notes]
```

---

### Step 3: Update CANONICAL Files (IF STRATEGIC CHANGES)
**Location:** `00_CANONICAL/[strategy|operations|brand|knowledge]/`

**Update CANONICAL if meeting revealed:**
- Change in strategic direction
- New market/customer insights
- Change in team structure/roles
- New competitive intelligence
- Lessons learned (failures or wins)

**⚠️ CRITICAL:** Use change history format (see START-HERE.md)

**Process:**
1. Identify which CANONICAL file(s) need updating
2. Add new content at TOP of relevant section
3. Move old content to BOTTOM under `## Change History`
4. Strike through old content with `~~strikethrough~~`
5. Add timestamp and reason

**Example:**
```markdown
## Expansion Strategy (Updated)

We will explore multiple expansion opportunities including:
- Geographic expansion (Italy, other EU markets)
- Vertical expansion (family business succession)
- Partnership models (validation before launch)

**Approach:** Research and validate before commit (Q4 2025)

---

## Change History

### Expansion Strategy (Previous - 2025-10-24)
~~We will focus exclusively on expanding Re-New to Italy as the next market, launching operations in Q1 2026.~~

**Changed:** 2025-10-24
**Reason:** Feedback from Pierlorang (investor/board) - French operations not stable enough for geographic expansion. Need to validate business model first and explore multiple opportunities (family business, etc.) before committing to international expansion.
**Source:** [Weekly sync 2025-10-24](../../04_MEETINGS/weekly-sync/2025-10-24-weekly-sync.md)
```

---

### Step 4: Update Workstreams (IF PROGRESS UPDATES)
**Location:** `01_WORKSTREAMS/[workstream-name]/STATUS.md`

**Update if meeting included:**
- Progress on active tasks
- Blockers or risks
- Milestones achieved
- Timeline changes

**What to update:**
- Current status
- Recent wins
- Next milestones
- Risks/blockers

---

### Step 5: Process Action Items (REQUIRED IF ACTION ITEMS EXIST)
**Location:** `01_WORKSTREAMS/[relevant-workstream]/` or individual owner tracking

**For each action item:**
1. Identify owner
2. Set due date
3. Link to source (meeting notes)
4. Track in appropriate workstream
5. Add to weekly sync agenda for follow-up

**Tracking format:**
```markdown
## Action Items from [Meeting Date]

- [ ] **@Ivan:** Demo AI platform progress (15 min presentation) - Due: Next weekly sync - [Source](../04_MEETINGS/weekly-sync/2025-10-24.md)
- [ ] **@Alex:** Schedule tutor meeting with Martin Kuh - Due: 2025-10-27 - [Source](../04_MEETINGS/weekly-sync/2025-10-24.md)
- [ ] **@Piera, @Gabriele, @Alex:** Expansion strategy brainstorm meeting - Due: 2025-10-26 - [Source](../04_MEETINGS/weekly-sync/2025-10-24.md)
```

---

## 🤖 AI Agent Instructions

When an AI agent receives a meeting transcript or project update:

### Phase 1: Analyze (DO NOT WRITE YET)
1. Read the full transcript
2. Identify meeting type and attendees
3. Flag strategic decisions (anything affecting scope, direction, resources)
4. Identify action items with owners
5. Note any insights that update CANONICAL knowledge

### Phase 2: Propose Structure
Present to human:
```
I've analyzed the [meeting/update]. Here's what I found:

📝 Meeting Notes: Will create in 04_MEETINGS/[type]/YYYY-MM-DD-[title].md
   - X attendees, Y topics, Z action items

🎯 Decisions to Log: [X decisions found]
   1. [Decision 1 title] → 03_DECISION_LOG/
   2. [Decision 2 title] → 03_DECISION_LOG/

📚 CANONICAL Updates: [X files need updating]
   1. [File 1] - [What changed] - Uses change history ✓
   2. [File 2] - [What changed] - Uses change history ✓

🏗️ Workstream Updates: [X workstreams affected]
   - [Workstream 1]: [Status change]
   - [Workstream 2]: [Status change]

✅ Action Items: [X items assigned]
   - @Person1: [Item]
   - @Person2: [Item]

Shall I proceed with creating these files?
```

### Phase 3: Execute (ONLY AFTER HUMAN APPROVAL)
1. Create meeting notes (Step 1)
2. Create decision logs (Step 2)
3. Update CANONICAL with change history (Step 3)
4. Update workstreams (Step 4)
5. Track action items (Step 5)

### Phase 4: Verify & Link
1. Ensure all files cross-reference each other
2. Verify change history format in CANONICAL
3. Confirm all action items have owners and dates
4. Update any relevant indexes or dashboards

---

## ✅ Quality Checklist

Before considering import complete:

**Meeting Notes:**
- [ ] Saved in correct folder with standard naming
- [ ] All attendees listed
- [ ] Quick summary present
- [ ] Action items identified with owners
- [ ] Links to related decision logs

**Decision Logs:**
- [ ] Only strategic decisions logged (not tactical)
- [ ] Clear decision statement
- [ ] Context and rationale included
- [ ] Impact analysis done
- [ ] Implementation steps identified

**CANONICAL Updates:**
- [ ] Change history format used (NEW at top, OLD at bottom with strikethrough)
- [ ] Timestamp and reason provided
- [ ] Source meeting linked
- [ ] No old content deleted (just moved to history)

**Workstream Updates:**
- [ ] Progress clearly stated
- [ ] Blockers identified
- [ ] Next milestones updated
- [ ] Links to source meeting

**Action Items:**
- [ ] Each has clear owner (@Person)
- [ ] Each has due date
- [ ] Source meeting linked
- [ ] Added to relevant workstream tracking

---

## 🎓 Examples

### Example 1: Weekly Sync with Strategic Decisions
**Input:** Meeting transcript discussing team structure change
**Output:**
- ✅ Meeting notes in `04_MEETINGS/weekly-sync/2025-10-24-team-restructure.md`
- ✅ Decision log in `03_DECISION_LOG/2025-Q4/DEC-20251024-team-structure-v2.md`
- ✅ Updated `00_CANONICAL/operations/team-structure.md` (with change history)
- ✅ Updated all 3 workstream STATUS.md files
- ✅ 5 action items tracked

### Example 2: Stakeholder Check-in (Informational Only)
**Input:** Update call with Bertrand on campaign progress
**Output:**
- ✅ Meeting notes in `04_MEETINGS/stakeholder-check-ins/2025-10-20-bertrand-campaign-update.md`
- ✅ Updated `01_WORKSTREAMS/scale-refine/STATUS.md` with campaign metrics
- ❌ No decision logs (informational only)
- ❌ No CANONICAL updates (no strategic changes)
- ✅ 2 action items tracked (follow-up tasks)

### Example 3: Critical Pivot Decision
**Input:** Meeting where team decides to change expansion approach
**Output:**
- ✅ Meeting notes with detailed discussion
- ✅ Major decision log with full context
- ✅ Updated `00_CANONICAL/strategy/expansion-strategy.md` (with change history showing pivot)
- ✅ Updated `01_WORKSTREAMS/expansion/STATUS.md` and `ROADMAP.md`
- ✅ Created `00_CANONICAL/knowledge/lessons-learned.md` entry (why we pivoted)
- ✅ 8 action items assigned across team

---

## 🚫 Common Mistakes to Avoid

1. **Skipping change history in CANONICAL**
   - ❌ Directly overwriting old content
   - ✅ Moving old to bottom with strikethrough + reason

2. **Logging everything as a "decision"**
   - ❌ "We decided to meet next Monday" (tactical)
   - ✅ "We decided to pivot expansion strategy from Italy-only to multi-opportunity exploration" (strategic)

3. **Creating orphaned documents**
   - ❌ Decision log that doesn't link to meeting notes
   - ✅ All documents cross-reference each other

4. **Vague action items**
   - ❌ "Someone should look into Italy expansion"
   - ✅ "@Piera: Research 3 Italian ETA competitors - Due: 2025-11-01"

5. **Forgetting to update workstreams**
   - ❌ Only capturing in meeting notes
   - ✅ Propagating relevant updates to workstream STATUS files

---

## 🔄 Maintenance

**Weekly:**
- Review all action items from past week's meetings
- Check if decisions led to expected outcomes
- Update workstream STATUS files

**Monthly:**
- Review CANONICAL change history (are we learning?)
- Archive completed action items
- Update meeting templates if patterns emerge

---

## 📞 Questions?

**"Do I really need to do ALL 5 steps for every meeting?"**
No. Follow this logic:
- Step 1 (Meeting Notes): ALWAYS
- Step 2 (Decision Logs): Only for strategic decisions
- Step 3 (CANONICAL): Only when strategy/knowledge changes
- Step 4 (Workstreams): Only when progress updates exist
- Step 5 (Action Items): Only when action items were assigned

**"How do I know if something is 'strategic' enough for a decision log?"**
Ask: "Will this matter in 3 months?" If yes → log it. If no → just meeting notes.

**"What if I'm not sure where something goes?"**
Draft in `06_SCRATCHPAD/` first, then ask the team in next sync.

**"Can AI agents do this automatically?"**
They can draft, but human must review before committing to CANONICAL or DECISION_LOG.

---

**This workflow ensures every meeting creates lasting knowledge, not just ephemeral notes.** 🚀
