# Re-New Platform V1.0 Launch Recap & Roadmap (V2)

**Purpose:** Synthesized summary for Bertrand & Amelie based on the Jan 18 meeting and current project status.
**Date:** January 18, 2026 (Updated: Jan 18, 2026)
**Author:** Ivan (Platform Lead)

---

## RE-NEW CONTEXT

**Main Website:** https://re-new.team
**Platform (In Development):** app.re-new.team (to be configured)
**GitHub Repo:** ivan-loves-git/v0-re-new-2-0
**Current Vercel URL:** v0-re-new-2-0.vercel.app

**What Re-New Does:**
- Europe's premier SME acquisition acceleration programme
- Helps executives transition into business ownership
- 4-stage process: Profile Assessment -> Deal Sourcing -> Acquisition Support -> Post-Acquisition Mentoring
- Network of 9 strategic partners, 1,500+ acquisition opportunities

---

## EXECUTIVE SUMMARY

**Target: January 23rd Go-Live for Public Intake Form**

The platform is technically ~95% ready. What's blocking go-live is NOT code, it's content and decisions from the founders.

### Current Status At a Glance

| Area | Status | Blocker |
|------|--------|---------|
| Platform Infrastructure | DONE | - |
| Authentication System | DONE | Better Auth migration completed |
| Intake Form (Questionnaire) | READY (tech) | Waiting for final question list |
| Email Sending | READY (tech) | Waiting for email templates |
| Scoring System | DONE | - |
| Dashboard & CRM | DONE | - |
| Logo on Intake Form | DONE | Applied from re-new.team |
| Custom URL | PENDING | Bertrand to provide DNS access |

---

## THREE WORKSTREAMS FOR V1.0

### Stream 1: Questionnaire Finalization

**Owner:** Bertrand + Amelie
**Deadline:** Wednesday, Jan 22nd
**Status:** Founders to finalize

**What's needed:**
1. Final list of questions organized in 3 buckets:
   - **Bucket 1:** Basic data (name, email, phone)
   - **Bucket 2:** Profile quality (experience, leadership, M&A knowledge)
   - **Bucket 3:** Readiness indicators (training, funding, letter de cadrage status)

2. Decision on **Letter de Cadrage** handling:
   - If candidate has LDC: ask to upload it (10 points auto-scored)
   - If no LDC: skip those questions

**Strategic Note:** Founders need to balance asking for information vs. friction to enter. Too many questions = lost candidates in the process. Some info can be asked later through automated follow-ups or filled in with minimal effort by humans (the platform has ad-hoc functions for this). Start lean, add later.

**Deliverable format:** See the Notion template below (copy-paste into Notion). Bertrand can start from the current T1 structure and modify.

**Ivan's action:** Once received, implement within 24-48 hours.

---

### Stream 2: Email Templates

**Owner:** Bertrand + Amelie
**Deadline:** By Friday, Jan 24th (can be after go-live)
**Status:** Founders to draft

**Email types needed:**
1. **Welcome Email** (after questionnaire submission)
2. **Qualification Email** (when marked as "Qualified")
3. **Interview Invitation** (booking link)
4. **Offer Proposal** (when offer assigned)
5. **Follow-up Reminder** (if no response to offer)

**Format:** Plain text is preferred (no fancy HTML). This avoids spam filters and feels more personal.

**Note from meeting:** Email automation is nice-to-have, not a blocker for go-live. Manual sending works fine for the first 50 candidates.

**Testing approach:** Ivan has begun implementing a task management system on the platform to orchestrate internal team tasks. We can connect email automation to this system and practice email automation capability and flexibility BEFORE we touch live candidates.

---

### Stream 3: Look & Feel (Logo + URL)

**Owner:** Collaborative (Ivan + Founders)
**Deadline:** Before public launch
**Status:** Logo DONE, URL pending

