# AI Recruitment Platform - Archive Index

**Status:** Historical reference - Platform built but not deployed
**Date Range:** Pre-October 2024
**Builder:** Ivan
**Reason for archiving:** Business model shifted; platform optimized for wrong bottleneck

---

## What's in This Archive

This folder contains complete documentation of Re-New's AI-powered recruitment platform, which was built to automate candidate screening but ultimately never deployed due to strategic pivot.

### Key Documents

1. **[platform-overview.md](platform-overview.md)** - Complete architecture and capabilities
   - 3-stage evaluation process (CV screening → Questionnaire → Assessment)
   - 8 AI bots for automated scoring
   - Cost tracking methodology
   - Email automation and personalization
   - Dashboard metrics and analytics
   - Why it wasn't deployed

2. **[cv-extraction-fields.md](cv-extraction-fields.md)** - Detailed scoring criteria
   - 8+ fields extracted from CVs
   - Scoring logic for each dimension
   - Thresholds and weights
   - AI bot architecture
   - Stage 2 questionnaire fields

3. **[cost-tracking-methodology.md](cost-tracking-methodology.md)** - Financial tracking system
   - Cost-per-candidate calculation
   - Team member hourly rates
   - Assessment cost tracking
   - Dashboard metrics
   - Application to CRM model

---

## Why This Archive Exists

### The Platform Was Built But Not Used

**Original problem:** Expected high volume of candidate applications, need fast screening
**Reality:** Moderate volume, bottleneck shifted to relationship management
**Outcome:** Platform solved problem Re-New no longer had

### Value of Archiving (Not Deleting)

1. **Historical record** - Significant time invested, worth documenting
2. **Reusable concepts** - Some ideas remain valuable (cost tracking, two-step data collection, personalization)
3. **Learning artifact** - Building and NOT deploying taught strategic lessons
4. **Future reference** - If high-volume screening becomes relevant again, foundation exists
5. **Onboarding context** - New team members understand why Re-New chose current approach

---

## What Was Learned

