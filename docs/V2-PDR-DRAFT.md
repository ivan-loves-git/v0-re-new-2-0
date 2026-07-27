# V2 Product Development Requirements — Draft

> **Status:** Historical superseded draft. Do not use it as current scope, requirements or an open-decision list. The live WAVE Strategic PDR is authoritative; current M&A implementation meaning lives in `docs/data-models/ma-advisory-data-model-v1.md`.
> **Author:** Ivan (with Wave AI assistance)
> **Date:** 2026-05-13

---

## Intro

This is the working spec for V2 of the Re-New platform, derived from the founder call held on 2026-05-13. It captures the requirements we discussed, grouped into 9 themes, and concentrates attention on the few decisions that genuinely block scoping and timeline. 

Priority convention for clarifications

- 🔺 **critical** — blocks scoping or feasibility, cannot estimate without it
- 🔸 **needed** — required to lock the spec before build
- 🔹 **useful** — nice-to-have detail, can be deferred

---

## 1. Opportunities database

The platform gains a second database — opportunities — alongside the existing repreneurs database, replacing today's Excel deal flow. It gives the Wave team a structured way to input, edit, and maintain opportunities and unlocks the platform's matching capability to cross-reference opportunity fields against repreneur profiles for recommended suggestions. At this stage repreneurs do not access the platform to browse the deal flow themselves; all repreneur-facing surfacing happens via internal staff workflow (see §3).

**Requirements**

- 1.1 Unified opportunities DB in Wave, replacing Excel. Scale: 97 → 150–220 opps and 15 → 20 repreneurs by September.

**Needs clarification** ⚠️

- 🔺 **M&A firm data format** — collect 3–5 real samples from current firms this week. If every firm sends free-text email/PDF prose with no structure, the matching premise in §2 collapses and V2 needs a structured intake step first. Biggest feasibility risk for the June timeline.
- 🔸 **Required field list for an opportunity** — derives from the samples above. Founders commit to the minimum schema repreneurs will be matched against. This is the field set that powers §2 matching; lock it before §2 build starts.
- 🔸 **Excel migration** — doable in principle, but we need to see the current Excel to assess migration complexity and design the import. **Sharing the Excel is a primary input** to lock §1 schema and timeline.

---

## 2. Matching (opportunity ↔ repreneur)

Matching is the core mechanism that turns the opportunities DB into product value: the platform proposes which repreneurs fit which opportunity, instead of Bertrand holding the matrix in his head. For V2 we ship matching internally — staff-driven — so the team can validate the logic before any repreneur-facing exposure.

**Requirements**

- 2.1 **Staff-facing "assign opportunity to repreneur X" button (not an automated scoring push).** Internal users open an opportunity, see suggested repreneurs ranked against the opportunity fields, and assign manually. No automated push to the repreneur in V2.

**Needs clarification** ⚠️

- 🔸 **Field set for matching** — founders specify the full opportunity-side fields (from §1) so we can map them against the repreneur fields already in V1. Tied to §1 schema lock.

---

## 3. Repreneur-facing actions on opportunities

The critical strategic decision in this section is **how repreneurs interact with the deal flow**: do we expose the platform to them via login, or do we handle everything via email? Today Wave is an internal tool only. Opening it to repreneurs raises the product quality bar significantly — it's no longer "internal use," and repreneurs will quickly expect to see their profile and other surfaces inside the platform once they're logged in.

### 3.1 Repreneur access channel — platform login vs email-only

- **Platform login:** adds roughly 2–3 days of full-time work just for the access layer, and meaningfully raises the bar on UI/UX polish and product quality (no longer staff-only). Also implies the door opens to repreneur-facing profile and milestone views.
- **Email-only (recommended starting point):** the platform stays internal. Suggested opportunities go out via templated email; repreneur replies are captured by staff and entered into Wave manually. Faster, lower scope, lower risk for end-June.

**Needs clarification** ⚠️

- 🔺 **Founders decide: platform access or email-only for V2.** Recommendation is email-only. This decision cascades into §3.2 (NDA UX), §3.3 (info requests), §4 (visibility), and the overall V2 scope. Cannot estimate timeline confidently without it.

### 3.2 NDA strategy (independent strategic question)

Two paths:

- **(a) Re-New as middleman.** Re-New signs a master NDA with each intermediary covering all its repreneurs. Each repreneur in turn signs one NDA with Re-New. Massive operational simplification.
- **(b) Status quo.** Per-deal, per-repreneur NDAs with each intermediary, using each intermediary's own template. Bertrand on call: 99% of intermediaries today demand their own NDA, so (a) is unproven and would need negotiating.

**Needs clarification** ⚠️

- 🔺 **Can path (a) be legally validated with intermediaries?** Worth the legal effort if it unlocks scale. Answer determines whether NDA UX in §3 is "click-accept once" or "upload signed PDF per deal."

### 3.3 Request info, request intro

Implementation follows from §3.1 — either an in-platform button or a structured email reply.

---

## 4. Deal progress tracking

Today Bertrand tracks "which repreneur is on which opportunity at which stage" mentally and in Excel. As deal flow scales (10 → 20 paid repreneurs by September), this breaks. V2 makes deal progress a first-class platform feature, with multi-repreneur pursuit of the same opportunity (parallel evaluation) and re-shippable handoff when one repreneur drops.

