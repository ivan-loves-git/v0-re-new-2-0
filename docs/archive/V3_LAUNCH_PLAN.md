# Re-New Platform: V1.0 Launch Guide

**Following our January 18th alignment meeting**

---

## The Turning Point

On January 18th, 2026, we met to take stock of where we are and align on the path to launch. This document captures that moment and serves as our shared guide forward.

**The headline:** The platform is built. What remains is not technical work, but strategic decisions from the founders about how Re-New will present itself to the world through this tool.

---

## Where We Are

The Re-New Platform has reached 95% completion. All core systems work: candidate intake, scoring, pipeline management, email capabilities, document uploads, and the CRM dashboard. The technical foundation is solid.

What's missing is not code. It's content and decisions that only Bertrand and Amelie can provide: the exact questions to ask candidates, how to weight their answers, what journey stages to track, and how to communicate with them via email.

This is by design. The platform was built to be flexible. Now it needs to be configured with Re-New's specific choices.

---

## Where We're Going

**Target: February 3rd public launch of the intake questionnaire**

A candidate visits `app.re-new.team/intake`, completes the questionnaire, and enters the Re-New pipeline. The team sees them in the dashboard, reviews their score, and begins the relationship.

This is V1.0: a professional, branded entry point that replaces ad-hoc candidate collection and establishes Re-New's digital presence as a serious acquisition acceleration programme.

---

## The Critical Path

Everything flows from one decision chain:

```
Questionnaire Design  -->  Scoring Logic  -->  Journey Stages
     (what to ask)        (how to rank)      (how to track)
```

Once founders finalize the questionnaire, Ivan implements it. The scoring weights follow from the questions. The journey stages follow from how candidates progress. Each decision unlocks the next.

**Strategic guidance for questionnaire design:**

Every question you add creates friction. Friction loses candidates. The intake form should capture what you *need* to qualify someone, not everything you *might want* to know. Additional information can be gathered later through follow-up emails or during interviews. The platform supports progressive data collection.

Start lean. You can always add questions later based on what you learn from real candidates.

---

## Key Decisions for Founders

### 1. Questionnaire Content (Critical)

Review the current 17-question structure in the Notion template (end of document). Decide:
- Which questions to keep, modify, or remove
- What new questions to add (if any)
- How to handle Letter de Cadrage (conditional upload)

**Deliverable:** Completed Notion template by Wednesday, January 22nd

### 2. Journey Stage Names

The platform tracks candidates through stages. Current names may need adjustment to match how Re-New actually thinks about the candidate journey. Review and confirm stage names and milestone checkpoints.

**Design choice:** Milestones should be validated manually by a human (one click), not triggered automatically. Even for file uploads, human review prevents errors and maintains quality control.

### 3. Email Communication Style

When candidates submit the form, should the welcome email be:
- Formal and professional?
- Warm and personal?
- Brief and functional?

Provide a plain text draft. HTML formatting often triggers spam filters.

### 4. Custom Domain

Choose between:
- `v0-re-new-2-0.vercel.app/intake` (works now, free, looks temporary)
- `app.re-new.team/intake` (professional, requires DNS setup)

For the professional option, Bertrand provides DNS access, Ivan handles configuration.

---

## Operational Tracking

All tasks, deadlines, and progress are tracked in the **Re-New Platform Task Management** system:

**[Tasks Dashboard](/tasks)** - View and manage all go-live tasks

The document you're reading provides strategic context. The task system provides operational tracking. Use both.

---

## Timeline at a Glance

| Week | Focus |
|------|-------|
| Jan 20-22 | Founders finalize questionnaire |
| Jan 23-24 | Ivan implements, domain setup |
| Jan 27-31 | Testing, polish, Flatchr import |
| Feb 3 | **GO-LIVE** |

---

## After V1.0

Once the intake form is live and stable:

- **V1.5:** AI intelligence (automated scoring of uploaded documents, smart email drafts)
- **V2.0:** Intermediary portal (anonymous candidate views for M&A brokers)
- **V2.5:** Deal marketplace (sellers post deals, candidates browse and match)

These build on V1.0's foundation. First, we launch. Then, we expand.

---

## Reference: Questionnaire Template for Notion

Copy-paste into Notion. Mark each question as KEEP / MODIFY / REMOVE.

---

### BUCKET 1: BASIC DATA

| ID | Question | Type |
|----|----------|------|
| B1-1 | Prenom | text |
| B1-2 | Nom | text |
| B1-3 | Email | text |
| B1-4 | Telephone | text |

---

### BUCKET 2: PROFILE QUALITY

| ID | Question | Type | Scoring |
|----|----------|------|---------|
| Q1 | Statut professionnel actuel | dropdown | Sans emploi/Transition (10), Independant (7), Employe (5), Autre (3) |
| Q2 | Annees d'experience | dropdown | >20 (10), 16-20 (7.5), 11-15 (5), <10 (0) |
| Q3 | Secteurs d'experience | multi-select | 3+ secteurs (5), 1-2 (3) |
| Q4 | Experience M&A | yes/no | info only |
| Q5 | Taille d'equipe geree | dropdown | >50 (10), 20-50 (7.5), <10 (3), 11-20 (0) |
| Q6 | Implique dans transactions M&A | yes/no | Oui (10), Non (0) |
| Q7 | Details M&A | text | info only |
| Q8 | Postes de direction | multi-select | C-level (4-6), Division (4), Autres (2) |
| Q9 | Experience conseil d'administration | yes/no | Oui (10), Non (0) |

---

### BUCKET 3: READINESS

| ID | Question | Type | Scoring |
|----|----------|------|---------|
| Q10 | Parcours de reprise | multi-select | Financement defini (10), Recherche cibles/LDC (8), Formation (6), Premiers contacts (4), Recherche info (2) |
| Q11 | Secteurs cibles | multi-select | 3+ (5), 1-2 (2) |
| Q12 | Cibles identifiees | yes/no | Oui (10), Non (0) |
| Q13 | Details cibles | text | info only |
| Q14 | Capacite investissement | dropdown | >450K (10), 351-450K (8), 251-350K (6), 151-250K (4), <150K (2), A definir (0) |
| Q15 | Statut financement | dropdown | Boucle (3), En cours (1) |
| Q16 | Reseau/formation | multi-select | CRA (+4), CCI/Autres (+2), Aucune (0) |
| Q17 | Ouvert co-acquisition | yes/no | Oui (5), Non (0) |

---

### LETTER DE CADRAGE

| ID | Question | Condition |
|----|----------|-----------|
| LDC-1 | Avez-vous une Lettre de Cadrage? | Always |
| LDC-2 | Upload LDC | If LDC-1 = Oui (+10 points) |

---

**Scoring thresholds:** 70+ (5 stars), 55-69 (4), 40-54 (3), 30-39 (2), <30 (1 star)

---

*This document marks our alignment after January 18th. Tasks are tracked in the platform. Strategy is captured here.*

**Last updated:** January 18, 2026
