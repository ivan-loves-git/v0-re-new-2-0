# Quick Import Guide - Meeting Transcripts & Updates

**For:** Anyone who needs to incorporate meeting transcripts or project updates into the repository
**Time:** 2 min read | 15-30 min to execute

---

## 🚀 One-Sentence Summary
When you have a meeting transcript or project update → Follow the [5-step workflow](workflows/IMPORT-MEETING-TRANSCRIPT.md) to distribute knowledge across the repository.

---

## 📋 The Process (Quick Version)

```
Meeting Transcript
      ↓
[1] Create Meeting Notes → 04_MEETINGS/[type]/YYYY-MM-DD-[title].md
      ↓
[2] Extract Decisions → 03_DECISION_LOG/YYYY-QX/DEC-YYYYMMDD-[slug].md (if strategic)
      ↓
[3] Update CANONICAL → 00_CANONICAL/[area]/ (with change history!)
      ↓
[4] Update Workstreams → 01_WORKSTREAMS/[stream]/STATUS.md
      ↓
[5] Track Action Items → In relevant workstream files
```

---

## ⚡ Quick Decision Tree

**"I just received a meeting transcript. What do I do?"**

```
START: Do I have a meeting transcript or project update?
  ↓
  YES → Read full transcript
  ↓
  Were any STRATEGIC decisions made?
  ├─ YES → Create meeting notes [Step 1] + Decision logs [Step 2]
  └─ NO → Just create meeting notes [Step 1]
  ↓
  Does anything change our strategy/direction?
  ├─ YES → Update CANONICAL files [Step 3] (with change history!)
  └─ NO → Skip Step 3
  ↓
  Are there workstream progress updates?
  ├─ YES → Update workstream STATUS [Step 4]
  └─ NO → Skip Step 4
  ↓
  Are there action items with owners?
  ├─ YES → Track in workstreams [Step 5]
  └─ NO → Skip Step 5
  ↓
  DONE ✅
```

---

## 📂 File Locations Cheat Sheet

| Content Type | Goes In | Filename Format | Always? |
|--------------|---------|-----------------|---------|
| Meeting notes | `04_MEETINGS/[type]/` | `YYYY-MM-DD-[title].md` | ✅ YES |
| Strategic decisions | `03_DECISION_LOG/YYYY-QX/` | `DEC-YYYYMMDD-[slug].md` | ⚠️ Only if strategic |
| Strategy changes | `00_CANONICAL/strategy/` | `[existing-file].md` | ⚠️ Only if strategy changed |
| Team changes | `00_CANONICAL/operations/` | `[existing-file].md` | ⚠️ Only if ops changed |
| Lessons learned | `00_CANONICAL/knowledge/` | `lessons-learned.md` | ⚠️ Only if we learned something |
| Workstream updates | `01_WORKSTREAMS/[stream]/` | `STATUS.md` or `ROADMAP.md` | ⚠️ Only if progress made |

---

## 🎯 What Counts as "Strategic"?

**Log in DECISION_LOG if it involves:**
- ✅ Pivot or direction change (e.g., "expand to family business not just Italy")
- ✅ Resource allocation (e.g., "hire 2 more people")
- ✅ Scope changes (e.g., "ICP now includes X")
- ✅ Process changes (e.g., "switch from Notion to Y")
- ✅ Major commitments (e.g., "partner with Company X")

**Don't log if it's just:**
- ❌ Scheduling (e.g., "meet every Monday at 7pm") → Just meeting notes
- ❌ Task assignment (e.g., "Ivan will demo platform") → Just action items
- ❌ Status updates (e.g., "we got 50 CVs") → Just workstream STATUS
- ❌ General discussion (e.g., "talked about Italy") → Just meeting notes

---

## ⚠️ CRITICAL: Change History in CANONICAL

**When updating files in `00_CANONICAL/`:**

❌ **NEVER do this:**
```markdown
## Expansion Strategy
We will expand to Italy in Q1 2026.
↓ [Delete old, write new]
We will explore multiple opportunities.
```

✅ **ALWAYS do this:**
```markdown
## Expansion Strategy (Updated)
We will explore multiple opportunities...

---
## Change History

### Expansion Strategy (Previous - 2025-10-24)
~~We will expand to Italy in Q1 2026.~~

**Changed:** 2025-10-24
**Reason:** [Why we changed]
**Source:** [Link to meeting]
```

---

## 🤖 For AI Agents

**Prompt to use:**
```
I have a meeting transcript to import. Please:

1. Analyze it following 08_SYSTEM/workflows/IMPORT-MEETING-TRANSCRIPT.md
2. Tell me what files you'll create (don't create yet!)
3. Show me which CANONICAL files need change history
4. Wait for my approval
5. Then create all files

Use templates from 08_SYSTEM/templates/
```

---

## 📚 Full Documentation

- **Complete workflow:** [workflows/IMPORT-MEETING-TRANSCRIPT.md](workflows/IMPORT-MEETING-TRANSCRIPT.md)
- **Meeting notes template:** [templates/meeting-notes-template.md](templates/meeting-notes-template.md)
- **Decision log template:** [templates/decision-log-template.md](templates/decision-log-template.md)
- **System overview:** [KNOWLEDGE-SYSTEM.md](../KNOWLEDGE-SYSTEM.md)

---

## ✅ Quality Checklist (30 seconds)

Before you're done:
- [ ] Meeting notes created with all attendees listed
- [ ] Strategic decisions logged (if any)
- [ ] CANONICAL updates use change history format (if any)
- [ ] Action items have @owner and due dates
- [ ] All files cross-reference each other (links!)

---

## 💡 Pro Tips

1. **Start with meeting notes first** - Get the full context captured before extracting
2. **When in doubt, draft in SCRATCHPAD** - You can always move it later
3. **Strategic decisions are rare** - Don't over-log; most meetings = just notes + action items
4. **Change history is your friend** - Shows your thinking evolved, not that you were wrong
5. **Link everything** - Meeting → Decision → CANONICAL → Workstream (creates knowledge graph)

---

## 🆘 Common Questions

**Q: Do I need to fill out EVERY section of the templates?**
A: No! Templates are maximum structure. Fill what's relevant, delete empty sections.

**Q: What if I'm not sure if something is strategic enough?**
A: Ask: "Will this matter in 3 months?" YES → decision log. NO → just meeting notes.

**Q: Can I skip the change history format?**
A: No. For `00_CANONICAL/` files, change history is MANDATORY. It's how we track learning.

**Q: How long should this take?**
A: 10-15 min for simple meeting (notes + action items), 30 min for strategic meeting (all steps).

**Q: What if the meeting was messy/unstructured?**
A: Extract what you can. Better to have imperfect notes than no notes.

---

**Ready to import your first meeting?** → Start here: [IMPORT-MEETING-TRANSCRIPT.md](workflows/IMPORT-MEETING-TRANSCRIPT.md) 🚀