**Requirements**

- 4.1 Track which repreneur is on which opportunity at which stage
- 4.2 Multi-repreneur pursuit and re-shippable handoff

**Needs clarification** ⚠️

- 🔺 **Stage taxonomy + relationship to existing repreneur milestones** — V1 has `intermediary_meeting / seller_meeting / loi_issued` on the repreneur side. Are opportunity stages a parallel track, a mirror, or a replacement of these? Ugly fast if undecided.
- 🔸 **Cross-repreneur visibility** — moot if §3.1 = email-only (repreneurs never see the platform). Returns as a real question only if we choose platform login.

---

## 5. Freshness / aging of opportunities

The platform flags how fresh each opportunity is, so Bertrand and the team know which deals are still safe to push and which need follow-up with the intermediary. Visible to internal staff only.

**Requirements**

- 5.1 Freshness indicator per opportunity (fresh / aging / stale / cold)

✅ **No open questions — implementation detail.**

---

## 6. M&A firm feedback loop

How does opportunity status get updated once we've shipped it out? Confirming the assumption from the call.

**Requirements**

- 6.1 Capture real status of an opportunity after it's been sent out (still open, under LOI, closed, dropped)

✅ **Confirmed: M&A firms do not have a portal in V2.** Updates flow in two ways: (a) the intermediary proactively contacts Re-New when something changes, or (b) Re-New asks the intermediary for an update after X days. In both cases, capture is manual by Re-New staff inside Wave. Founders confirm this is the model.

---

## 7. Deal analysis / intelligence layer ⏭️ V3 deferred

**Scenario.** Today Bertrand analyzes each active opportunity using external tools (Claude / ChatGPT). For each, he produces a 5–6 page synthesis covering risks, upside, and qualifying questions for the Q&A with the seller. After Q&A, he produces a round-2 analysis (pursue? meet seller? issue LOI?). This work happens entirely outside the platform.

**V2 placeholder.** Bertrand keeps producing the analyses externally, but the resulting PDFs are uploaded to and stored inside Wave against the relevant opportunity. The closed loop is preserved at the data level. No in-platform generation in V2.

**V3 scope (later).** The synthesis generation itself moves inside the platform — Bertrand uploads the info memo, the platform produces the 5–6 page synthesis via LLM, editable in-app. Same flow for round-2 post Q&A.

**Needs clarification** ⚠️

- 🔸 **Is the V2 "PDF attached to opportunity" placeholder enough?** Specifically: do the analyses need to be readable inline in the platform for V2 to be demoable at the quarterly review, or is "PDF download from the opportunity record" sufficient? Drives whether we add a PDF viewer in V2 or wait for V3 in-app rendering.

---

## 8. Reporting / KPIs

The platform exposes operational KPIs for the Re-New team to track deal-flow health and partnership performance.

**Requirements**

- 8.1 KPI dashboard: # active intermediaries, # who sent opportunities, # opportunities to date, # introductions managed, # seller meetings, # LOIs issued

✅ **Confirmed: dashboard is for internal staff only.** Not exposed to repreneurs, not exposed to investors via login. If Tomas / Fabio need the numbers at the quarterly, we hand them a PDF export.

---

## 9. Scope guardrails

Already agreed on the call:

- 🟢 V2 ships end of June for the quarterly with Tomas + Fabio
- 🟢 M&A firm relationships stay human-managed in V2; automation deferred to V3
- 🟢 Off-market opportunity sourcing is out of V2 scope
- 🟢 AI synthesis layer deferred to V3, with a thin V2 placeholder

---

## ⭐ Strategic decisions founders need to take this week

These are the calls that unlock scoping and timeline. None of them are technical — they're product and operational decisions that shape what V2 actually is.

1. **Share the current Excel deal flow with Ivan.** Without it we can't size the migration, validate the field list, or lock the §1 schema. Primary unblock.
2. **Collect 3–5 real M&A intake samples from current intermediaries.** If they're free-text, V2 needs a structured intake step before matching is buildable. Biggest feasibility risk for end-June.
3. **Decide §3.1 — repreneur access channel: platform login or email-only.** Recommendation: email-only for V2. This decision cascades into half the V2 surface (NDA UX, info requests, visibility, polish bar).
4. **Decide §3.2 — NDA model.** Status quo (per-deal NDA with each intermediary) or push for a Re-New-as-middleman master NDA. Needs legal pre-validation if path (a) is on the table.
5. **Reconcile §4 stage taxonomy with existing repreneur milestones.** Decide whether opportunity stages are parallel, mirror, or replacement of `intermediary_meeting / seller_meeting / loi_issued`.

---

## 📍 Summary

- 9 themes covering ~34 requirements from the meeting
- ~20 trivial clarifications removed; the survivors are ~10 real founder decisions
- §5, §6, §8 already converge with one assumption confirmation each
- §3 (repreneur access channel) is the highest-leverage scope decision — it cascades through most of V2
- §1 unblocks via the Excel share + 3–5 real intermediary samples

Once the 🔺 critical items are answered, we can lock the spec and commit to end-of-June.