**Tasks:**
1. **Logo:** DONE - Applied from re-new.team website to intake form (header + ending screen)
2. **URL:** PENDING - Options:
   - Keep current: `v0-re-new-2-0.vercel.app/intake` (free, works now for testing)
   - Custom domain: `app.re-new.team/intake` (needs DNS access from Bertrand)
3. **Colors/Branding:** Currently blue theme, matches re-new.team

**Action:** Bertrand to provide DNS access. Ivan handles technical setup (1-2 hours).

**Testing note:** Once founders deliver final questionnaire structure, we'll run usability tests on the intake flow (it's long with many steps). This can only happen AFTER the form content is finalized.

---

## FOURTH STREAM: AI Intelligence (V1.5)

**Owner:** Ivan
**Status:** Waiting for Anthropic account
**Cost:** ~$100/month experimentation budget

**What AI can enable:**
- Automated scoring of CV/Letter de Cadrage uploads
- AI-drafted personalized emails based on candidate profile
- Smart matching between candidates and offers

**Founders' action:** Create Anthropic account, add payment method, share login credentials with Ivan. Ivan will extract the API keys needed.

---

## WHAT'S WORKING vs. NEEDS REVIEW

### DONE (36 of 38 tasks complete)

| Feature | Status |
|---------|--------|
| Dashboard with stats, charts, heatmap | DONE |
| Repreneur list with grouping by status | DONE |
| Kanban pipeline view | DONE |
| Repreneur detail pages | DONE |
| Tier 1 automated scoring (17 questions) | DONE |
| Tier 2 manual star rating | DONE |
| CV & Letter de Cadrage uploads | DONE |
| Avatar system | DONE |
| Email sending (manual trigger) | DONE |
| Public intake form (questionnaire) | DONE |
| Radar chart for candidate visualization | DONE |
| Skeleton loading & animations | DONE |

### NEEDS FOUNDERS REVIEW & FINALIZATION

| Area | Issue | Recommendation |
|------|-------|----------------|
| **Journey Stages** | Steps and milestones need clarification | Keep milestone validation MANUAL (human presses check), not automated. Even for file uploads, manual review is safer. Manual effort is minimal (just one click). |
| **Notes System** | Presented as draft, untested with real use | Test in real scenarios. Either remove if not useful or improve structure based on feedback. |
| **Activity Tracking** | Same as notes | Same recommendation |
| **Offers System** | Same as notes | Same recommendation |

### SUMMARY: WHAT'S MISSING FOR GO-LIVE

1. **User Data Structure** - Finalize questionnaire = finalize scoring = finalize journey mapping
2. **Questionnaire Review** - Founders deliver final spec
3. **Scoring Review** - Validate weights and thresholds with Bertrand
4. **Journey Mapping Review** - Confirm stages and milestones names

Once the above is done, closing bits:
- Import Flatchr missing users (Bertrand provides CSV)
- Get intake form tested (usability)
- Set up custom URL (Bertrand provides DNS access)

**Before go-live:** Test platform email automation internally to see if we want to leverage it for V1.0 (no AI intelligence yet, just automated sending based on triggers).

---

## PENDING TASKS (After V1.0)

### Task 52: Intermediary Portal
**Priority:** High (V2.0)
**What:** Anonymous candidate view for M&A brokers/intermediaries

### Task 53: Deal Marketplace
**Priority:** High (V2.0)
**What:** Allow sellers to post deals, candidates to browse/match

---

## TIMELINE

```
     JANUARY 2026
     ============

     Week of Jan 20-24              Week of Jan 27-31
     -----------------              -----------------

     Mon 20 +-- Questionnaire       Mon 27 +-- Polish & fix
            |   workshop (B+A)              |   + Test email automation
     Tue 21 +-- Continue workshop   Tue 28 +-- Testing with real users
     Wed 22 +-- DELIVERABLE:        Wed 29 +-- Collect feedback
            |   Final questionnaire         |   + Journey/milestone review
     Thu 23 +-- Ivan implements     Thu 30 +-- Iterate
            |   questionnaire               |
     Fri 24 +-- Domain setup        Fri 31 +-- V1.0 READY FOR LAUNCH
            |   + Review meeting            |
            v                               v

     FEBRUARY 2026 - GO-LIVE
     =======================
     Week 1: Public intake form live on app.re-new.team
     Week 2-4: AI integration (V1.5) + Intermediary portal planning (V2.0)
```

