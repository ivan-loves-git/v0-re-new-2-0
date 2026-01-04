# Journey Framework Analysis

**Subject: Your Journey Framework: Strategic Analysis + 5 Questions**

---

Hey Bertrand,

[This is gold](https://www.notion.so/Feedback-Jan-2-2dc36d8dca8880c4b5eafefb54bc56bd?source=copy_link).Having you think through the full candidate journey like this is exactly what we needed. I went through it with Claude Code (my technical partner) and mapped everything against what's already built.

Let me give you a strategic view of where we are, what's easy to add, and where I need your input before building further.

---

## The V1 Philosophy

Before diving into specifics, let me frame what we're building.

V1 is a **manual internal CRM** for 3 users. Not an automation engine. Not HubSpot. Not Pipedrive.

The value is simple: one central place where nothing falls through the cracks. Your team can see every repreneur, where they are in the process, what's been discussed, and what offers are on the table. All manually operated, but with clear structure and full history.

We can STORE any data point you need (consent, sources, stages, scores). We just won't AUTOMATE actions on that data in V1. Your team runs the process. The system keeps the records straight.

V2 adds automation once you've proven which workflows actually matter. Building automation before you know what works is how you end up with complex systems nobody uses.

This philosophy applies to everything below.

---

## What We Have Today: The Qualification System

I want to be clear about the current system before we discuss changes, because your framework introduces concepts that might overlap, replace, or add to what exists.

**Current Structure:**

| Concept | What It Does |
|---------|--------------|
| **Lifecycle Status** | Where someone is in the relationship: `lead` → `qualified` → `client` → `rejected`. This changes based on actions (not drag and drop). |
| **Tier 1 Score** | Automated number calculated from the intake questionnaire. Used to prioritize which leads to interview first. Higher score = more promising on paper. |
| **Tier 2 Stars** | Manual 1 to 5 rating set after the interview. Reflects your gut assessment of fit, readiness, leadership. Setting stars triggers "qualified" status. |
| **Offer Status** | When you assign an offer to someone, they become a "client." The offer itself tracks: `offered` → `accepted` → `active` → `completed/expired`. |
| **Notes** | Centralized place where anyone on the team can register comments, observations, and context about a candidate. Everything in one place, visible to everyone, with timestamps and authorship. No more scattered emails or personal notes that get lost. |
| **Activities** | Registry of time spent and actions taken on each candidate: calls, meetings, emails sent. Beyond keeping a record, this enables financial hygiene. You can see how much effort goes into each candidate and start understanding the true cost of your sales process. |

**How It Works Together:**

A new repreneur comes in as a `lead` with a Tier 1 score. Your team reviews leads (sorted by score), interviews the promising ones, and sets Tier 2 stars. Setting stars makes them `qualified`. When you propose an offer and they accept, they become a `client`. If someone isn't a fit, you mark them `rejected`.

This is intentionally simple. Four statuses. Two scoring layers. One offer pipeline.

---

## What We Can Add Easily

These align with your framework and require minimal changes:

- **Data Capture Enhancements**

We already have a `source` field. I'll populate the dropdown with your categories: Website form, LinkedIn, Partner intro, Event, Referral, Inbound email. I'll also add a `linkedin_url` field to the profile.

- **GDPR Consent Tracking**

You're right that this is compliance critical. I'll add three fields: `marketing_consent` (yes/no), `consent_timestamp`, and `consent_source`. Your team records consent when candidates sign up. We store it properly. No automation, but the data is there if you ever get audited.

- **Assessment Documentation**

Already covered. Tier 1 scores the questionnaire automatically. Tier 2 captures your post-interview judgment. Notes capture the qualitative reasoning. Every record shows who created it and when. Your "scorecard" concept maps directly to this.

- **Activity Types**

The system already logs: welcome_email, interview, meeting, offer_submitted, offer_rejected, offer_approved. I can add more types if your process needs them (call_scheduled, call_completed, proposal_discussed, etc.). These are manual entries, not automated triggers.

- **Offer Pipeline**

We track: offered → accepted → active → completed → expired. This covers the commercial side of your framework. If you need more granularity, see the question below.

---

## Where I Need Your Input

Your framework introduces three concepts that could overlap with, replace, or add to what we have. I need to understand your intent before building.

### 1. A/B/C Qualification Buckets

**What you proposed:**
- A = Ready & fundable (active search 0 to 6 months)
- B = Promising but not ready (needs work on thesis, financing, focus)
- C = Not a fit (unrealistic expectations)

**What we have:**
- Lifecycle status: lead → qualified → client → rejected
- Tier 2 stars: 1 to 5 quality rating after interview

**What I need to understand:**

Is A/B/C meant to replace our status system? Or is it an additional dimension alongside it?

For example: Could someone be "Qualified + Bucket B" (you've assessed them, they're promising, but not ready yet)? Or does Bucket A equal Qualified, and Bucket C equal Rejected?

And how does this interact with stars? Is a 5-star candidate always Bucket A? Or could you have a 5-star person who's still Bucket B because their financing isn't ready?

If A/B/C is just another way of saying what Tier 2 stars already capture (quality/readiness), we might not need to add it. If it captures something different (like timing or financing status), then it's a useful addition. I need to know which.

### 2. "Nurture" as a Concept

**What you proposed:**
Nurture tracks for candidates who aren't ready now, with scheduled follow-ups and content drips.

**What we have:**
`rejected` status for people who aren't a fit. No "soft rejection" or "come back later" status.

**What I need to understand:**

Is "nurture" a status (like rejected, but softer)? Or is it a tag/flag that can exist alongside other statuses?

Practically: what's the difference between a "nurture" candidate and a "rejected" candidate in how your team treats them? Does nurture mean "we'll reach out again in 3 months" while rejected means "we won't contact them again"?

If nurture is just "rejected but politely," we don't need a new status. If it means something operationally different (you actively follow up vs. you don't), then I should add it.