See [CANONICAL/knowledge/lessons-learned.md](../../00_CANONICAL/knowledge/lessons-learned.md#ai-recruitment-platform-learnings-pre-campaign-2) for detailed insights.

### Top 10 Lessons

1. **Build for the business you have, not the business you imagine**
2. **Two-step data collection maximizes conversion**
3. **Cost-per-unit tracking enables strategic decisions**
4. **Personalization at scale builds credibility**
5. **Structured scoring forces strategic clarity**
6. **Tools shape thinking - choose carefully**
7. **Validate demand before building tools**
8. **Human override is non-negotiable (for Re-New's model)**
9. **Audit trails have long-term value**
10. **Conversion optimization ≠ business model validation**

---

## How This Relates to Current Process

### Campaign #2 Retained These Elements

| AI Platform Feature | Campaign #2 Implementation |
|---------------------|---------------------------|
| **Two-step data collection** | CV + application form → Stage 2 questionnaire for qualified candidates |
| **Structured scoring** | Simplified to 4 categories (Professional, Acquisition, Business, Personal) |
| **Personalized emails** | A/B/C list communication (tailored by candidate tier) |
| **Stage 2 questionnaire** | Follow-up questions after initial screening |
| **Cost awareness** | Manual time tracking (not automated, but conscious of unit economics) |

### Campaign #2 Changed These Elements

| AI Platform Approach | Campaign #2 Approach | Why Changed |
|---------------------|---------------------|-------------|
| **ATS (Applicant Tracking)** | CRM (Customer Relationship) | Not recruiting employees, managing entrepreneurs |
| **Automated CV screening** | Human review with AI assist | Relationship quality > throughput speed |
| **8+ granular fields** | 4 broad categories | Simpler, more flexible, easier to calibrate |
| **0-5 star rating** | A/B/C/D list assignment | Less quantitative, more qualitative judgment |
| **Selection focus** | Relationship focus | Re-New's value is ongoing support, not one-time selection |

---

## What's Reusable If Needed

### Concepts Worth Revisiting

**If Re-New hits high-volume screening challenge again:**
1. AI pre-scoring to triage applications (top 50 for human review)
2. Automated personalized emails (build credibility at scale)
3. Cost tracking dashboard (understand unit economics)
4. Structured criteria enforcement (consistency across reviewers)

**If Re-New builds CRM with advanced features:**
1. Activity cost tracking (port methodology to CRM activities)
2. Audit trail system (interview transcripts, interaction history)
3. Automated summarization (AI-generated relationship summaries)
4. Multi-stage progression tracking (lifecycle management)

### Technical Components

**Ivan's skills demonstrated in this project:**
- AI/LLM integration (8 bot architecture)
- Data extraction (CV parsing)
- Web scraping (LinkedIn photo lookup)
- Email automation
- Dashboard design
- Cost calculation logic
- Real-time updates

**If Re-New needs custom platform later, this proves capability.**

---

## Related Documentation

### In This Archive
- [platform-overview.md](platform-overview.md)
- [cv-extraction-fields.md](cv-extraction-fields.md)
- [cost-tracking-methodology.md](cost-tracking-methodology.md)

### Current Process (Campaign #2)
- [Scoring Framework](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-framework.md)
- [Scoring Fields Comparison](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-fields-comparison.md)
- [Interview Process](../../06_SCRATCHPAD/hr-recruitment-import/01-recruitment-process/interview-process-rounds.md)

### Strategic Context
- [Lessons Learned](../../00_CANONICAL/knowledge/lessons-learned.md)
- [ATS → CRM Pivot Decision](../../03_DECISION_LOG/2024-Q4/DEC-20241101-ats-to-crm-operational-pivot.md)
- [Campaign #2 Learnings](../../06_SCRATCHPAD/hr-recruitment-import/06-campaign-2-learnings/campaign-2-results.md)

### Source Material
- Meeting transcript: Ivan platform demonstration (Oct 2024)
- Available in SCRATCHPAD (original audio transcription)

---

## For Future Readers

### If You're New to Re-New

**What you need to know:**
- This platform was built before Campaign #2
- It represents early hypothesis about Re-New's business (high-volume candidate screening)
- Campaign #2 revealed actual business model (relationship management at scale)
- Platform wasn't deployed, but building it taught valuable strategic lessons
- Current approach (CRM-based) evolved from learning what this platform couldn't solve

### If You're Considering Building Similar Platform

**Read these first:**
1. Why it wasn't deployed (platform-overview.md)
2. Lessons learned (CANONICAL/knowledge/lessons-learned.md)
3. What Campaign #2 did differently (scoring-fields-comparison.md)

**Then ask:**
- Is high-volume screening our actual bottleneck today?
- Have we validated this problem manually first?
- Does this unlock revenue, or just operational efficiency?
- Can we test with minimal/manual version before building?

**Ivan's advice (from later meetings):**
> "Take 5-10 guys, package an offer, sell it to them. If someone buys, THEN build the dashboard."

Validate demand before building tools.

---

## Archive Maintenance

**Archived by:** Ivan
**Archive date:** 2025-10-25
**Last reviewed:** 2025-10-25
**Next review:** Only if high-volume screening becomes strategic priority

**Preservation rationale:**
- Historical record of significant work
- Learning artifact for team
- Technical reference if similar needs arise
- Demonstrates Re-New's evolution from selection to relationship model

**Do not delete:** Contains valuable context for understanding current strategy

---

## Quick Navigation

**Want to understand...**
- **What the platform did?** → [platform-overview.md](platform-overview.md)
- **How scoring worked?** → [cv-extraction-fields.md](cv-extraction-fields.md)
- **Cost tracking methodology?** → [cost-tracking-methodology.md](cost-tracking-methodology.md)
- **Why it wasn't used?** → [platform-overview.md](platform-overview.md#why-it-wasnt-deployed)
- **What was learned?** → [CANONICAL/knowledge/lessons-learned.md](../../00_CANONICAL/knowledge/lessons-learned.md#ai-recruitment-platform-learnings-pre-campaign-2)
- **How it compares to Campaign #2?** → [scoring-fields-comparison.md](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-fields-comparison.md)

---

**Last Updated:** 2025-10-25