### Go-Live Criteria

| Requirement | Status | Owner |
|-------------|--------|-------|
| Final questionnaire implemented | PENDING | Founders -> Ivan |
| Custom domain (app.re-new.team) | PENDING | Bertrand (DNS) -> Ivan (setup) |
| Welcome email template | PENDING | Founders |
| Logo on intake form | DONE | Ivan |
| Platform stable | DONE | - |
| Flatchr data imported | PENDING | Bertrand (CSV) -> Ivan (import) |

---

## ACTION ITEMS

### From Founders (Bertrand + Amelie)

| Deadline | Task |
|----------|------|
| Mon Jan 20 | Start questionnaire workshop |
| Wed Jan 22 | Deliver final questionnaire spec (use Notion template below) |
| Fri Jan 24 | Provide DNS access for app.re-new.team |
| Fri Jan 24 | Deliver welcome email template (plain text) |
| Fri Jan 24 | Provide Flatchr CSV export |
| Optional | Create Anthropic account (credentials, not API keys) |

### From Ivan

| Deadline | Task |
|----------|------|
| Done | Better Auth migration |
| Done | Logo on intake form |
| Thu Jan 23 | Implement final questionnaire |
| Fri Jan 24 | Configure app.re-new.team domain |
| Fri Jan 24 | Implement welcome email automation |
| Jan 27-31 | Import Flatchr data + Polish + Testing |

### Joint Review

| Date | Meeting |
|------|---------|
| Fri Jan 24 | Review questionnaire and domain |
| Fri Jan 31 | Final review before go-live |
| Mon Feb 3 | GO-LIVE |

---

## DOMAIN SETUP - WHO DOES WHAT

**Bertrand's part:**
1. Log into your domain registrar (wherever re-new.team is registered - likely OVH, Gandi, or Cloudflare)
2. Share login credentials with Ivan OR add a CNAME record: `app` pointing to `cname.vercel-dns.com`

**Ivan's part:**
1. Configure custom domain in Vercel dashboard
2. SSL certificate is automatic

**Timeline:** 1-2 hours once Bertrand provides access

---

## NOTION TEMPLATE FOR QUESTIONNAIRE SPEC

Copy-paste this into Notion. It shows the current T1 structure that Bertrand can modify.

---

### QUESTIONNAIRE TEMPLATE

**Instructions for Bertrand:**
- Review each question below
- Modify text, options, or scoring as needed
- Add/remove questions
- Mark which questions to KEEP, MODIFY, or REMOVE

---

#### BUCKET 1: BASIC DATA (No scoring)

| ID | Question (FR) | Type | Options | Score | Keep/Modify/Remove |
|----|---------------|------|---------|-------|-------------------|
| B1-1 | Prenom | text | - | - | |
| B1-2 | Nom | text | - | - | |
| B1-3 | Email | text | - | - | |
| B1-4 | Telephone | text | - | - | |

---

#### BUCKET 2: PROFILE QUALITY (Scored)

