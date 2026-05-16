# WhatsApp to Bertrand: V2 Scope Boundaries

**Date:** 2026-05-16
**Channel:** WhatsApp
**Author:** Ivan
**Context:** Sent after reviewing Bertrand's Notion answers to the V2 PDR questions. This message frames what is clear, what diverged, and what should be included or postponed for the June build.

---

Hi Bertrand,

I went through your comments again. A lot is clearer now, especially on repreneur access, NDA logic, opportunity stages, freshness, and the role of PDFs. But some answers also point toward a broader product than the first PDR, so I think the next step is to converge on the June version and be very explicit about what we are not building yet.

Also, if we are strict now, V3 can follow V2 very fast. So what we postpone is not lost, it just comes after the basics are live and validated.

*1. Opportunities database*

You clarified the current Excel structure, shared both the source and shared versions, and added useful teaser samples, including individual teasers and a deal book.

*Clarity state:* mostly clear.

For June, I would include the opportunity database, Excel import, manual opportunity creation, anonymized shared fields, and basic file attachment. I would postpone automatic PDF teaser parsing unless we decide it is absolutely required.

*2. Matching, opportunity to repreneur*

You clarified that matching needs both structured fields and a more subjective reading of sector, activity, geography, revenue range, and investment thesis.

*Clarity state:* partially clear.

For June, I would include a platform recommended match value, based on the structured data we have, plus the option for Re-New staff to add a human recommendation. This keeps the process flexible and lets us build a feedback loop over time. I would postpone deeper AI assisted sector interpretation until the data model is stable.

*3. Repreneur facing actions on opportunities*

You clearly argued for opening Wave to repreneurs, so this point is no longer open in principle.

*Clarity state:* clear direction, still needs boundary.

For June, I would include repreneur access, anonymized opportunity visibility, and a simple action to express interest or reject. I would postpone advanced self service, full profile editing, and complex request workflows.

*4. Deal progress tracking*

You clarified that opportunity stages are a subset of the repreneur journey, not a parallel journey and not a replacement.

*Clarity state:* clear enough.

For June, I would include the core stages: interest, intermediary meeting, seller meeting, LOI, dropped or closed. I would postpone a more sophisticated stage model until we see the first deals moving through the flow.

*5. Freshness and aging of opportunities*

You clarified that the month when the opportunity was added is enough, and that this should also be visible to repreneurs.

*Clarity state:* clear.

For June, I would include date added and month added as the freshness signal. I would postpone complex aging labels like fresh, stale, cold unless they become useful later.

*6. M&A firm feedback loop*

You confirmed that M&A firms should not have portal access in V2, but added that stale opportunities should trigger a follow up after 3 months if no repreneur is actively pursuing them.

*Clarity state:* clear on no portal, new scope on automation.

For June, I would include basic M&A contact tracking only where needed and a simple stale opportunity reminder. I would postpone a full M&A CRM and more advanced automation.

*7. Deal analysis and intelligence layer*

You confirmed that V2 does not need in platform analysis generation, and that PDF upload by Re-New staff plus download by repreneurs is enough.

*Clarity state:* clear.

For June, I would include PDF upload and download linked to the opportunity. I would postpone in platform memo generation, AI analysis, and inline PDF review.

*8. Reporting and KPIs*

You agreed with the KPI direction: active intermediaries, opportunities, introductions, seller meetings, LOIs, and internal reporting.

*Clarity state:* clear.

For June, I would include simple operational reporting. I would postpone polished investor style reporting and advanced analytics.

*9. Scope guardrails*

The bigger direction is now clearer: Wave V2 is becoming the operating layer for deal flow, repreneurs, M&A sources, matching, NDAs, and progress tracking.

*Clarity state:* direction is clear, June scope must be locked.

For June, I would keep the build focused on a usable first version: opportunity database, repreneur access, basic matching, interest validation, staff assignment, progress tracking, PDF handling, and simple reporting. I would postpone full M&A CRM, automatic teaser parsing, AI matching, e signature, and heavy automation with M&A firms.

So my suggestion is this: we treat your comments as the target direction, but we define June V2 as the first usable version of that direction. If we agree on the boundaries above, we can turn this into a precise build plan and estimate.