Note: the automated nurture sequences (drip emails, scheduled check-ins) are V2. But I can add a `nurture` status or flag now if it helps your team track who to manually follow up with.

### 3. Offer Stage Granularity

**What you proposed:**
"Offer to be discussed" → "Offer discussed" → "Proposal sent" → "Accepted/Rejected"

**What we have:**
`offered` → `accepted` → `active` → `completed/expired`

What I need to understand:

Do you need "to be discussed" and "discussed" as separate stages before "offered"?

Each stage means more clicks for your team. What action triggers moving from one to the next? Is there a real decision point between "we plan to discuss an offer" and "we have discussed it"?

If your team's workflow is "we talk to them, then we send a proposal," then `offered` (proposal sent) might be enough. If there's meaningful tracking value in knowing "we've earmarked this person for an offer discussion but haven't had the conversation yet," then I'll add it.

### 4. Consent Categories

**What you proposed:**
Newsletter consent AND marketing consent, tracked separately.

**What I need to understand:**

What consent do you actually collect today? Is there a checkbox on your intake form? One consent for everything, or separate consents for newsletter vs. marketing communications?

I'll build whatever you need, but I need to know what categories to track.

### 5. Campaign/UTM Tracking

**What you proposed:**
Track UTM parameters and campaign names for attribution.

**What I need to understand:**

Do you run campaigns where attribution matters? Paid ads, specific LinkedIn posts, partner promotions where you need to know which one drove a lead?

Or is simple source tracking (LinkedIn, Website, Partner, Referral) enough for how you operate today?

UTM tracking adds fields and complexity. Worth it if you're measuring campaign ROI. Overkill if leads mostly come through a few known channels.

---

## What's V2

These features require integrations we're not building into V1. But they're on the roadmap.

**Calendly Integration:** Auto-syncing bookings to the CRM. Requires OAuth and webhooks. For now, log calls manually as activities.

**Scheduled Tasks:** "Remind me to check in with this person in 3 months." Requires a task system with notifications. Not a CRM feature.

**Candidate Portal:** Self-service login for candidates. Explicitly scoped out of V1.

For V1, we store the data. Your team runs the process. V2 automates the repetitive parts once you know which ones matter.

**A note on email automation:** This is actually the most natural next step once V1 is closed. Connecting to an email service (Resend, SendGrid) and building welcome emails, follow-up sequences, and nurture drips is not technically difficult. The architecture we're building supports it. I'm just being disciplined about finishing V1 properly before adding that layer. Once the core CRM is stable and you're using it daily, email integration can be the first V2 feature. It's weeks away, not months.

---

## Next Steps

Can you answer the 5 questions above? Doesn't need to be long. A few sentences per question is enough.

Once I understand your intent on buckets/nurture/stages, I can finalize the data model and wrap up the build. The core is done. These decisions shape the last 20%.

Talk soon,
Ivan