| ID | Question (FR) | Type | Options | Score | Keep/Modify/Remove |
|----|---------------|------|---------|-------|-------------------|
| Q1 | Quel est votre statut professionnel actuel? | dropdown | Sans emploi (10), En transition (10), Independant (7), Employe temps plein (5), Employe temps partiel (5), Autre (3) | 0-10 | |
| Q2 | Combien d'annees d'experience professionnelle avez-vous? | dropdown | >20 ans (10), 16-20 ans (7.5), 11-15 ans (5), <10 ans (0) | 0-10 | |
| Q3 | Dans quels secteurs avez-vous travaille? | multi-select | Agriculture, Arts, Construction, Commerce detail, Commerce gros, Finance, Gestion entreprises, Hebergement/Restauration, Immobilier, Industrie, Information/Medias, Sante, Services admin, Services educatifs, Services pro, Spectacles/Loisirs, Scientifiques/techniques, Sylviculture, Transport, Services publics, Admin publique, Extraction, Autres services | 3 (1-2 sectors), 5 (3+ sectors) | |
| Q4 | Avez-vous de l'experience en fusions-acquisitions? | yes/no | Oui, Non | info only | |
| Q5 | Quelle taille d'equipe avez-vous geree? | dropdown | >50 pers (10), 20-50 pers (7.5), 11-20 pers (0), <10 pers (3) | 0-10 | |
| Q6 | Avez-vous ete implique dans des transactions M&A? | yes/no | Oui (10), Non (0) | 0-10 | |
| Q7 | Si oui, decrivez brievement | text | - | info only | |
| Q8 | Quels postes de direction avez-vous occupes? | multi-select | CEO/DG, COO, CFO, CCO, CTO/CIO, CHRO, Directeur Division/BU, Autres, Aucun | 2-6 (complex scoring) | |
| Q9 | Avez-vous une experience en conseil d'administration? | yes/no | Oui (10), Non (0) | 0-10 | |

---

#### BUCKET 3: READINESS INDICATORS (Scored)

| ID | Question (FR) | Type | Options | Score | Keep/Modify/Remove |
|----|---------------|------|---------|-------|-------------------|
| Q10 | Ou en etes-vous dans votre parcours de reprise? | multi-select | Recherche d'infos (2), Premiers contacts (4), Formation effectuee (6), Lettre de cadrage (8), Recherche de cibles (8), Financement defini (10) | 2-10 (max taken) | |
| Q11 | Quels secteurs ciblez-vous pour l'acquisition? | multi-select | (same as Q3) | 2 (1-2), 5 (3+) | |
| Q12 | Avez-vous identifie des cibles specifiques? | yes/no | Oui (10), Non (0) | 0-10 | |
| Q13 | Si oui, decrivez brievement | text | - | info only | |
| Q14 | Quelle est votre capacite d'investissement personnel? | dropdown | >450K (10), 351-450K (8), 251-350K (6), 151-250K (4), <150K (2), A definir (0) | 0-10 | |
| Q15 | Quel est le statut de votre financement? | dropdown | Deja boucle (3), En cours de validation (1) | 1-3 | |
| Q16 | Etes-vous membre d'un reseau ou avez-vous suivi une formation? | multi-select | C.R.A. (+2 bonus), CCI (2), Autres (2), Aucune (0) | 0-4 | |
| Q17 | Seriez-vous ouvert a une co-acquisition? | yes/no | Oui (5), Non (0) | 0-5 | |

---

#### LETTER DE CADRAGE (Conditional)

| ID | Question (FR) | Type | Condition | Score | Keep/Modify/Remove |
|----|---------------|------|-----------|-------|-------------------|
| LDC-1 | Avez-vous une Lettre de Cadrage? | yes/no | Always | triggers next questions | |
| LDC-2 | Telechargez votre Lettre de Cadrage | file_upload | Only if LDC-1 = Oui | 10 (auto) | |

---

#### ADDITIONAL QUESTIONS (Not in current system)

| ID | Question (FR) | Type | Options | Score | Notes |
|----|---------------|------|---------|-------|-------|
| | | | | | Add new questions here |

---

**Max Possible Score (current):** ~100 points

**Scoring Thresholds (current):**
- 70+ = Excellent candidate (5 stars)
- 55-69 = Strong candidate (4 stars)
- 40-54 = Good candidate (3 stars)
- 30-39 = Moderate candidate (2 stars)
- <30 = Early stage candidate (1 star)

---

## DOCUMENT END

*This document serves as the coordination guide for Re-New Platform V1.0 launch.*

**Last updated:** January 18, 2026 (V2)
