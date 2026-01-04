---
decision_id: 001
title: "Strategic Framing Integration into CANONICAL Knowledge Base"
date: 2025-10-24
participants: [Ivan Paudice]
outcome: "Integrated comprehensive strategic framing document into CANONICAL structure"
status: implemented
impact: high
related_workstreams: [all]
sources:
  - Strategic Framing Document v2.0
  - 06_SCRATCHPAD/proposed-changes/REVIEW-SUMMARY.md
---

# Decision 001: Strategic Framing Integration

## Context

Re-New 2.0 had a comprehensive strategic framing document that combined insights from the 1.0 briefing, provided documentation, and startup execution experience. This document included:

- Summary and TL;DR
- Strategic foundations
- Core assumptions to validate
- Partner network architecture (French & Italian)

The document existed as a standalone file but needed to be integrated into the Re-New knowledge system architecture for better accessibility, maintainability, and AI agent utilization.

## Decision

**Approved:** Integration of all strategic content into CANONICAL files following the knowledge system architecture.

**Approach:**
1. Distribute content across appropriate CANONICAL locations by function
2. Create new file for validation assumptions (previously uncaptured)
3. Preserve original document in archive for historical reference
4. Follow proper YAML front-matter standards with provenance tracking

## Implementation

### Files Created/Updated

**Strategy files (00_CANONICAL/strategy/):**
1. **value-proposition.md** - Problem, purpose, USP, target customers, competitive positioning
2. **business-model.md** - Hypothesis stage, revenue models, unit economics, go-to-market strategy
3. **expansion-thesis.md** - Italian opportunity, dual-path approach, decision framework
4. **validation-assumptions.md** (NEW) - 6 core assumptions with validation frameworks and roadmap

**Knowledge files (00_CANONICAL/knowledge/):**
5. **stakeholder-map.md** - French & Italian partner networks, criticality matrix, activation playbook

**Operations files (00_CANONICAL/operations/):**
6. **team-structure.md** - Team assessment, roles, commitment framework, governance

### Key Features

All integrated files include:
- ✅ Proper YAML front-matter with source attribution
- ✅ Cross-references to related canonical documents
- ✅ Actionable checklists and clear next steps
- ✅ Decision frameworks with success criteria
- ✅ Status tracking for assumptions and initiatives
- ✅ Clear ownership assignments

### Archive

Original document preserved as:
```
07_ARCHIVE/strategic-docs/strategic-framing-v1.0-2025-10-24.md
```

## Rationale

**Why integrate vs. keep standalone:**
1. **Discoverability:** Content findable by function (strategy, operations, knowledge)
2. **Maintainability:** Easier to update specific sections as validation progresses
3. **Cross-referencing:** Enables linking between related concepts
4. **AI agent utilization:** Follows task-scoped context loading patterns
5. **Knowledge system compliance:** Aligns with CANONICAL architecture and review gates

**Why create validation-assumptions.md:**
- Core assumptions are foundational to all other strategic work
- Deserves dedicated focus and regular review
- Provides clear validation roadmap for Q4 2025 - Q2 2026
- Not naturally part of business model or value proposition docs

## Impact

**High impact** across all workstreams:

**Immediate benefits:**
- ✅ Single source of truth for Re-New strategy now documented
- ✅ Clear validation framework for next 6 months
- ✅ Team alignment tool (especially for commitment clarity)
- ✅ Partner network mapped for both French depth and Italian pilot

**Future benefits:**
- 📈 Easier onboarding for new team members
- 📈 Foundation for fundraising materials
- 📈 Framework for quarterly strategic reviews
- 📈 Template for geographic expansion beyond Italy

## Next Actions

1. **Immediate:**
   - [ ] Review all CANONICAL files with founding team
   - [ ] Schedule founder alignment exercise (per team-structure.md)
   - [ ] Begin Q4 2025 validation activities (per validation-assumptions.md)

2. **Q4 2025:**
   - [ ] Complete Cohort 1 retrospective (cost analysis, funnel mapping)
   - [ ] Execute Italian network mapping (Phase 0)
   - [ ] Conduct partner value perception research

3. **Ongoing:**
   - [ ] Update validation-assumptions.md status monthly
   - [ ] Review strategy docs quarterly
   - [ ] Add to stakeholder-map.md as partners are activated

## Related Documents

- **Source:** [07_ARCHIVE/strategic-docs/strategic-framing-v1.0-2025-10-24.md](../../07_ARCHIVE/strategic-docs/strategic-framing-v1.0-2025-10-24.md)
- **Proposal:** [06_SCRATCHPAD/proposed-changes/REVIEW-SUMMARY.md](../../06_SCRATCHPAD/proposed-changes/REVIEW-SUMMARY.md)
- **Strategy:** [00_CANONICAL/strategy/](../../00_CANONICAL/strategy/)
- **Knowledge:** [00_CANONICAL/knowledge/](../../00_CANONICAL/knowledge/)
- **Operations:** [00_CANONICAL/operations/](../../00_CANONICAL/operations/)

## Review & Approval

**Proposed:** 2025-10-24
**Reviewed by:** Ivan Paudice
**Approved:** 2025-10-24
**Implemented:** 2025-10-24

---

*This decision establishes the strategic foundation for Re-New 2.0 validation and scaling efforts.*
